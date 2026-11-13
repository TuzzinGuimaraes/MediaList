"""
Decoradores para verificação de permissões
"""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from banco import consultar_um

# Permissões de quem não tem grupo nenhum. A ausência de grupo nunca concede
# mais do que a presença de um: sem grupo, sem poder.
SEM_PERMISSOES = {
    'nivel_acesso': 'usuario',
    'grupos': None,
    'pode_criar': 0,
    'pode_editar': 0,
    'pode_deletar': 0,
    'pode_moderar': 0,
}


def get_user_permissions(user_id):
    """Permissões efetivas do usuário, compondo todos os seus grupos.

    Vence o mais privilegiado: o usuário tem um poder se qualquer grupo seu o
    concede, e o nível efetivo é o mais alto entre os grupos. O nível é
    ordenado explicitamente: MAX() sobre o texto ordenaria alfabeticamente.
    """
    query = """
        SELECT CASE MAX(CASE gu.nivel_acesso
                            WHEN 'admin' THEN 3
                            WHEN 'moderador' THEN 2
                            WHEN 'usuario' THEN 1
                            ELSE 0
                        END)
                   WHEN 3 THEN 'admin'
                   WHEN 2 THEN 'moderador'
                   ELSE 'usuario'
               END as nivel_acesso,
               string_agg(DISTINCT gu.nome_grupo, ', ') as grupos,
               MAX(CASE WHEN gu.pode_criar = TRUE THEN 1 ELSE 0 END) as pode_criar,
               MAX(CASE WHEN gu.pode_editar = TRUE THEN 1 ELSE 0 END) as pode_editar,
               MAX(CASE WHEN gu.pode_deletar = TRUE THEN 1 ELSE 0 END) as pode_deletar,
               MAX(CASE WHEN gu.pode_moderar = TRUE THEN 1 ELSE 0 END) as pode_moderar
        FROM usuarios u
                 LEFT JOIN usuarios_grupos ug ON u.id_usuario = ug.id_usuario
                 LEFT JOIN grupos_usuarios gu ON ug.id_grupo = gu.id_grupo
        WHERE u.id_usuario = %s
        GROUP BY u.id_usuario
    """
    result = consultar_um(query, (user_id,))

    # Usuário inexistente ou sem grupo: nada é concedido. Banco fora do ar
    # levanta (503), em vez de virar "sem permissão".
    if not result or not result['grupos']:
        return dict(SEM_PERMISSOES)

    return result


def permission_required(permission_name):
    """Decorator para verificar permissões específicas"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            permissions = get_user_permissions(user_id)

            if not permissions:
                return jsonify({'erro': 'Usuário não encontrado'}), 404

            # Admin tem todas as permissões
            if permissions.get('nivel_acesso') == 'admin':
                return f(*args, **kwargs)

            # Verifica permissão específica
            permission_map = {
                'criar': 'pode_criar',
                'editar': 'pode_editar',
                'deletar': 'pode_deletar',
                'moderar': 'pode_moderar'
            }

            if permission_name in permission_map:
                if not permissions.get(permission_map[permission_name]):
                    return jsonify({'erro': f'Sem permissão para {permission_name}'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def moderator_or_admin_required(f):
    """Decorator para verificar se é moderador ou admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        permissions = get_user_permissions(user_id)

        if not permissions:
            return jsonify({'erro': 'Usuário não encontrado'}), 404

        if permissions.get('nivel_acesso') == 'admin' or permissions.get('pode_moderar'):
            return f(*args, **kwargs)

        return jsonify({'erro': 'Acesso restrito a moderadores e administradores'}), 403

    return decorated_function

