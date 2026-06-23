import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from './db.js';

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const revokedTokens = new Set();

function queryOne(sql, params) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function registerDevice(source) {
  const db = getDb();
  const id = uuidv4();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

  db.run(
    'INSERT INTO devices (id, token, source, expires_at) VALUES (?, ?, ?, ?)',
    [id, token, source, expiresAt]
  );
  persist();

  return { id, token, expiresAt };
}

export function refreshToken(deviceId) {
  const db = getDb();
  const row = queryOne('SELECT * FROM devices WHERE id = ?', [deviceId]);
  if (!row) return null;

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
  db.run('UPDATE devices SET token = ?, expires_at = ? WHERE id = ?', [token, expiresAt, deviceId]);
  persist();

  return { token, expiresAt };
}

export function revokeToken(deviceId) {
  const db = getDb();
  const row = queryOne('SELECT token FROM devices WHERE id = ?', [deviceId]);
  if (!row) return false;

  revokedTokens.add(row.token);
  db.run('DELETE FROM devices WHERE id = ?', [deviceId]);
  persist();
  return true;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token', code: 401 });
  }

  const token = header.slice(7);
  if (revokedTokens.has(token)) {
    return res.status(401).json({ error: 'Token revoked', code: 401 });
  }

  const row = queryOne('SELECT id, source, expires_at FROM devices WHERE token = ?', [token]);
  if (!row) {
    return res.status(401).json({ error: 'Invalid token', code: 401 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Token expired', code: 401 });
  }

  req.device = { id: row.id, source: row.source, token };
  next();
}
