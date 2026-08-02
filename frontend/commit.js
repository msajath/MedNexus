const { execSync } = require('child_process');
try {
  const result = execSync('git status', { encoding: 'utf-8' });
  console.log(result);
} catch (e) {
  console.error(e.message);
}
