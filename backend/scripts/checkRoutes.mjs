import { pathToFileURL } from 'url';
import path from 'path';
import { readdirSync } from 'fs';

const dir = path.resolve('src/routes');
let bad = 0;

for (const name of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const url = pathToFileURL(path.join(dir, name)).href;
  try {
    await import(url);
    console.log(`OK   ${name}`);
  } catch (err) {
    bad += 1;
    console.log(`ERR  ${name}\n     ${err.message}`);
  }
}

console.log(bad === 0 ? '\nall route modules load' : `\n${bad} module(s) failed`);
process.exit(bad === 0 ? 0 : 1);
