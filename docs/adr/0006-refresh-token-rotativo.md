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

Falha de infraestrutura não é reuso. Se o banco não responde na busca ou na rotação, o
servidor não sabe nada sobre o token: responde 500 e não revoga nada, e o app pode
tentar de novo com o mesmo refresh. O repositório separa os casos de forma explícita:
`None` é "não existe" ou "já rotacionado"; falha de banco levanta
`RefreshTokenIndisponivel`. Só o primeiro caso revoga a família.

`POST /auth/logout` aceita `refresh_token` no corpo e o revoga, se for do próprio
Usuário; sem corpo, o comportamento antigo (blocklist do access token) não muda. Usuário
desativado não renova: recebe 403 `Usuário desativado`, como no login, e a família é
revogada, então reativar a conta exige um login novo.

Consequências aceitas. Linhas expiradas e revogadas não são apagadas; a tabela
cresce com os logins até que exista uma limpeza. Se o banco ainda não tiver a tabela, o
login funciona e devolve `refresh_token: null`, para que o web não quebre num banco não
migrado. A tabela está na baseline das migrações em `Backend/migrations` (ADR-0007), que
substituíram o `Banco DDL.sql` e o script avulso `Banco migracao 0006 refresh tokens.sql`.

## Blocklist persistida e Usuário sem acesso (ticket 26)

A blocklist do access token saiu da memória do processo para a tabela
`access_tokens_revogados` (`jti`, `expira_em`; migração 0004). Logout e o token de
recuperação de senha já usado gravam o `jti` com a expiração do próprio JWT, e o
`token_in_blocklist_loader` consulta a tabela. O logout vale entre os workers do gunicorn
e depois de um restart. A limpeza vai junto de cada gravação: um `DELETE` das linhas com
`expira_em` vencido, pelo índice. Não há rotina à parte, e `DELETE`s concorrentes de dois
workers só apagam o que já não vale.

Toda rota com `@jwt_required` carrega o Usuário do token (`user_lookup_loader`, uma
consulta por id com `ativo`). Usuário inexistente, desativado ou com identidade que nem é
uuid (token de antes de uma troca de banco) recebe **401**, não 400 de FK nem 403. Para os
clientes isso é sessão encerrada: o app tenta o refresh e, recusado, volta ao login; o web
desloga no 401. Com o banco fora a consulta levanta e a resposta é 503, sem deslogar.

O refresh segue a mesma regra. Usuário apagado leva os refresh tokens junto (`ON DELETE
CASCADE`), então o refresh responde 401 `Refresh token inválido`. Usuário desativado
recebe 403, como acima. Desativar pela moderação revoga os refresh do Usuário na mesma
transação: o access token já é recusado pelo `ativo`, e reativar não ressuscita a sessão
(o access ainda não expirado volta a valer; o refresh, não).

Custo aceito: duas consultas leves por requisição autenticada (blocklist e Usuário), sem
cache. Um cache curto pode entrar se a carga pedir.

## Web com o refresh num cookie httpOnly (Q79 do ticket 19)

O web novo guardava o refresh no `localStorage`, legível por qualquer script injetado. Agora
o refresh do web vai num cookie, e o do app continua no corpo.

- **Como o web se identifica:** o cabeçalho `X-Cliente: web` em login, refresh e logout. Foi
  escolhido no lugar de um campo no corpo porque o mesmo cabeçalho serve de proteção CSRF: um
  formulário ou um `<img>` de outro site manda o cookie, mas não um cabeçalho próprio, e um
  `fetch` de outra origem com esse cabeçalho precisa passar pelo preflight do CORS, que em
  produção está desligado.
- **Cookie `medialist_refresh`:** `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Max-Age`
  igual à validade do refresh e `Secure` fora de `APP_ENV=development` (em dev o web roda em
  `http://localhost`).
- **Login:** com o cabeçalho, grava o cookie e devolve `refresh_token: null`.
- **Refresh:** com o cabeçalho, lê só o cookie (o corpo é ignorado), grava o sucessor e devolve
  `refresh_token: null`. Se recusar (401/403), apaga o cookie; um 5xx não toca nele. Sem o
  cabeçalho, o cookie é ignorado e vale o corpo, como antes.
- **Logout:** com o cabeçalho, revoga o refresh do cookie e apaga o cookie.

A rotação, a detecção de reuso e a revogação por família não mudam: o valor do cookie é o mesmo
token opaco. O cookie é compartilhado entre as abas, então duas renovações simultâneas ainda
contariam como reuso; o web mantém a trava entre abas (Web Locks) em volta do refresh. O access
continua só em memória. No `localStorage` o web guarda só uma marca sem segredo, para saber ao
abrir se vale tentar o refresh e para avisar as outras abas do logout.

Em dev o Vite faz proxy de `/api`, então o web e a API ficam na mesma origem e o cookie anda
sem CORS. Em produção o nginx serve os dois na mesma origem e manda uma CSP
(`Web/nginx.conf`) que limita de onde vêm scripts, imagens e conexões.

Mudança de contrato: `RespostaRefresh.refresh_token` passou a aceitar null (o app nunca o recebe
nulo, porque não manda o cabeçalho).
