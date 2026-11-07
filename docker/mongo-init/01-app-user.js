// Cria (ou atualiza) o usuário da aplicação no MongoDB, com readWrite só no
// banco do app. O backend conecta com ele; o root fica para administração.
//
// Roda sozinho na primeira subida de um volume novo (docker-entrypoint-initdb.d)
// e, para volumes existentes, via `make mongo-app-user`. Idempotente.
const dbName = process.env.MONGO_DB_NAME || 'medialist_updates_db';
const user = process.env.MONGO_APP_USER || 'medialist_app';
const pwd = process.env.MONGO_APP_PASSWORD || 'medialist-app-dev';
const roles = [{ role: 'readWrite', db: dbName }];

const appDb = db.getSiblingDB(dbName);
if (appDb.getUser(user)) {
  appDb.updateUser(user, { pwd, roles });
  print(`Usuário ${user} atualizado em ${dbName}`);
} else {
  appDb.createUser({ user, pwd, roles });
  print(`Usuário ${user} criado em ${dbName}`);
}
