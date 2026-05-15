const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'paxxmo_full_test.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  
  let db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL,
      expiry TEXT
    );
    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    INSERT INTO products (id, name, price, expiry) VALUES ('p1', 'Test', 10.5, NULL);
    INSERT INTO product_batches (id, product_id) VALUES ('b1', 'p1');
  `);

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
  fs.writeFileSync('dump_full_test.sql', dump, 'utf8');

  // Now mimic restore
  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  db = new Database(dbPath);
  
  try {
    const sqlContent = fs.readFileSync('dump_full_test.sql', 'utf8');
    db.exec(sqlContent);
    console.log("RESTORE SUCCESS!");
  } catch(e) {
    console.error("RESTORE ERROR:", e.message);
  }
  
  app.quit();
});
