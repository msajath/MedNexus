const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
if (!username || !password) throw new Error('Mongo application credentials are required');

const appDb = db.getSiblingDB('medibook');
const account = { pwd: password, roles: [{ role: 'readWrite', db: 'medibook' }] };
if (appDb.getUser(username)) {
  appDb.updateUser(username, account);
} else {
  appDb.createUser({ user: username, ...account });
}
