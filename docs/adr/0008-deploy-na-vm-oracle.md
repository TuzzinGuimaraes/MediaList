# Deploy numa VM Always Free da Oracle, com o compose inteiro

O MediaList roda em produção numa única VM Always Free da Oracle (2 OCPU ARM e 12 GB), com região de origem no Brasil, usando o mesmo `docker compose` do desenvolvimento em versão de produção. O Caddy termina o HTTPS (Let's Encrypt) num subdomínio grátis do DuckDNS e serve o web em `/` e a API em `/api`, no mesmo domínio e sem CORS entre origens.

As imagens arm64 são construídas em runner arm64 nativo do GitHub Actions e publicadas no GHCR. O deploy é feito por SSH (`pull`, `alembic upgrade head`, `up -d`) e disparado por tag de release ou manualmente. Os backups (`pg_dump` diário, guardando 14 dias) vão para o Cloudflare R2, fora da Oracle. O email transacional sai pelo plano grátis da Brevo, atrás de uma interface no backend.

## Considered Options

- **PaaS grátis (Render, Koyeb):** o backend hiberna após inatividade e o banco precisaria ficar noutro fornecedor.
- **Vercel:** sem banco, com funções de no máximo 300 s no plano Hobby, o que não comporta a Importação. Descartada.
- **VPS pago (US$ 4 a 5 por mês):** a opção de fuga caso a Oracle recupere a VM ou falte capacidade.
- **Backup no Object Storage da Oracle:** cairia junto com a conta.
- **Resend para email:** exige domínio próprio verificado.

## Consequences

- A Oracle recupera instâncias ociosas. A VM roda a Importação periódica e recebe um healthcheck externo para não ficar ociosa.
- Para melhorar a entrega dos emails, comprar um domínio próprio depois e trocar de provedor só por configuração.
- O deploy é manual até o fluxo estar confiável.
