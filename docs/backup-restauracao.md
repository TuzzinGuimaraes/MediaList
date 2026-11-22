# Backup e restauração do banco (runbook)

O workflow `backup` roda aos domingos às 05:00 UTC (e manualmente). Ele faz `pg_dump -Fc` com a `DATABASE_OWNER_URL` e cifra o dump com `age -r $BACKUP_AGE_RECIPIENT` antes de gravar o artefato `backup-<run_id>`, que fica 90 dias (ADR-0013). O dump em claro só passa pelo pipe. O script é `.github/scripts/backup-cifrado.sh`.

A chave privada do age fica fora do GitHub, com o admin. Sem ela o backup não serve para nada.

## Erro recente: instant restore da Neon

Para desfazer um `DELETE`, uma migração ruim ou um import errado das últimas horas, use o instant restore (PITR) da Neon antes do backup. O plano Free guarda 6 h de histórico (até 1 GB de mudanças). Ver [History window](https://neon.com/docs/postgres/backup-restore/history-window).

1. Console da Neon → projeto → **Backup & restore** (ou **Branches** → branch `main` → **Restore**).
2. Escolha o horário de antes do incidente. Para conferir primeiro, crie um branch a partir desse ponto e consulte-o com a URL dele, sem mexer na `main`.
3. Restaure a `main`. A Neon guarda o estado anterior num branch de backup (`main_old_<data>`), que pode ser apagado depois de conferir. As conexões abertas caem por alguns segundos.

## Erro antigo (mais de 6 h): backup semanal

Precisa do `gh` autenticado e do `age` (a mesma versão do workflow, `AGE_VERSION` em `.github/workflows/backup.yml`).

1. Baixe o artefato do último backup:

   ```sh
   gh run list --workflow backup --limit 5
   gh run download <run_id> --name backup-<run_id> --dir /tmp/backup
   ```

2. Restaure no Postgres local do compose. O `make` decifra e restaura pelo pipe, sem gravar o dump em claro, e substitui o conteúdo do banco local:

   ```sh
   make db-restore-cifrado ARQ=/tmp/backup/medialist_<data>.dump.age CHAVE=/caminho/chave-age.txt
   ```

   Os grants da Neon ficam de fora (`--no-acl`). O usuário da aplicação recebe os dele pelos default privileges do dono.

3. Confira os dados (`make db-shell`). Para voltar com eles à Neon, restaure num branch novo e só depois promova esse branch:

   ```sh
   age -d -i /caminho/chave-age.txt /tmp/backup/medialist_<data>.dump.age \
     | docker run -i --rm -e URL="<url do dono do branch novo>" postgres:18.6 \
       sh -c 'exec pg_restore -d "$URL" --clean --if-exists --no-owner --exit-on-error'
   ```

   Depois rode o workflow `db-grants` contra esse banco.

4. Apague `/tmp/backup` ao terminar.

## Teste da restauração

Feito em 2026-11 (ticket 06 da spec `producao`): num stack descartável do compose, o `backup-cifrado.sh` gerou o dump cifrado, `make db-restore-cifrado` restaurou depois de apagar tabelas, e a contagem de tabelas e linhas bateu. Com a chave errada, o `make` falha.
