"""
Blueprint de Autenticação
Endpoints: registro, login, logout, recuperação de senha, perfil
"""
import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from banco import Conflito, consultar_um, executar, transacao
from config import EM_PRODUCAO, REFRESH_TOKEN_EXPIRES
from decorators import get_user_permissions
from repositories import AcessoRepository, RefreshTokenRepository

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

refresh_token_repository = RefreshTokenRepository()
# Também consultado pelos callbacks do JWT em app.py.
acesso_repository = AcessoRepository()

# Grupo atribuído a todo novo cadastro. Localizado por nome: a ordem em que o
# schema semeia os grupos não é contrato, e um id fixo transforma qualquer
# reordenação do seed em escalação de privilégio silenciosa.
GRUPO_PADRAO = 'Usuários'


class GrupoPadraoAusente(RuntimeError):
    """O seed não tem o grupo padrão: o cadastro é abortado (500)."""


# ============================================
# REFRESH TOKEN (ADR-0006)
# ============================================

def _hash_refresh(token):
    """SHA-256 basta: o token tem 256 bits aleatórios, não é senha a ser adivinhada."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _novo_refresh():
    """Devolve (token em claro, hash, expiração em UTC)."""
    token = secrets.token_urlsafe(32)
    expira_em = datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRES
    return token, _hash_refresh(token), expira_em


def _emitir_refresh(id_usuario):
    """Abre uma família de rotação nova: uma por login."""
    token, token_hash, expira_em = _novo_refresh()
    familia = str(uuid.uuid4())
    if not refresh_token_repository.criar(id_usuario, familia, token_hash, expira_em):
        return None
    return token

def _revogar_access(claims):
    """Blocklist persistida: o jti fica recusado até o token expirar."""
    acesso_repository.revogar(claims['jti'], datetime.fromtimestamp(claims['exp'], timezone.utc))

# ============================================
# AUTENTICAÇÃO
# ============================================

@auth_bp.route('/registro', methods=['POST'])
def registro():
    """Registrar novo usuário"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'erro': 'Dados não fornecidos'}), 400

    required_fields = ['nome_completo', 'email', 'senha']
    if not all(field in data for field in required_fields):
        return jsonify({'erro': 'Campos obrigatórios faltando'}), 400

    params = (
        data['nome_completo'],
        data['email'],
        generate_password_hash(data['senha']),
        data.get('data_nascimento'),
        data.get('biografia', ''),
    )

    # Usuário e grupo padrão são criados na mesma transação: um usuário sem
    # grupo não tem permissão alguma, então um cadastro pela metade é pior
    # do que nenhum cadastro.
    try:
        with transacao() as t:
            user_id = t.consultar_um(
                """
                INSERT INTO usuarios (nome_completo, email, senha_hash, data_nascimento, biografia)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id_usuario
                """,
                params,
            )['id_usuario']

            grupo = t.consultar_um("SELECT id_grupo FROM grupos_usuarios WHERE nome_grupo = %s", (GRUPO_PADRAO,))
            if not grupo:
                raise GrupoPadraoAusente(f"Grupo padrão '{GRUPO_PADRAO}' ausente no banco; cadastro abortado")

            t.executar(
                "INSERT INTO usuarios_grupos (id_usuario, id_grupo) VALUES (%s, %s)",
                (user_id, grupo['id_grupo']),
            )
    except Conflito:
        return jsonify({'erro': 'Email já cadastrado'}), 409
    except GrupoPadraoAusente:
        logger.error("Grupo padrão '%s' ausente no banco; cadastro abortado", GRUPO_PADRAO)
        return jsonify({'erro': 'Configuração de grupos inválida'}), 500

    return jsonify({
        'mensagem': 'Usuário criado com sucesso!',
        'id_usuario': user_id
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login de usuário"""
    data = request.get_json(silent=True)
    if not data or not data.get('email') or not data.get('senha'):
        return jsonify({'erro': 'Email e senha são obrigatórios'}), 400

    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email, senha_hash, ativo FROM usuarios WHERE email = %s",
        (data['email'],),
    )

    if not usuario or not check_password_hash(usuario['senha_hash'], data['senha']):
        return jsonify({'erro': 'Email ou senha incorretos'}), 401

    if not usuario['ativo']:
        return jsonify({'erro': 'Usuário desativado'}), 403

    permissions = get_user_permissions(usuario['id_usuario'])
    access_token = create_access_token(identity=usuario['id_usuario'])

    # Sem refresh o login continua valendo: o web não usa o campo, e um
    # banco momentaneamente fora não deve derrubar o login.
    refresh_token = _emitir_refresh(usuario['id_usuario'])
    if not refresh_token:
        logger.warning('Refresh token não emitido para %s', usuario['id_usuario'])

    # Último acesso é escrito aqui, no único momento em que o usuário de fato
    # acessou o sistema (antes vinha de um trigger em qualquer UPDATE).
    executar("UPDATE usuarios SET ultimo_acesso = now() WHERE id_usuario = %s", (usuario['id_usuario'],))

    return jsonify({
        'token': access_token,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'usuario': {
            'id': usuario['id_usuario'],
            'nome': usuario['nome_completo'],
            'email': usuario['email'],
            'nivel_acesso': permissions['nivel_acesso'],
            'grupos': permissions['grupos'],
            'permissoes': {
                'pode_criar': permissions['pode_criar'],
                'pode_editar': permissions['pode_editar'],
                'pode_deletar': permissions['pode_deletar'],
                'pode_moderar': permissions['pode_moderar']
            }
        }
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Trocar um refresh token por um par novo de access + refresh (rotação).

    Banco fora do ar não diz nada sobre o token: `Indisponivel` sobe antes de
    qualquer revogação, vira 503, e o app pode tentar de novo com o mesmo refresh.
    """
    data = request.get_json(silent=True) or {}
    token = data.get('refresh_token')
    if not token or not isinstance(token, str):
        return jsonify({'erro': 'Refresh token inválido'}), 401

    atual = refresh_token_repository.buscar_por_hash(_hash_refresh(token))
    if not atual:
        return jsonify({'erro': 'Refresh token inválido'}), 401

    if not atual['usuario_ativo']:
        # Antes da checagem de revogado: desativar pela moderação já revoga os
        # refresh do Usuário, e a resposta continua a do login (403). A família
        # é revogada para que reativar a conta exija um login novo.
        refresh_token_repository.revogar_familia(atual['familia'])
        return jsonify({'erro': 'Usuário desativado'}), 403

    if atual['revogado']:
        # Já trocado por um sucessor: alguém está reapresentando um token
        # velho. Não dá para saber se é o ladrão ou a vítima, então a
        # família inteira morre. Revogado por logout não tem sucessor e
        # só é recusado.
        if atual['substituido_por']:
            refresh_token_repository.revogar_familia(atual['familia'])
        return jsonify({'erro': 'Refresh token inválido'}), 401

    if atual['expira_em'] <= datetime.now(timezone.utc):
        return jsonify({'erro': 'Refresh token expirado'}), 401

    novo_token, novo_hash, expira_em = _novo_refresh()
    if not refresh_token_repository.rotacionar(atual['id_refresh'], novo_hash, expira_em):
        # Outra requisição rotacionou este token entre a leitura e a troca:
        # é o mesmo caso do reuso.
        refresh_token_repository.revogar_familia(atual['familia'])
        return jsonify({'erro': 'Refresh token inválido'}), 401

    return jsonify({
        'access_token': create_access_token(identity=atual['id_usuario']),
        'refresh_token': novo_token,
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def obter_usuario_atual():
    """Obter informações do usuário autenticado"""
    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email, foto_perfil FROM usuarios WHERE id_usuario = %s",
        (get_jwt_identity(),),
    )
    if not usuario:
        return jsonify({'erro': 'Usuário não encontrado'}), 404

    return jsonify({'usuario': usuario}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Fazer logout e revogar o token"""
    _revogar_access(get_jwt())

    # Opcional: o app manda o refresh do aparelho para encerrar a sessão
    # de verdade. Só revoga token do próprio usuário.
    data = request.get_json(silent=True) or {}
    refresh_token = data.get('refresh_token')
    if refresh_token and isinstance(refresh_token, str):
        refresh_token_repository.revogar(_hash_refresh(refresh_token), get_jwt_identity())

    return jsonify({'mensagem': 'Logout realizado com sucesso'}), 200


@auth_bp.route('/esqueci-senha', methods=['POST'])
def esqueci_senha():
    """Solicitar redefinição de senha"""
    data = request.get_json(silent=True)
    if not data or not data.get('email'):
        return jsonify({'erro': 'Email é obrigatório'}), 400

    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email FROM usuarios WHERE email = %s AND ativo = TRUE",
        (data['email'],),
    )

    if usuario:
        token_recuperacao = create_access_token(
            identity=usuario['id_usuario'],
            expires_delta=timedelta(hours=1),
            additional_claims={'tipo': 'recuperacao_senha'}
        )

        # Paliativo até o envio por email (ticket 25): em dev o token só sai
        # no log; em produção não sai em lugar nenhum.
        if not EM_PRODUCAO:
            logger.info('Token de recuperação para %s: %s', usuario['id_usuario'], token_recuperacao)

    return jsonify({
        'mensagem': 'Se o email existir, você receberá instruções.'
    }), 200


@auth_bp.route('/redefinir-senha', methods=['POST'])
@jwt_required()
def redefinir_senha():
    """Redefinir senha com token de recuperação"""
    claims = get_jwt()
    if claims.get('tipo') != 'recuperacao_senha':
        return jsonify({'erro': 'Token inválido para esta operação'}), 403

    data = request.get_json(silent=True)
    if not data or not data.get('nova_senha'):
        return jsonify({'erro': 'Nova senha é obrigatória'}), 400

    nova_senha = data['nova_senha']
    if len(nova_senha) < 6:
        return jsonify({'erro': 'Senha deve ter no mínimo 6 caracteres'}), 400

    alterados = executar(
        "UPDATE usuarios SET senha_hash = %s WHERE id_usuario = %s",
        (generate_password_hash(nova_senha), get_jwt_identity()),
    )
    if not alterados:
        return jsonify({'erro': 'Usuário não encontrado'}), 404

    # Uso único: o mesmo token não redefine a senha de novo.
    _revogar_access(claims)

    return jsonify({'mensagem': 'Senha redefinida com sucesso!'}), 200
