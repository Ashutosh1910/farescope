import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

/** Read data/fees.json fresh, so edits apply on the next server start. */
export function loadFees(file = path.join(ROOT, 'data', 'fees.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
