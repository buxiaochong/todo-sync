import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { registerDevice, refreshToken, revokeToken, authMiddleware } from './auth.js';
import { setupWebSocket, pushToClients } from './ws.js';
import todosRouter from './routes/todos.js';

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.wsPush = (device, message) => {
  pushToClients(device.token, message);
};

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/register', (req, res) => {
  const { source } = req.body;
  if (!source || !['macos', 'harmony'].includes(source)) {
    return res.status(400).json({ error: 'source must be "macos" or "harmony"', code: 400 });
  }
  const device = registerDevice(source);
  res.status(201).json(device);
});

app.post('/api/token/refresh', authMiddleware, (req, res) => {
  const result = refreshToken(req.device.id);
  if (!result) return res.status(404).json({ error: 'Device not found', code: 404 });
  res.json(result);
});

app.post('/api/token/revoke', authMiddleware, (req, res) => {
  revokeToken(req.device.id);
  res.json({ status: 'ok' });
});

app.use('/api/todos', authMiddleware, todosRouter);

setupWebSocket(wss);

const dbPath = path.join(__dirname, '..', 'data', 'todos.db');
initDb(dbPath).then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
