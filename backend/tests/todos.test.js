import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDb, resetDb } from '../src/db.js';
import { registerDevice, authMiddleware } from '../src/auth.js';
import { setupWebSocket, pushToClients } from '../src/ws.js';
import todosRouter from '../src/routes/todos.js';

let app, server, wss;

function createTestApp() {
  app = express();
  app.use(express.json());
  app.wsPush = (device, message) => pushToClients(device.token, message);
  app.use('/api/todos', authMiddleware, todosRouter);
  return app;
}

function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer(app);
    httpServer.listen(0, () => {
      const port = httpServer.address().port;
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers,
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          httpServer.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

beforeAll(async () => {
  await initDb();
});

describe('Todo CRUD', () => {
  let token;

  beforeEach(async () => {
    resetDb();
    createTestApp();
    const device = registerDevice('macos');
    token = device.token;
  });

  it('should create a todo', async () => {
    const res = await request('POST', '/api/todos',
      { title: 'Buy milk', notes: 'from store', source: 'macos' }, token);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^mac-/);
    expect(res.body.title).toBe('Buy milk');
  });

  it('should create a harmony todo with hm- prefix', async () => {
    const res = await request('POST', '/api/todos',
      { title: 'Harmony todo', source: 'harmony' }, token);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^hm-/);
  });

  it('should reject todo without source', async () => {
    const res = await request('POST', '/api/todos',
      { title: 'No source' }, token);
    expect(res.status).toBe(400);
  });

  it('should list todos with since filter', async () => {
    await request('POST', '/api/todos', { title: 'A', source: 'macos' }, token);
    const res = await request('GET', '/api/todos?since=0', null, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('A');
  });

  it('should update a todo with per-field merge', async () => {
    const created = await request('POST', '/api/todos',
      { title: 'Old title', source: 'macos' }, token);
    const id = created.body.id;

    const res = await request('PUT', `/api/todos/${id}`, {
      fields: {
        title: { value: 'New title', updatedAt: '2026-07-01T00:00:00Z', deviceId: 'mac-test' }
      }
    }, token);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
  });

  it('should reject update with older timestamp', async () => {
    const created = await request('POST', '/api/todos',
      { title: 'Original', source: 'macos' }, token);
    const id = created.body.id;

    const res = await request('PUT', `/api/todos/${id}`, {
      fields: {
        title: { value: 'Too old', updatedAt: '2020-01-01T00:00:00Z', deviceId: 'mac-test' }
      }
    }, token);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Original');
  });

  it('should soft delete a todo', async () => {
    const created = await request('POST', '/api/todos',
      { title: 'Delete me', source: 'macos' }, token);
    const id = created.body.id;

    const res = await request('DELETE', `/api/todos/${id}`, null, token);
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).toBeDefined();

    const getRes = await request('GET', '/api/todos?since=0', null, token);
    const deleted = getRes.body.find(t => t.id === id);
    expect(deleted.deletedAt).not.toBeNull();
  });

  it('should return 404 for non-existent todo update', async () => {
    const res = await request('PUT', '/api/todos/non-existent', {
      fields: { title: { value: 'Nope', updatedAt: '2026-07-01T00:00:00Z', deviceId: 'test' } }
    }, token);
    expect(res.status).toBe(404);
  });

  it('should require auth', async () => {
    const res = await request('POST', '/api/todos',
      { title: 'No auth', source: 'macos' }, '');
    expect(res.status).toBe(401);
  });
});
