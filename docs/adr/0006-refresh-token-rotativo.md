# Refresh token rotativo, com detecção de reuso

O app mobile precisa de uma sessão autenticada que dure semanas, e o access token
JWT dura um dia. Reduzir ou alongar esse JWT não serve: o web não tem refresh e depende
do dia inteiro, e um JWT de semanas não pode ser revogado antes de expirar sem uma
blocklist persistente. Por isso o backend ganha um refresh token à parte, só para quem o
pede: `POST /auth/login` passa a devolver `refresh_token` (os campos antigos não mudam e o
web o ignora) e `POST /auth/refresh` troca um refresh válido por um par novo
`access_token` + `refresh_token`.

O refresh é **opaco**, 256 bits de `secrets`, não um JWT: o que vale é a linha na tabela
`refresh_tokens`, e a tabela guarda **só o hash SHA-256**. Um vazamento do banco não
entrega sessões. SHA-256 sem sal basta porque o token é aleatório, não uma senha que
alguém tente adivinhar. Validade de 30 dias, configurável por `JWT_REFRESH_TOKEN_DAYS`.

Cada renovação **rotaciona**: revoga o token apresentado e grava em `substituido_por` o
sucessor, na mesma `familia`. Cada login abre uma família. Se alguém reapresenta um token
que já foi trocado, uma das duas partes (o app legítimo ou quem copiou o token) está com
uma cópia velha, e o servidor não sabe qual. A família inteira é revogada e a resposta é
401: as duas voltam ao login. A revogação é por família, não por **Usuário**: o reuso
num aparelho não derruba a sessão de outro aparelho, que tem família própria. Duas
renovações concorrentes com o mesmo token caem no mesmo caso, porque a troca trava a
linha (`SELECT ... FOR UPDATE`) e só a primeira encontra o token ainda válido.

`POST /auth/logout` aceita `refresh_token` no corpo e o revoga, se for do próprio
Usuário; sem corpo, o comportamento antigo (blocklist do access token) não muda. Usuário
desativado não renova: recebe 403 `Usuário desativado`, como no login, e a família é
revogada, então reativar a conta exige um login novo.

Consequências aceitas. A blocklist do access token continua em memória: depois de um
logout, o access token revogado volta a valer se o processo reiniciar, até expirar. Isso
não é novo e fica fora deste ADR. Linhas expiradas e revogadas não são apagadas; a tabela
cresce com os logins até que exista uma limpeza. Se o banco ainda não tiver a tabela, o
login funciona e devolve `refresh_token: null`, para que o web não quebre num banco não
migrado. Bancos existentes ganham a tabela com `make db-migrate-refresh` (script
`Banco migracao 0006 refresh tokens.sql`), porque o `Banco DDL.sql` ainda não tem
mecanismo de migração incremental (ADR-0004).
