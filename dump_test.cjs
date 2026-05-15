const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'paxxmo.db');
  console.log("DB Path:", dbPath);
  
  if (!fs.existsSync(dbPath)) {
    // Create DB to simulate
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        module TEXT,
        name TEXT,
        barcode TEXT,
        price REAL,
        cost REAL,
        category TEXT,
        stock INTEGER,
        unit TEXT,
        image TEXT,
        expiry TEXT,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS system_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        barcode TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff',
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS product_batches (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        batch_no TEXT,
        expiry TEXT,
        stock REAL DEFAULT 0,
        cost REAL DEFAULT 0,
        price REAL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);
    db.close();
  }

  const db = new Database(dbPath);
  
  function escapeSqlIdentifier(name = '') {
    return `"${String(name).replace(/"/g, '""')}"`;
  }

  function serializeSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  function buildSqlDump() {
    const lines = [];
    lines.push('-- Paxxmo POS SQLite SQL dump');
    lines.push(`-- Generated at ${new Date().toISOString()}`);
    lines.push('PRAGMA foreign_keys=OFF;');
    lines.push('BEGIN TRANSACTION;');

    const schemaRows = db.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE sql IS NOT NULL
        AND name NOT LIKE 'sqlite_%'
      ORDER BY
        CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END,
        name ASC
    `).all();

    const tableNames = [];
    schemaRows.forEach((row) => {
      lines.push(`${row.sql};`);
      if (row.type === 'table') tableNames.push(row.name);
    });

    tableNames.forEach((tableName) => {
      const safeTable = escapeSqlIdentifier(tableName);
      const columns = db.prepare(`PRAGMA table_info(${safeTable})`).all();
      const columnNames = columns.map((column) => column.name);
      if (!columnNames.length) return;

      const selectColumns = columnNames.map((name) => escapeSqlIdentifier(name)).join(', ');
      const rows = db.prepare(`SELECT ${selectColumns} FROM ${safeTable}`).all();
      const insertColumns = columnNames.map((name) => escapeSqlIdentifier(name)).join(', ');

      rows.forEach((row) => {
        const valuesSql = columnNames.map((name) => serializeSqlValue(row[name])).join(', ');
        lines.push(`INSERT INTO ${safeTable} (${insertColumns}) VALUES (${valuesSql});`);
      });
    });

    lines.push('COMMIT;');
    lines.push('');
    return lines.join('\n');
  }

  const dump = buildSqlDump();
  fs.writeFileSync('dump_out.sql', dump);
  console.log("Dump written to dump_out.sql");
  
  // Test restore
  const restoreDbPath = dbPath + '_test_restore.db';
  if (fs.existsSync(restoreDbPath)) fs.unlinkSync(restoreDbPath);
  const restoreDb = new Database(restoreDbPath);
  try {
    restoreDb.exec(dump);
    console.log("RESTORE SUCCESS");
  } catch(e) {
    console.error("RESTORE ERROR:", e);
  }
  
  app.quit();
});
