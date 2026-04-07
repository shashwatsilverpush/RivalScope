const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'rivalscope.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    // Ensure the directory exists (needed for Railway /data volume on first boot)
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      try { db.exec(stmt + ';'); } catch (e) { /* already exists */ }
    }
    // Migrations for columns added after initial schema
    try { db.exec('ALTER TABLE product_contexts ADD COLUMN known_roles TEXT'); } catch {}
    try { db.exec('ALTER TABLE analyses ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch (_) {}
    try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch {}
    try { db.exec('ALTER TABLE schedules ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT'); } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN reset_token_expires DATETIME'); } catch {}
  }
  return db;
}

module.exports = { getDb };
