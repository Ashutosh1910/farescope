process.env.FARESCOPE_SKIP_DOTENV = '1';
import { loadConfig } from '../server/config.js';
import { openDb } from '../server/db.js';
import { loadFees } from '../server/fees-file.js';

export const inDays = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function setup(env = {}) {
  const config = loadConfig({ DB_PATH: ':memory:', ...env });
  return { config, db: openDb(':memory:'), fees: loadFees() };
}
