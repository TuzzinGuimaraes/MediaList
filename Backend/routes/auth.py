"""
Blueprint de Autenticação
Endpoints: registro, login, logout, recuperação de senha, perfil
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta
from database import execute_query, get_db_connection
from decorators import get_user_permissions
from config import token_blocklist

auth_bp = Blueprint('auth', __name__)

# Grupo atribuído a todo novo cadastro. Localizado por nome: a ordem em que o
# schema semeia os grupos não é contrato, e um id fixo transforma qualquer
# reordenação do seed em escalação de privilégio silenciosa.
GRUPO_PADRAO = 'Usuários'

# ============================================
# AUTENTICAÇÃO
# ============================================

@auth_bp.route('/registro', methods=['POST'])
def registro():
    """Registrar novo usuário"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'erro': 'Dados não fornecidos'}), 400

        required_fields = ['nome_completo', 'email', 'senha']
        if not all(field in data for field in required_fields):
            return jsonify({'erro': 'Campos obrigatórios faltando'}), 400

        senha_hash = generate_password_hash(data['senha'])

        query = """
                INSERT INTO usuarios (nome_completo, email, senha_hash, data_nascimento, biografia)
                VALUES (%s, %s, %s, %s, %s)
                """
        params = (
            data['nome_completo'],
            data['email'],
            senha_hash,
            data.get('data_nascimento'),
            data.get('biografia', '')
        )

        connection = get_db_connection()
        if not connection:
            return jsonify({'erro': 'Erro ao conectar ao banco'}), 500

        # Usuário e grupo padrão são criados na mesma transação: um usuário sem
        # grupo não tem permissão alguma, então um cadastro pela metade é pior
        # do que nenhum cadastro.
        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, params)

            cursor.execute("SELECT id_usuario FROM usuarios WHERE email = %s", (data['email'],))
            result = cursor.fetchone()
            if not result:
                connection.rollback()
                return jsonify({'erro': 'Email já cadastrado ou erro ao criar usuário'}), 400

            user_id = result['id_usuario']

            cursor.execute(
                "SELECT id_grupo FROM grupos_usuarios WHERE nome_grupo = %s",
                (GRUPO_PADRAO,),
            )
            grupo = cursor.fetchone()
            if not grupo:
                connection.rollback()
                print(f"Grupo padrão '{GRUPO_PADRAO}' ausente no banco; cadastro abortado")
                return jsonify({'erro': 'Configuração de grupos inválida'}), 500

            cursor.execute(
                "INSERT INTO usuarios_grupos (id_usuario, id_grupo) VALUES (%s, %s)",
                (user_id, grupo['id_grupo']),
            )
            connection.commit()
        except Exception as e:
            connection.rollback()
            print(f"Erro ao criar usuário: {e}")
            return jsonify({'erro': 'Email já cadastrado ou erro ao criar usuário'}), 400
        finally:
            if cursor:
                cursor.close()
            connection.close()

        return jsonify({
            'mensagem': 'Usuário criado com sucesso!',
            'id_usuario': user_id
        }), 201
    except Exception as e:
        print(f"Erro no registro: {e}")
        return jsonify({'erro': 'Erro interno no servidor'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login de usuário"""
    try:
        data = request.get_json()
        if not data or not data.get('email') or not data.get('senha'):
            return jsonify({'erro': 'Email e senha são obrigatórios'}), 400

        query = "SELECT id_usuario, nome_completo, email, senha_hash, ativo FROM usuarios WHERE email = %s"
        result = execute_query(query, (data['email'],))

        if not result:
            return jsonify({'erro': 'Email ou senha incorretos'}), 401

        usuario = result[0]

        if not check_password_hash(usuario['senha_hash'], data['senha']):
            return jsonify({'erro': 'Email ou senha incorretos'}), 401

        if not usuario['ativo']:
            return jsonify({'erro': 'Usuário desativado'}), 403

        permissions = get_user_permissions(usuario['id_usuario'])
        access_token = create_access_token(identity=usuario['id_usuario'])

        # Último acesso é escrito aqui, no único momento em que o usuário de fato
        # acessou o sistema. Antes vinha de um trigger em qualquer UPDATE de
        # `usuarios`, o que fazia editar a biografia contar como acesso.
        update_query = "UPDATE usuarios SET ultimo_acesso = NOW() WHERE id_usuario = %s"
        execute_query(update_query, (usuario['id_usuario'],), fetch=False)

        return jsonify({
            'token': access_token,
            'access_token': access_token,
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
    except Exception as e:
        print(f"Erro no login: {e}")
        return jsonify({'erro': 'Erro interno no servidor'}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def obter_usuario_atual():
    """Obter informações do usuário autenticado"""
    try:
        user_id = get_jwt_identity()
        query = "SELECT id_usuario, nome_completo, email, foto_perfil FROM usuarios WHERE id_usuario = %s"
        result = execute_query(query, (user_id,))

        if not result:
            return jsonify({'erro': 'Usuário não encontrado'}), 404

        return jsonify({'usuario': result[0]}), 200
    except Exception as e:
        print(f"Erro ao obter usuário: {e}")
        return jsonify({'erro': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Fazer logout e revogar o token"""
    try:
        jti = get_jwt()['jti']
        token_blocklist.add(jti)
        return jsonify({'mensagem': 'Logout realizado com sucesso'}), 200
    except Exception as e:
        print(f"Erro no logout: {e}")
        return jsonify({'erro': 'Erro ao fazer logout'}), 500


@auth_bp.route('/esqueci-senha', methods=['POST'])
def esqueci_senha():
    """Solicitar redefinição de senha"""
    try:
        data = request.get_json()
        if not data or not data.get('email'):
            return jsonify({'erro': 'Email é obrigatório'}), 400

        email = data['email']
        query = "SELECT id_usuario, nome_completo, email FROM usuarios WHERE email = %s AND ativo = TRUE"
        result = execute_query(query, (email,))

        if not result:
            return jsonify({
                'mensagem': 'Se o email existir, você receberá instruções.'
            }), 200

        usuario = result[0]
        token_recuperacao = create_access_token(
            identity=usuario['id_usuario'],
            expires_delta=timedelta(hours=1),
            additional_claims={'tipo': 'recuperacao_senha'}
        )

        print(f"\n{'=' * 60}")
        print(f"🔑 TOKEN DE RECUPERAÇÃO: {token_recuperacao}")
        print(f"{'=' * 60}\n")

        return jsonify({
            'mensagem': 'Se o email existir, você receberá instruções.',
            'dev_token': token_recuperacao
        }), 200
    except Exception as e:
        print(f"Erro ao processar recuperação: {e}")
        return jsonify({'erro': 'Erro ao processar solicitação'}), 500


@auth_bp.route('/redefinir-senha', methods=['POST'])
@jwt_required()
def redefinir_senha():
    """Redefinir senha com token de recuperação"""
    try:
        claims = get_jwt()
        if claims.get('tipo') != 'recuperacao_senha':
            return jsonify({'erro': 'Token inválido para esta operação'}), 403

        user_id = get_jwt_identity()
        data = request.get_json()

        if not data or not data.get('nova_senha'):
            return jsonify({'erro': 'Nova senha é obrigatória'}), 400

        nova_senha = data['nova_senha']
        if len(nova_senha) < 6:
            return jsonify({'erro': 'Senha deve ter no mínimo 6 caracteres'}), 400

        senha_hash = generate_password_hash(nova_senha)
        query = "UPDATE usuarios SET senha_hash = %s WHERE id_usuario = %s"
        execute_query(query, (senha_hash, user_id), fetch=False)

        return jsonify({'mensagem': 'Senha redefinida com sucesso!'}), 200
    except Exception as e:
        print(f"Erro ao redefinir senha: {e}")
        return jsonify({'erro': 'Erro ao redefinir senha'}), 500

