import Database from 'better-sqlite3';
import fs from 'fs';

const dbPath = 'test.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
let db = new Database(dbPath);

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

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT
  );
`);
db.prepare("INSERT INTO products (id, name) VALUES ('1', 'Test')").run();

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
console.log("DUMP GENERATED:");
// console.log(dump);

db.close();
fs.unlinkSync(dbPath);
db = new Database(dbPath);

try {
  db.exec(dump);
  console.log("RESTORE SUCCESS");
} catch (e) {
  console.error("RESTORE ERROR:", e);
}
