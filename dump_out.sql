-- Paxxmo POS SQLite SQL dump
-- Generated at 2026-04-24T21:32:27.862Z
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE product_batches (
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
CREATE TABLE products (
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
CREATE TABLE system_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        barcode TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff',
        name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
COMMIT;
