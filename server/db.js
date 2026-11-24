import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      body TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_calls (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS api_calls_provider_at ON api_calls(provider, at);
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_date TEXT NOT NULL,
      return_date TEXT,
      cabin TEXT NOT NULL,
      currency TEXT NOT NULL,
      min_price REAL NOT NULL,
      airline TEXT,
      source TEXT NOT NULL,
      checked_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS price_history_route
      ON price_history(origin, destination, depart_date, return_date, cabin, currency);
  `);

  const q = {
    getCache: db.prepare('SELECT body, fetched_at FROM cache WHERE key = ?'),
    setCache: db.prepare(
      'INSERT INTO cache(key, provider, body, fetched_at) VALUES(?,?,?,?) ' +
        'ON CONFLICT(key) DO UPDATE SET body=excluded.body, fetched_at=excluded.fetched_at'
    ),
    logCall: db.prepare('INSERT INTO api_calls(provider, at) VALUES(?, ?)'),
    countCalls: db.prepare('SELECT COUNT(*) AS n FROM api_calls WHERE provider = ? AND at >= ?'),
    addHistory: db.prepare(
      'INSERT INTO price_history(origin, destination, depart_date, return_date, cabin, currency, min_price, airline, source, checked_at) ' +
        'VALUES(?,?,?,?,?,?,?,?,?,?)'
    ),
    history: db.prepare(
      'SELECT min_price AS price, airline, source, checked_at AS checkedAt FROM price_history ' +
        'WHERE origin=? AND destination=? AND depart_date=? AND IFNULL(return_date,\'\')=? AND cabin=? AND currency=? ' +
        'ORDER BY checked_at ASC LIMIT 200'
    ),
  };

  return {
    raw: db,
    getCache(key, maxAgeMs, now = Date.now()) {
      const row = q.getCache.get(key);
      if (!row || now - row.fetched_at > maxAgeMs) return null;
      return { body: JSON.parse(row.body), fetchedAt: row.fetched_at };
    },
    setCache(key, provider, body, now = Date.now()) {
      q.setCache.run(key, provider, JSON.stringify(body), now);
    },
    logCall(provider, now = Date.now()) {
      q.logCall.run(provider, now);
    },
    countCalls(provider, sinceMs) {
      return q.countCalls.get(provider, sinceMs).n;
    },
    addHistory(h) {
      q.addHistory.run(h.origin, h.destination, h.depart, h.return || null, h.cabin, h.currency,
        h.price, h.airline || null, h.source, h.checkedAt ?? Date.now());
    },
    history(h) {
      return q.history.all(h.origin, h.destination, h.depart, h.return || '', h.cabin, h.currency);
    },
    close() {
      db.close();
    },
  };
}
