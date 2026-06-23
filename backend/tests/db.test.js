import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, getDb, resetDb } from '../src/db.js';

let db;

beforeAll(async () => {
  db = await initDb();
});

describe('Database initialization', () => {
  it('should create db instance', () => {
    expect(db).toBeDefined();
  });

  it('should have devices table', () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'");
    expect(result.length).toBe(1);
  });

  it('should have todos table', () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'");
    expect(result.length).toBe(1);
  });
});

describe('Database operations', () => {
  beforeEach(() => resetDb());

  it('should insert and read a device', () => {
    db.run('INSERT INTO devices (id, token, source, expires_at) VALUES (?, ?, ?, ?)',
      ['dev-1', 'tok-1', 'macos', '2026-07-23T00:00:00Z']);
    const stmt = db.prepare('SELECT * FROM devices WHERE id = ?');
    stmt.bind(['dev-1']);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    expect(row.source).toBe('macos');
  });

  it('should insert and read a todo', () => {
    const now = new Date().toISOString();
    db.run(`INSERT INTO todos (id, title, notes, is_completed, priority, updated_at, source, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mac-uuid-1', 'Test', 'Notes text', 0, 1, now, 'macos', 'dev-1']);

    const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    stmt.bind(['mac-uuid-1']);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    expect(row.title).toBe('Test');
    expect(row.priority).toBe(1);
  });

  it('should update a todo', () => {
    const now = new Date().toISOString();
    db.run(`INSERT INTO todos (id, title, notes, is_completed, priority, updated_at, source, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mac-uuid-2', 'Old', '', 0, 0, now, 'macos', 'dev-1']);

    db.run('UPDATE todos SET title = ?, updated_at = ? WHERE id = ?', ['New', now, 'mac-uuid-2']);

    const stmt = db.prepare('SELECT title FROM todos WHERE id = ?');
    stmt.bind(['mac-uuid-2']);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    expect(row.title).toBe('New');
  });

  it('should soft delete a todo', () => {
    const now = new Date().toISOString();
    db.run(`INSERT INTO todos (id, title, notes, is_completed, priority, updated_at, source, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['mac-uuid-3', 'To delete', '', 0, 0, now, 'macos', 'dev-1']);

    db.run('UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, 'mac-uuid-3']);

    const stmt = db.prepare('SELECT deleted_at FROM todos WHERE id = ?');
    stmt.bind(['mac-uuid-3']);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    expect(row.deleted_at).not.toBeNull();
  });

  it('should query incremental changes', () => {
    const t1 = '2026-01-01T00:00:00Z';
    const t2 = '2026-06-01T00:00:00Z';
    db.run(`INSERT INTO todos (id, title, updated_at, source, device_id) VALUES (?, ?, ?, ?, ?)`,
      ['old', 'Old todo', t1, 'macos', 'dev-1']);
    db.run(`INSERT INTO todos (id, title, updated_at, source, device_id) VALUES (?, ?, ?, ?, ?)`,
      ['new', 'New todo', t2, 'macos', 'dev-1']);

    const stmt = db.prepare('SELECT id, title FROM todos WHERE updated_at > ?');
    stmt.bind(['2026-01-01T00:00:01Z']);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe('new');
  });
});
