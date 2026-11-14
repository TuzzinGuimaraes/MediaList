"""
Blueprint de Autenticação
Endpoints: registro, login, logout, recuperação de senha, perfil
"""
import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from spectree import Response
from werkzeug.security import check_password_hash, generate_password_hash

from banco import Conflito, consultar_um, executar, transacao
from config import EM_PRODUCAO, REFRESH_TOKEN_EXPIRES
from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, contrato, resposta_erro
from decorators import get_user_permissions
from repositories import AcessoRepository, RefreshTokenRepository
from schemas.auth import (
    CorpoEsqueciSenha,
    CorpoLogin,
    CorpoLogout,
    CorpoRedefinirSenha,
    CorpoRefresh,
    CorpoRegistro,
    Mensagem,
    RespostaLogin,
    RespostaMe,
    RespostaRefresh,
    UsuarioCriado,
)

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
@contrato.validate(
    resp=Response(HTTP_201=UsuarioCriado, HTTP_409=Erro, HTTP_500=Erro), tags=['auth'],
)
def registro(json: CorpoRegistro):
    """Registrar novo usuário"""
    params = (
        json.nome_completo,
        json.email,
        generate_password_hash(json.senha),
        json.data_nascimento,
        json.biografia,
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
        return resposta_erro(409, CodigoErro.CONFLITO, 'Email já cadastrado')
    except GrupoPadraoAusente:
        logger.error("Grupo padrão '%s' ausente no banco; cadastro abortado", GRUPO_PADRAO)
        return resposta_erro(500, CodigoErro.ERRO_INTERNO, 'Configuração de grupos inválida')

    return {'mensagem': 'Usuário criado com sucesso!', 'id_usuario': user_id}, 201


@auth_bp.route('/login', methods=['POST'])
@contrato.validate(resp=Response(HTTP_200=RespostaLogin, HTTP_401=Erro, HTTP_403=Erro), tags=['auth'])
def login(json: CorpoLogin):
    """Login de usuário"""
    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email, senha_hash, ativo FROM usuarios WHERE email = %s",
        (json.email,),
    )

    if not usuario or not check_password_hash(usuario['senha_hash'], json.senha):
        return resposta_erro(401, CodigoErro.NAO_AUTENTICADO, 'Email ou senha incorretos')

    if not usuario['ativo']:
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Usuário desativado')

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

    return {
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
    }


@auth_bp.route('/refresh', methods=['POST'])
@contrato.validate(resp=Response(HTTP_200=RespostaRefresh, HTTP_401=Erro, HTTP_403=Erro), tags=['auth'])
def refresh(json: CorpoRefresh):
    """Trocar um refresh token por um par novo de access + refresh (rotação).

    Banco fora do ar não diz nada sobre o token: `Indisponivel` sobe antes de
    qualquer revogação, vira 503, e o app pode tentar de novo com o mesmo refresh.
    """
    token = json.refresh_token
    if not token:
        return _refresh_invalido()

    atual = refresh_token_repository.buscar_por_hash(_hash_refresh(token))
    if not atual:
        return _refresh_invalido()

    if not atual['usuario_ativo']:
        # Antes da checagem de revogado: desativar pela moderação já revoga os
        # refresh do Usuário, e a resposta continua a do login (403). A família
        # é revogada para que reativar a conta exija um login novo.
        refresh_token_repository.revogar_familia(atual['familia'])
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Usuário desativado')

    if atual['revogado']:
        # Já trocado por um sucessor: alguém está reapresentando um token
        # velho. Não dá para saber se é o ladrão ou a vítima, então a
        # família inteira morre. Revogado por logout não tem sucessor e
        # só é recusado.
        if atual['substituido_por']:
            refresh_token_repository.revogar_familia(atual['familia'])
        return _refresh_invalido()

    if atual['expira_em'] <= datetime.now(timezone.utc):
        return resposta_erro(401, CodigoErro.TOKEN_EXPIRADO, 'Refresh token expirado')

    novo_token, novo_hash, expira_em = _novo_refresh()
    if not refresh_token_repository.rotacionar(atual['id_refresh'], novo_hash, expira_em):
        # Outra requisição rotacionou este token entre a leitura e a troca:
        # é o mesmo caso do reuso.
        refresh_token_repository.revogar_familia(atual['familia'])
        return _refresh_invalido()

    return {
        'access_token': create_access_token(identity=atual['id_usuario']),
        'refresh_token': novo_token,
    }


def _refresh_invalido():
    return resposta_erro(401, CodigoErro.TOKEN_INVALIDO, 'Refresh token inválido')


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaMe, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['auth'], security=AUTENTICADO,
)
def obter_usuario_atual():
    """Obter informações do usuário autenticado"""
    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email, foto_perfil FROM usuarios WHERE id_usuario = %s",
        (get_jwt_identity(),),
    )
    if not usuario:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    return {'usuario': usuario}


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=Mensagem, **ERROS_AUTENTICADA), tags=['auth'], security=AUTENTICADO)
def logout(json: CorpoLogout):
    """Fazer logout e revogar o token"""
    _revogar_access(get_jwt())

    # Opcional: o app manda o refresh do aparelho para encerrar a sessão
    # de verdade. Só revoga token do próprio usuário. Sem corpo JSON, `json` é None.
    if json is not None and json.refresh_token:
        refresh_token_repository.revogar(_hash_refresh(json.refresh_token), get_jwt_identity())

    return {'mensagem': 'Logout realizado com sucesso'}


@auth_bp.route('/esqueci-senha', methods=['POST'])
@contrato.validate(resp=Response(HTTP_200=Mensagem), tags=['auth'])
def esqueci_senha(json: CorpoEsqueciSenha):
    """Solicitar redefinição de senha"""
    usuario = consultar_um(
        "SELECT id_usuario, nome_completo, email FROM usuarios WHERE email = %s AND ativo = TRUE",
        (json.email,),
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

    return {'mensagem': 'Se o email existir, você receberá instruções.'}


@auth_bp.route('/redefinir-senha', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_403=Erro, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['auth'], security=AUTENTICADO,
)
def redefinir_senha(json: CorpoRedefinirSenha):
    """Redefinir senha com token de recuperação"""
    claims = get_jwt()
    if claims.get('tipo') != 'recuperacao_senha':
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Token inválido para esta operação')

    alterados = executar(
        "UPDATE usuarios SET senha_hash = %s WHERE id_usuario = %s",
        (generate_password_hash(json.nova_senha), get_jwt_identity()),
    )
    if not alterados:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    # Uso único: o mesmo token não redefine a senha de novo.
    _revogar_access(claims)

    return {'mensagem': 'Senha redefinida com sucesso!'}
