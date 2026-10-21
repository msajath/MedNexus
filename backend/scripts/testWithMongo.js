const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');

async function main() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { dbName: 'mednexus_qa' } });
  try {
    const child = spawn(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--coverage', ...process.argv.slice(2)], {
      cwd: require('path').resolve(__dirname, '..'), stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', MONGO_TEST_URI: mongo.getUri('mednexus_qa'), JWT_SECRET: 'qa-only-secret-at-least-32-characters', JWT_EXPIRE: '7d' },
    });
    process.exitCode = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  } finally { await mongo.stop(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
