import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persist } from '../db.js';

const router = Router();

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

function queryAll(sql, params) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

router.post('/', (req, res) => {
  const { title, notes, dueDate, priority, isCompleted, source } = req.body;
  if (!source) {
    return res.status(400).json({ error: 'source is required', code: 400 });
  }

  const db = getDb();
  const prefix = source === 'macos' ? 'mac' : 'hm';
  const id = `${prefix}-${uuidv4()}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO todos (id, title, notes, due_date, is_completed, priority, updated_at, source, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title || '', notes || '', dueDate || null, isCompleted ? 1 : 0, priority || 0, now, source, req.device.id]
  );
  persist();

  const todo = { id, title: title || '', notes: notes || '', dueDate: dueDate || null, isCompleted: !!isCompleted, priority: priority || 0, updatedAt: now, deletedAt: null, source };
  req.app.wsPush(req.device, { type: 'todo.created', data: todo, timestamp: now });
  res.status(201).json(todo);
});

router.get('/', (req, res) => {
  const since = req.query.since || '0';
  const rows = queryAll(
    `SELECT id, title, notes, due_date, is_completed, priority, updated_at, deleted_at, source
     FROM todos WHERE updated_at > ?`,
    [since]
  );

  const todos = rows.map(r => ({
    id: r.id, title: r.title, notes: r.notes, dueDate: r.due_date,
    isCompleted: !!r.is_completed, priority: r.priority,
    updatedAt: r.updated_at, deletedAt: r.deleted_at, source: r.source
  }));

  res.json(todos);
});

router.put('/:id', (req, res) => {
  const { fields } = req.body;
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'fields object is required', code: 400 });
  }

  const existing = queryOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found', code: 404 });
  }

  const db = getDb();
  const fieldMap = { title: 1, notes: 2, due_date: 3, is_completed: 4, priority: 5 };
  const current = [existing.title, existing.notes, existing.due_date, existing.is_completed, existing.priority];
  let changed = false;
  const now = new Date().toISOString();
  const newValues = [...current];

  for (const [field, meta] of Object.entries(fields)) {
    const idx = fieldMap[field];
    if (idx === undefined) continue;
    const serverTime = existing.updated_at;
    if (meta.updatedAt > serverTime || (meta.updatedAt === serverTime && meta.deviceId > req.device.id)) {
      newValues[idx - 1] = meta.value;
      changed = true;
    }
  }

  if (!changed) {
    return res.json({
      id: req.params.id, title: existing.title, notes: existing.notes,
      dueDate: existing.due_date, isCompleted: !!existing.is_completed,
      priority: existing.priority, updatedAt: now,
      deletedAt: existing.deleted_at, source: existing.source
    });
  }

  db.run(
    `UPDATE todos SET title=?, notes=?, due_date=?, is_completed=?, priority=?, updated_at=?
     WHERE id=?`,
    [...newValues, now, req.params.id]
  );
  persist();

  const todo = {
    id: req.params.id, title: newValues[0], notes: newValues[1],
    dueDate: newValues[2], isCompleted: !!newValues[3], priority: newValues[4],
    updatedAt: now, deletedAt: existing.deleted_at, source: existing.source
  };
  req.app.wsPush(req.device, { type: 'todo.updated', data: todo, timestamp: now });
  res.json(todo);
});

router.delete('/:id', (req, res) => {
  const existing = queryOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found', code: 404 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  db.run('UPDATE todos SET deleted_at=?, updated_at=? WHERE id=?', [now, now, req.params.id]);
  persist();

  const result = { id: req.params.id, deletedAt: now, updatedAt: now };
  req.app.wsPush(req.device, { type: 'todo.deleted', data: result, timestamp: now });
  res.json(result);
});

export default router;
