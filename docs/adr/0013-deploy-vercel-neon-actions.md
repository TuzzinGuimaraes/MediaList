# Deploy na Vercel + Neon, com as tarefas agendadas no GitHub Actions

Substitui o ADR-0008. A Oracle exige CNPJ (o "Customer Type" vem fixo em Corporate), então a VM saiu.

O MediaList roda num único projeto **Vercel Hobby** em `medialist.vercel.app`: o web (build estático do Vite) na raiz e o Flask como função Python em `/api/*`, na região `gru1`. Web e API ficam no mesmo domínio, então o cookie `httpOnly` do refresh (ADR-0006) continua first-party, o CORS segue desligado em produção e a CSP mantém `connect-src 'self'`. A CSP e os headers do `nginx.conf` são repetidos no `vercel.json`, mais HSTS; o nginx continua só no compose de dev.

O banco é o **Neon Free** (PostgreSQL 18, sa-east-1). O backend lê `DATABASE_URL` (usuário da aplicação, via pooler) e as migrações e o backup usam `DATABASE_OWNER_URL` (dono, conexão direta). O usuário da aplicação é criado por SQL, não pelo console, porque papéis do console entram no `neon_superuser`; os grants são os mesmos do dev (só DML). O pool do psycopg fica pequeno por instância (`DB_POOL_MIN=0`, `DB_POOL_MAX=3`).

O **GitHub Actions** faz o resto:
- **Deploy** por tag `v*` ou manual: CI verde → `alembic upgrade head` → grants → `vercel deploy --prebuilt --prod`. A integração Git da Vercel fica desligada: sem deploy automático e sem previews, que usariam o banco de produção.
- **Importação** diária no runner, retomando de um cursor por Tipo de mídia guardado no banco. Não cabe nos 300 s de uma função.
- **Backup** semanal: `pg_dump -Fc` cifrado com `age` antes de virar artefato, porque artefatos de repo público são baixáveis por qualquer conta do GitHub. A chave privada fica fora do GitHub.

Sem email em produção (ticket 25 adiado): o admin redefine uma senha por um script local, que gera uma **senha temporária** aleatória de 24 h e obriga a troca no próximo acesso.

O limite de tentativas em `/api/auth/*` é a regra de rate limit do WAF da Vercel. O monitor externo bate em `/api/ping`, que não toca no banco, para não manter a Neon acordada e estourar as horas de compute.

## Considered Options

- **VM Oracle (ADR-0008):** exige CNPJ.
- **VPS pago:** custo mensal num projeto de hobby.
- **Render:** o Postgres grátis expira.
- **Dois projetos Vercel (web e API):** o cookie de refresh viraria cross-site (`SameSite=None`).
- **Integração Git da Vercel:** deploy antes da migração e previews no banco de produção.
- **Flask-Limiter:** contador em memória não vale entre instâncias serverless; exigiria um Redis externo.
- **Senha temporária fixa (`senha123`):** quem soubesse do reset entraria antes do dono.
- **`neon init`/`neon deploy`:** gravaria a URL de produção no `.env` de dev e traria um driver JS.
- **Brevo para email:** exige endereço físico em todo email.

## Consequences

- A Neon suspende o banco após 5 min sem uso; a primeira requisição depois disso é mais lenta.
- Os logs das funções duram pouco no Hobby. Sentry fica para depois.
- Se a regra de rate limit do WAF não sair grátis, o plano B é uma tabela de tentativas no Postgres.
- Trocar para domínio próprio é só configuração na Vercel e na variável de URL do app (EAS).
