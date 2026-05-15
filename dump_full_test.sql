-- Paxxmo POS SQLite SQL dump
-- Generated at 2026-04-24T21:35:58.634Z
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );
CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL,
      expiry TEXT
    );
INSERT INTO "product_batches" ("id", "product_id") VALUES ('b1', 'p1');
INSERT INTO "products" ("id", "name", "price", "expiry") VALUES ('p1', 'Test', 10.5, NULL);
COMMIT;
