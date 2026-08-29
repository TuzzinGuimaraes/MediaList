# Nota pessoal e Avaliação são conceitos separados

Um usuário pode pontuar a mesma mídia em dois lugares: `lista_usuarios.nota_usuario`
e `avaliacoes.nota`, ambos únicos por usuário e mídia. Isso parece duplicação, mas é
deliberado: a **Nota pessoal** é privada ao acompanhamento do usuário e alimenta as
estatísticas do perfil dele, enquanto a **Avaliação** é a resenha pública (nota, título
e texto) e é a única fonte da `nota_media` da mídia.

Consideramos colapsar as duas em `avaliacoes`, mas isso obrigaria o usuário a escrever
uma resenha pública para registrar uma nota particular. Consequência aceita: as duas
notas podem divergir para o mesmo par usuário/mídia, e isso não é inconsistência —
não devem ser sincronizadas.
