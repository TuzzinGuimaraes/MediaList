# O rótulo de estado é validado na aplicação, não no ENUM

`lista_usuarios.status_consumo` é um ENUM plano com os 11 rótulos dos três tipos de
mídia juntos, então o banco sozinho aceita `platinado` num anime. A restrição de que
um rótulo só vale para o seu tipo vive em `Backend/schemas/estado_consumo.py` e é
aplicada nas rotas de lista, onde o tipo da mídia é conhecido.

A alternativa era normalizar o estado no banco (tabela de estados por tipo, ou coluna
de estado abstrato mais coluna de tipo). Rejeitada por ora: exige migração de dados e
reescrita das procedures e views que agregam por status, e o ganho prático — barrar o
rótulo errado antes da escrita — se obtém na aplicação. Se a validação por tipo passar
a ser exigida por outro cliente que não a API, essa decisão deve ser revista.
