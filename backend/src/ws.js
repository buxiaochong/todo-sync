import { getDb } from './db.js';

const clients = new Map();

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

export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    let authed = false;
    let deviceToken = null;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }

      if (!authed) {
        if (msg.type !== 'auth' || !msg.token) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Auth required' }));
        }
        const row = queryOne('SELECT id, source FROM devices WHERE token = ?', [msg.token]);
        if (!row) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        }
        authed = true;
        deviceToken = msg.token;
        clients.set(deviceToken, ws);
        ws.send(JSON.stringify({ type: 'auth', status: 'ok' }));
        return;
      }
    });

    const cleanup = () => {
      if (deviceToken) clients.delete(deviceToken);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });
}

export function pushToClients(skipDevice, message) {
  for (const [token, ws] of clients) {
    if (token === skipDevice) continue;
    try {
      ws.send(JSON.stringify(message));
    } catch {
      clients.delete(token);
    }
  }
}
