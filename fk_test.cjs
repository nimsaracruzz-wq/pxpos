const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = 'fk_test.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
let db = new Database(dbPath);

try {
  db.exec(`
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY
    );
    INSERT INTO product_batches (id, product_id) VALUES ('1', 'p1');
    INSERT INTO products (id) VALUES ('p1');
    COMMIT;
  `);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e.message);
}

db.close();
