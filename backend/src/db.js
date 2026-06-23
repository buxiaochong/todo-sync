import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db;

export async function initDb(dbPath) {
  const SQL = await initSqlJs();

  if (dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (fs.existsSync(dbPath)) {
      db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  createTables();
  if (dbPath) persist(dbPath);
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      source TEXT NOT NULL,
      device_id TEXT NOT NULL
    )
  `);
}

export function resetDb() {
  db.run('DROP TABLE IF EXISTS devices');
  db.run('DROP TABLE IF EXISTS todos');
  createTables();
}

function saveDb(dbPath) {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

export function getDb() {
  return db;
}

export function persist(dbPath) {
  if (dbPath) saveDb(dbPath);
}
