const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
if (!username || !password) throw new Error('Mongo application credentials are required');

// This initializer is mounted only by the isolated local-development stack.
const appDb = db.getSiblingDB('mednexus_development');
const account = { pwd: password, roles: [{ role: 'readWrite', db: 'mednexus_development' }] };
if (appDb.getUser(username)) {
  appDb.updateUser(username, account);
} else {
  appDb.createUser({ user: username, ...account });
}
