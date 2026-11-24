import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && !process.env.FARESCOPE_SKIP_DOTENV) process.loadEnvFile(envFile);

const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 3000),
    serpapiKey: env.SERPAPI_KEY || '',
    travelpayoutsToken: env.TRAVELPAYOUTS_TOKEN || '',
    serpapiMonthlyLimit: int(env.SERPAPI_MONTHLY_LIMIT, 250),
    serpapiHourlyLimit: int(env.SERPAPI_HOURLY_LIMIT, 50),
    liveCacheMinutes: int(env.LIVE_CACHE_MINUTES, 180),
    calendarCacheMinutes: int(env.CALENDAR_CACHE_MINUTES, 720),
    dbPath: env.DB_PATH || path.join(ROOT, 'data', 'farescope.db'),
    gl: env.SERPAPI_GL || 'in',
    hl: env.SERPAPI_HL || 'en',
    forceDemo: env.DEMO === '1',
  };
}
