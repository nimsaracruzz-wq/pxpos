import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import os from 'os';
import { buildThermalProfile as buildThermalProfileShared } from '../src/lib/thermalPrinter.js';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const localBackupPath = path.join(app.getPath('userData'), 'paxxmo-local-backup.json');

// ─── Database Init ──────────────────────────────────────────────────────────
const dbPath = path.join(app.getPath('userData'), 'paxxmo.db');
let db = new Database(dbPath);

// Helper: SHA-256 hash for passwords
function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

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

function normalizeBarcodeValue(barcode) {
  return String(barcode || '').trim().replace(/\s+/g, '').toLowerCase();
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

// ─── Schema ─────────────────────────────────────────────────────────────────
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

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receipt_no TEXT,
    date TEXT,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    service_charge REAL DEFAULT 0,
    total REAL DEFAULT 0,
    payment_method TEXT,
    payment_ref TEXT,
    change_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'completed',
    source TEXT DEFAULT 'grocery',
    cashier TEXT,
    customer_id TEXT,
    note TEXT,
    is_refunded INTEGER DEFAULT 0,
    refund_of TEXT,
    refund_reason TEXT,
    original_receipt_no TEXT,
    items_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    total_purchases REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    type TEXT DEFAULT 'retail',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS restaurant_tables (
    id TEXT PRIMARY KEY,
    number INTEGER,
    seats INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available',
    order_json TEXT,
    waiter TEXT,
    qr_token TEXT,
    session_id TEXT,
    guests INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kots (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    table_number INTEGER,
    items_json TEXT,
    status TEXT DEFAULT 'pending',
    time TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    dish_id TEXT PRIMARY KEY,
    ingredients_json TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS el_products (
    id TEXT PRIMARY KEY,
    name TEXT,
    brand TEXT,
    category TEXT,
    barcode TEXT,
    cost REAL DEFAULT 0,
    price REAL DEFAULT 0,
    warranty_months INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS el_serials (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    serial TEXT,
    imei TEXT,
    status TEXT DEFAULT 'in_stock',
    supplier_id TEXT,
    grn_id TEXT,
    sold_at TEXT,
    sale_id TEXT,
    customer_id TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS el_suppliers (
    id TEXT PRIMARY KEY,
    name TEXT,
    contact TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS el_grns (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    date TEXT,
    invoice_no TEXT,
    items_json TEXT,
    status TEXT DEFAULT 'received',
    notes TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS el_sales (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    date TEXT,
    items_json TEXT,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'completed',
    receipt_no TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS repair_jobs (
    id TEXT PRIMARY KEY,
    job_no TEXT,
    customer_id TEXT,
    device_info TEXT,
    problem TEXT,
    status TEXT DEFAULT 'received',
    estimated_cost REAL DEFAULT 0,
    final_cost REAL DEFAULT 0,
    received_date TEXT,
    completed_date TEXT,
    notified INTEGER DEFAULT 0,
    job_type TEXT DEFAULT 'custom',
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS el_customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS warranties (
    id TEXT PRIMARY KEY,
    sale_id TEXT,
    serial_id TEXT,
    product_id TEXT,
    product_name TEXT,
    serial TEXT,
    imei TEXT,
    customer_id TEXT,
    warranty_months INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS warranty_claims (
    id TEXT PRIMARY KEY,
    warranty_id TEXT,
    sale_id TEXT,
    customer_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    claimed_at TEXT,
    resolved_at TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS grns (
    id TEXT PRIMARY KEY,
    data_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT,
    amount REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    description TEXT,
    ref TEXT,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    details TEXT,
    user_name TEXT,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed default users if table is empty ───────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM system_users').get();
if (userCount.cnt === 0) {
  const insert = db.prepare(`
    INSERT INTO system_users (id, username, password_hash, barcode, role, name)
    VALUES (@id, @username, @password_hash, @barcode, @role, @name)
  `);
  const defaults = [
    { id: 'u1', username: 'superadmin', password_hash: hashPassword('Admin@1234'), barcode: 'DEV-0000', role: 'super_admin', name: 'Super Admin (Developer)' },
    { id: 'u2', username: 'admin',      password_hash: hashPassword('Admin@1234'), barcode: 'OWN-1234',  role: 'owner',       name: 'Store Owner' },
    { id: 'u3', username: 'manager',    password_hash: hashPassword('Manager@123'), barcode: 'MGR-5678', role: 'manager',     name: 'Store Manager' },
    { id: 'u4', username: 'cashier',    password_hash: hashPassword('Staff@111'),   barcode: 'STF-1111', role: 'staff',       name: 'Cashier / Staff' },
  ];
  defaults.forEach(u => insert.run(u));
}

// Ensure the default barcodes match the USER-{role}-{id} format
// generated by generateUserBarcode() in UserBarcodeGenerator.jsx.
// Formula: `USER-${role}-${id}`  — must stay in sync with that file.
try {
  db.prepare("UPDATE system_users SET barcode = 'USER-super_admin-u1' WHERE username = 'superadmin'").run();
  db.prepare("UPDATE system_users SET barcode = 'USER-owner-u2'       WHERE username = 'admin'").run();
  db.prepare("UPDATE system_users SET barcode = 'USER-manager-u3'     WHERE username = 'manager'").run();
  db.prepare("UPDATE system_users SET barcode = 'USER-staff-u4'       WHERE username = 'cashier'").run();
} catch(e) {}

// ─── User IPC Handlers ──────────────────────────────────────────────────────

// Login — returns user object (without hash) or null
ipcMain.handle('auth-login', (event, { username, password }) => {
  const hash = hashPassword(password);
  const user = db.prepare(`
    SELECT id, username, barcode, role, name FROM system_users
    WHERE username = ? AND password_hash = ? AND active = 1
  `).get(username, hash);
  return user || null;
});

// Barcode login — scan ID badge, no password needed
ipcMain.handle('auth-barcode', (event, { barcode }) => {
  const normalizedBarcode = normalizeBarcodeValue(barcode);
  if (!normalizedBarcode) return null;
  const user = db.prepare(`
    SELECT id, username, barcode, role, name FROM system_users
    WHERE LOWER(REPLACE(TRIM(barcode), ' ', '')) = ? AND active = 1
  `).get(normalizedBarcode);
  return user || null;
});

// Get all users (no password hashes)
ipcMain.handle('users-get-all', () => {
  return db.prepare(`
    SELECT id, username, barcode, role, name, active, created_at FROM system_users ORDER BY created_at ASC
  `).all().map(u => ({ ...u, active: u.active === 1 }));
});

function generateSecureBarcode(id, role) {
  // Extract first 2-3 characters from UUID (after removing dashes) and convert to lowercase
  // Format: USER-{role}-{shortId}
  // Examples: USER-manager-u3, USER-staff-a7, USER-admin-b2
  const shortId = String(id).replace(/-/g, '').substring(0, 2).toLowerCase();
  const roleStr = String(role || 'staff').toLowerCase();
  return `USER-${roleStr}-${shortId}`;
}

// Add user
ipcMain.handle('users-add', (event, { id, username, password, barcode, role, name }) => {
  try {
    // Auto-generate simple barcode if not provided
    const generatedBarcode = barcode || generateSecureBarcode(id, role)
    db.prepare(`
      INSERT INTO system_users (id, username, password_hash, barcode, role, name)
      VALUES (@id, @username, @password_hash, @barcode, @role, @name)
    `).run({ id, username, password_hash: hashPassword(password), barcode: normalizeBarcodeValue(generatedBarcode) || null, role, name });
    return { success: true };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return { success: false, error: 'Username or barcode already exists' };
    return { success: false, error: e.message };
  }
});

// Update user (optionally change password)
ipcMain.handle('users-update', (event, { id, updates }) => {
  try {
    const allowed = ['username', 'barcode', 'role', 'name', 'active'];
    const fields = [];
    const params = { id };
    allowed.forEach(k => {
      if (updates[k] !== undefined) {
        fields.push(`${k} = @${k}`);
        params[k] = k === 'active' ? (updates[k] ? 1 : 0) : updates[k];
      }
    });
    if (updates.password) {
      fields.push('password_hash = @password_hash');
      params.password_hash = hashPassword(updates.password);
    }
    if (updates.barcode !== undefined) {
      params.barcode = normalizeBarcodeValue(updates.barcode) || null;
    }
    if (!fields.length) return { success: true };
    db.prepare(`UPDATE system_users SET ${fields.join(', ')} WHERE id = @id`).run(params);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Delete user
ipcMain.handle('users-delete', (event, { id }) => {
  db.prepare('DELETE FROM system_users WHERE id = ?').run(id);
  return { success: true };
});

// ─── Device Fingerprint ─────────────────────────────────────────────────────
// Returns a stable hardware ID for this machine — used for license locking.
// Same machine always returns the same ID.
function getMachineDeviceId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || 'cpu',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      if (entry.family !== 'IPv4') return;
      if (!entry.address) return;
      ips.push(entry.address);
    });
  });

  return Array.from(new Set(ips));
}

function getMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      if (!entry.mac || entry.mac === '00:00:00:00:00:00') return;
      macs.push(String(entry.mac).toLowerCase());
    });
  });

  return Array.from(new Set(macs));
}

ipcMain.handle('get-device-id', () => {
  return getMachineDeviceId();
});

ipcMain.handle('get-device-metadata', () => {
  const ipAddresses = getLocalIPv4Addresses();
  const macAddresses = getMacAddresses();
  return {
    deviceId: getMachineDeviceId(),
    hostname: os.hostname(),
    ipAddresses,
    lastIp: ipAddresses[0] || '',
    macAddresses,
    lastMac: macAddresses[0] || '',
  };
});

// ─── Product IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('get-products', () => {
  return db.prepare('SELECT * FROM products').all().map(p => ({
    ...p,
    active: p.active === 1,
    variants: []
  }));
});

ipcMain.handle('add-product', (event, product) => {
  const stmt = db.prepare(`
    INSERT INTO products (id, module, name, barcode, price, cost, category, stock, unit, image, expiry, active)
    VALUES (@id, @module, @name, @barcode, @price, @cost, @category, @stock, @unit, @image, @expiry, @active)
    ON CONFLICT(id) DO UPDATE SET
      module = excluded.module,
      name = excluded.name,
      barcode = excluded.barcode,
      price = excluded.price,
      cost = excluded.cost,
      category = excluded.category,
      stock = excluded.stock,
      unit = excluded.unit,
      image = excluded.image,
      expiry = excluded.expiry,
      active = excluded.active
  `);
  stmt.run({
    ...product,
    active: product.active ? 1 : 0,
    image: product.image || null,
    expiry: product.expiry || null,
    barcode: product.barcode || null
  });
  return product;
});

ipcMain.handle('update-product', (event, id, updates) => {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  if (!fields) return;
  const stmt = db.prepare(`UPDATE products SET ${fields} WHERE id = @id`);
  stmt.run({ ...updates, id, active: updates.active ? 1 : 0 });
});

ipcMain.handle('delete-product', (event, id) => {
  const stmt = db.prepare(`DELETE FROM products WHERE id = @id`);
  stmt.run({ id });
});

// ─── Sales IPC Handlers ─────────────────────────────────────────────────────
ipcMain.handle('get-sales', () => {
  return db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all().map(s => ({
    ...s,
    is_refunded: s.is_refunded === 1,
    cartItems: (() => { try { return JSON.parse(s.items_json || '[]') } catch(_) { return [] } })(),
    items_detail: (() => { try { return JSON.parse(s.items_json || '[]') } catch(_) { return [] } })(),
  }));
});

ipcMain.handle('add-sale', (event, sale) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO sales (
        id, receipt_no, date, subtotal, discount, tax, service_charge, total,
        payment_method, payment_ref, change_amount, status, source, cashier,
        customer_id, note, is_refunded, refund_of, refund_reason, original_receipt_no,
        items_json, created_at
      ) VALUES (
        @id, @receipt_no, @date, @subtotal, @discount, @tax, @service_charge, @total,
        @payment_method, @payment_ref, @change_amount, @status, @source, @cashier,
        @customer_id, @note, @is_refunded, @refund_of, @refund_reason, @original_receipt_no,
        @items_json, @created_at
      ) ON CONFLICT(id) DO UPDATE SET
        status         = excluded.status,
        is_refunded    = excluded.is_refunded,
        refund_of      = excluded.refund_of,
        refund_reason  = excluded.refund_reason,
        payment_ref    = excluded.payment_ref
    `);
    const cartItems = Array.isArray(sale.cartItems) ? sale.cartItems
      : Array.isArray(sale.items_detail) ? sale.items_detail : [];
    stmt.run({
      id:                  String(sale.id || ''),
      receipt_no:          String(sale.receiptNo || ''),
      date:                sale.date ? new Date(sale.date).toISOString() : new Date().toISOString(),
      subtotal:            Number(sale.subtotal || 0),
      discount:            Number(sale.discount || 0),
      tax:                 Number(sale.tax || 0),
      service_charge:      Number(sale.serviceCharge || 0),
      total:               Number(sale.total || 0),
      payment_method:      String(sale.paymentMethod || 'cash'),
      payment_ref:         sale.paymentRef || null,
      change_amount:       Number(sale.change || 0),
      status:              String(sale.status || 'completed'),
      source:              String(sale.source || 'grocery'),
      cashier:             sale.cashier || null,
      customer_id:         sale.customerId || null,
      note:                sale.note || null,
      is_refunded:         sale.isRefunded ? 1 : 0,
      refund_of:           sale.refundOf || null,
      refund_reason:       sale.refundReason || null,
      original_receipt_no: sale.originalReceiptNo || null,
      items_json:          JSON.stringify(cartItems),
      created_at:          sale.date ? new Date(sale.date).toISOString() : new Date().toISOString(),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-sale', (event, id, updates) => {
  try {
    const allowed = ['status', 'is_refunded', 'refund_of', 'refund_reason', 'payment_ref'];
    const fields = [];
    const params = { id };
    allowed.forEach(k => {
      if (updates[k] !== undefined) {
        fields.push(`${k} = @${k}`);
        params[k] = k === 'is_refunded' ? (updates[k] ? 1 : 0) : updates[k];
      }
    });
    // Also allow camelCase keys from the store
    if (updates.isRefunded !== undefined)   { fields.push('is_refunded = @is_refunded');   params.is_refunded   = updates.isRefunded ? 1 : 0; }
    if (updates.refundOf !== undefined)     { fields.push('refund_of = @refund_of');       params.refund_of     = updates.refundOf || null; }
    if (updates.refundReason !== undefined) { fields.push('refund_reason = @refund_reason'); params.refund_reason = updates.refundReason || null; }
    if (updates.paymentRef !== undefined)   { fields.push('payment_ref = @payment_ref');   params.payment_ref   = updates.paymentRef || null; }
    if (updates.paymentStatus !== undefined){ fields.push('status = @status');             params.status        = updates.paymentStatus || updates.status || 'completed'; }
    if (!fields.length) return { success: true };
    db.prepare(`UPDATE sales SET ${fields.join(', ')} WHERE id = @id`).run(params);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Customer IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('get-customers', () => {
  return db.prepare('SELECT * FROM customers ORDER BY name ASC').all().map(c => ({
    id:             c.id,
    name:           c.name,
    phone:          c.phone || '',
    email:          c.email || '',
    totalPurchases: c.total_purchases || 0,
    credit:         c.credit || 0,
    type:           c.type || 'retail',
  }));
});

ipcMain.handle('add-customer', (event, customer) => {
  try {
    db.prepare(`
      INSERT INTO customers (id, name, phone, email, total_purchases, credit, type)
      VALUES (@id, @name, @phone, @email, @total_purchases, @credit, @type)
      ON CONFLICT(id) DO UPDATE SET
        name            = excluded.name,
        phone           = excluded.phone,
        email           = excluded.email,
        total_purchases = excluded.total_purchases,
        credit          = excluded.credit,
        type            = excluded.type
    `).run({
      id:             String(customer.id || ''),
      name:           String(customer.name || ''),
      phone:          customer.phone || null,
      email:          customer.email || null,
      total_purchases: Number(customer.totalPurchases || 0),
      credit:         Number(customer.credit || 0),
      type:           String(customer.type || 'retail'),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-customer', (event, id, updates) => {
  try {
    const colMap = {
      name: 'name', phone: 'phone', email: 'email',
      totalPurchases: 'total_purchases', credit: 'credit', type: 'type',
    };
    const fields = [];
    const params = { id };
    Object.entries(updates).forEach(([k, v]) => {
      const col = colMap[k]
      if (col) { fields.push(`${col} = @${col}`); params[col] = v; }
    });
    if (!fields.length) return { success: true };
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = @id`).run(params);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-customer', (event, id) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = @id').run({ id });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Restaurant Tables & KOT IPC Handlers ─────────────────────────────────────────────────
ipcMain.handle('get-tables', () => {
  return db.prepare('SELECT * FROM restaurant_tables ORDER BY number ASC').all().map(t => ({
    id: t.id, number: t.number, seats: t.seats, status: t.status,
    order: t.order_json ? JSON.parse(t.order_json) : null,
    waiter: t.waiter, qrToken: t.qr_token, sessionId: t.session_id, guests: t.guests || 0,
  }))
})

ipcMain.handle('upsert-table', (event, table) => {
  try {
    db.prepare(`
      INSERT INTO restaurant_tables (id, number, seats, status, order_json, waiter, qr_token, session_id, guests, updated_at)
      VALUES (@id, @number, @seats, @status, @order_json, @waiter, @qr_token, @session_id, @guests, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        number = excluded.number, seats = excluded.seats, status = excluded.status,
        order_json = excluded.order_json, waiter = excluded.waiter, qr_token = excluded.qr_token,
        session_id = excluded.session_id, guests = excluded.guests, updated_at = excluded.updated_at
    `).run({
      id: String(table.id || ''), number: Number(table.number || 0), seats: Number(table.seats || 4),
      status: String(table.status || 'available'),
      order_json: table.order ? JSON.stringify(table.order) : null,
      waiter: table.waiter || null, qr_token: table.qrToken || null,
      session_id: table.sessionId || null, guests: Number(table.guests || 0),
      updated_at: new Date().toISOString(),
    })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('delete-table', (event, id) => {
  try {
    db.prepare('DELETE FROM restaurant_tables WHERE id = @id').run({ id })
    db.prepare('DELETE FROM kots WHERE table_id = @id').run({ id })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('get-kots', () => {
  return db.prepare('SELECT * FROM kots ORDER BY created_at DESC').all().map(k => ({
    id: k.id, tableId: k.table_id, tableNumber: k.table_number, status: k.status, time: k.time,
    items: k.items_json ? JSON.parse(k.items_json) : [],
  }))
})

ipcMain.handle('add-kot', (event, kot) => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO kots (id, table_id, table_number, items_json, status, time, created_at)
      VALUES (@id, @table_id, @table_number, @items_json, @status, @time, @created_at)
    `).run({
      id: String(kot.id || ''), table_id: kot.tableId || null, table_number: Number(kot.tableNumber || 0),
      items_json: JSON.stringify(kot.items || []), status: String(kot.status || 'pending'),
      time: kot.time ? new Date(kot.time).toISOString() : new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('update-kot-status', (event, id, status) => {
  try {
    db.prepare('UPDATE kots SET status = ? WHERE id = ?').run(status, id)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('clear-kots-for-table', (event, tableId) => {
  try {
    db.prepare('DELETE FROM kots WHERE table_id = ?').run(tableId)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

// ─── Recipes IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-recipes', () => {
  const rows = db.prepare('SELECT * FROM recipes').all()
  const map = {}
  rows.forEach(r => { map[r.dish_id] = r.ingredients_json ? JSON.parse(r.ingredients_json) : [] })
  return map
})

ipcMain.handle('set-recipe', (event, dishId, ingredients) => {
  try {
    db.prepare(`
      INSERT INTO recipes (dish_id, ingredients_json, updated_at)
      VALUES (@dish_id, @ingredients_json, @updated_at)
      ON CONFLICT(dish_id) DO UPDATE SET ingredients_json = excluded.ingredients_json, updated_at = excluded.updated_at
    `).run({ dish_id: String(dishId), ingredients_json: JSON.stringify(ingredients || []), updated_at: new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('delete-recipe', (event, dishId) => {
  try {
    db.prepare('DELETE FROM recipes WHERE dish_id = ?').run(dishId)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

// ─── Electronics IPC Handlers ──────────────────────────────────────────────────────
ipcMain.handle('el-get-products', () => db.prepare('SELECT * FROM el_products ORDER BY name ASC').all().map(p => ({ ...p, active: p.active === 1 })))

ipcMain.handle('el-upsert-product', (event, p) => {
  try {
    db.prepare(`
      INSERT INTO el_products (id, name, brand, category, barcode, cost, price, warranty_months, unit, active, created_at, updated_at)
      VALUES (@id,@name,@brand,@category,@barcode,@cost,@price,@warranty_months,@unit,@active,@created_at,@updated_at)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, brand=excluded.brand, category=excluded.category,
        barcode=excluded.barcode, cost=excluded.cost, price=excluded.price, warranty_months=excluded.warranty_months,
        unit=excluded.unit, active=excluded.active, updated_at=excluded.updated_at
    `).run({ id:String(p.id||''), name:String(p.name||''), brand:p.brand||null, category:p.category||null,
      barcode:p.barcode||null, cost:Number(p.cost||0), price:Number(p.price||0),
      warranty_months:Number(p.warrantyMonths||0), unit:p.unit||'pcs', active:p.active!==false?1:0,
      created_at:p.createdAt||new Date().toISOString(), updated_at:new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-delete-product', (event, id) => {
  try { db.prepare('DELETE FROM el_products WHERE id=?').run(id); return { success: true } }
  catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-serials', () => db.prepare('SELECT * FROM el_serials ORDER BY created_at DESC').all())

ipcMain.handle('el-add-serial', (event, s) => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO el_serials (id, product_id, serial, imei, status, supplier_id, grn_id, sold_at, sale_id, customer_id, created_at)
      VALUES (@id,@product_id,@serial,@imei,@status,@supplier_id,@grn_id,@sold_at,@sale_id,@customer_id,@created_at)
    `).run({ id:String(s.id||''), product_id:s.productId||null, serial:s.serial||null, imei:s.imei||null,
      status:s.status||'in_stock', supplier_id:s.supplierId||null, grn_id:s.grnId||null,
      sold_at:s.soldAt||null, sale_id:s.saleId||null, customer_id:s.customerId||null,
      created_at:s.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-update-serial', (event, id, updates) => {
  try {
    const colMap = { status:'status', soldAt:'sold_at', saleId:'sale_id', customerId:'customer_id', grnId:'grn_id' }
    const fields = []; const params = { id }
    Object.entries(updates).forEach(([k,v]) => { const col=colMap[k]; if(col){ fields.push(`${col}=@${col}`); params[col]=v } })
    if (!fields.length) return { success: true }
    db.prepare(`UPDATE el_serials SET ${fields.join(',')} WHERE id=@id`).run(params)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-suppliers', () => db.prepare('SELECT * FROM el_suppliers ORDER BY name ASC').all())

ipcMain.handle('el-upsert-supplier', (event, s) => {
  try {
    db.prepare(`INSERT INTO el_suppliers (id,name,contact,email,address,created_at) VALUES (@id,@name,@contact,@email,@address,@created_at)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact=excluded.contact,email=excluded.email,address=excluded.address
    `).run({ id:String(s.id||''), name:s.name||'', contact:s.contact||null, email:s.email||null, address:s.address||null, created_at:s.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-delete-supplier', (event, id) => {
  try { db.prepare('DELETE FROM el_suppliers WHERE id=?').run(id); return { success: true } }
  catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-grns', () => db.prepare('SELECT * FROM el_grns ORDER BY created_at DESC').all().map(g => ({ ...g, items: g.items_json ? JSON.parse(g.items_json) : [] })))

ipcMain.handle('el-add-grn', (event, g) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO el_grns (id,supplier_id,date,invoice_no,items_json,status,notes,created_at)
      VALUES (@id,@supplier_id,@date,@invoice_no,@items_json,@status,@notes,@created_at)
    `).run({ id:String(g.id||''), supplier_id:g.supplierId||null, date:g.date||new Date().toISOString(),
      invoice_no:g.invoiceNo||null, items_json:JSON.stringify(g.items||[]), status:g.status||'received',
      notes:g.notes||null, created_at:g.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-sales', () => db.prepare('SELECT * FROM el_sales ORDER BY created_at DESC').all().map(s => ({ ...s, items: s.items_json ? JSON.parse(s.items_json) : [] })))

ipcMain.handle('el-add-sale', (event, s) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO el_sales (id,customer_id,date,items_json,total,status,receipt_no,created_at)
      VALUES (@id,@customer_id,@date,@items_json,@total,@status,@receipt_no,@created_at)
    `).run({ id:String(s.id||''), customer_id:s.customerId||null, date:s.date||new Date().toISOString(),
      items_json:JSON.stringify(s.items||[]), total:Number(s.total||0), status:s.status||'completed',
      receipt_no:s.receiptNo||null, created_at:s.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-repair-jobs', () => db.prepare('SELECT * FROM repair_jobs ORDER BY created_at DESC').all().map(j => ({ ...j, notified: j.notified===1 })))

ipcMain.handle('el-add-repair-job', (event, j) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO repair_jobs (id,job_no,customer_id,device_info,problem,status,estimated_cost,final_cost,received_date,completed_date,notified,job_type,notes,created_at,updated_at)
      VALUES (@id,@job_no,@customer_id,@device_info,@problem,@status,@estimated_cost,@final_cost,@received_date,@completed_date,@notified,@job_type,@notes,@created_at,@updated_at)
    `).run({ id:String(j.id||''), job_no:j.jobNo||null, customer_id:j.customerId||null,
      device_info:j.deviceInfo||null, problem:j.problem||null, status:j.status||'received',
      estimated_cost:Number(j.estimatedCost||0), final_cost:Number(j.finalCost||0),
      received_date:j.receivedDate||new Date().toISOString(), completed_date:j.completedDate||null,
      notified:j.notified?1:0, job_type:j.jobType||'custom', notes:j.notes||null,
      created_at:j.createdAt||new Date().toISOString(), updated_at:j.updatedAt||null })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-update-repair-job', (event, id, updates) => {
  try {
    const colMap = { status:'status', estimatedCost:'estimated_cost', finalCost:'final_cost',
      completedDate:'completed_date', notified:'notified', notes:'notes', updatedAt:'updated_at' }
    const fields = []; const params = { id }
    Object.entries(updates).forEach(([k,v]) => { const col=colMap[k]; if(col){ fields.push(`${col}=@${col}`); params[col]=col==='notified'?(v?1:0):v } })
    if (!fields.length) return { success: true }
    db.prepare(`UPDATE repair_jobs SET ${fields.join(',')} WHERE id=@id`).run(params)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-delete-repair-job', (event, id) => {
  try { db.prepare('DELETE FROM repair_jobs WHERE id=?').run(id); return { success: true } }
  catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-customers', () => db.prepare('SELECT * FROM el_customers ORDER BY name ASC').all())

ipcMain.handle('el-upsert-customer', (event, c) => {
  try {
    db.prepare(`INSERT INTO el_customers (id,name,phone,email,address,created_at) VALUES (@id,@name,@phone,@email,@address,@created_at)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email,address=excluded.address
    `).run({ id:String(c.id||''), name:c.name||'', phone:c.phone||null, email:c.email||null, address:c.address||null, created_at:c.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-delete-customer', (event, id) => {
  try { db.prepare('DELETE FROM el_customers WHERE id=?').run(id); return { success: true } }
  catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-warranties', () => db.prepare('SELECT * FROM warranties ORDER BY created_at DESC').all())

ipcMain.handle('el-add-warranty', (event, w) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO warranties (id,sale_id,serial_id,product_id,product_name,serial,imei,customer_id,warranty_months,start_date,end_date,status,created_at)
      VALUES (@id,@sale_id,@serial_id,@product_id,@product_name,@serial,@imei,@customer_id,@warranty_months,@start_date,@end_date,@status,@created_at)
    `).run({ id:String(w.id||''), sale_id:w.saleId||null, serial_id:w.serialId||null, product_id:w.productId||null,
      product_name:w.productName||null, serial:w.serial||null, imei:w.imei||null, customer_id:w.customerId||null,
      warranty_months:Number(w.warrantyMonths||0), start_date:w.startDate||null, end_date:w.endDate||null,
      status:w.status||'active', created_at:w.createdAt||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-get-warranty-claims', () => db.prepare('SELECT * FROM warranty_claims ORDER BY created_at DESC').all())

ipcMain.handle('el-add-warranty-claim', (event, c) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO warranty_claims (id,warranty_id,sale_id,customer_id,description,status,claimed_at,resolved_at,created_at,updated_at)
      VALUES (@id,@warranty_id,@sale_id,@customer_id,@description,@status,@claimed_at,@resolved_at,@created_at,@updated_at)
    `).run({ id:String(c.id||''), warranty_id:c.warrantyId||null, sale_id:c.saleId||null, customer_id:c.customerId||null,
      description:c.description||null, status:c.status||'open', claimed_at:c.claimedAt||new Date().toISOString(),
      resolved_at:c.resolvedAt||null, created_at:c.createdAt||new Date().toISOString(), updated_at:c.updatedAt||null })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-update-warranty-claim', (event, id, updates) => {
  try {
    const colMap = { status:'status', resolvedAt:'resolved_at', updatedAt:'updated_at' }
    const fields = []; const params = { id }
    Object.entries(updates).forEach(([k,v]) => { const col=colMap[k]; if(col){ fields.push(`${col}=@${col}`); params[col]=v } })
    if (!fields.length) return { success: true }
    db.prepare(`UPDATE warranty_claims SET ${fields.join(',')} WHERE id=@id`).run(params)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('el-delete-warranty-claim', (event, id) => {
  try { db.prepare('DELETE FROM warranty_claims WHERE id=?').run(id); return { success: true } }
  catch (e) { return { success: false, error: e.message } }
})

// ─── GRN IPC Handlers ────────────────────────────────────────────────────────────
ipcMain.handle('grn-get-all', () => db.prepare('SELECT * FROM grns ORDER BY created_at DESC').all().map(g => g.data_json ? JSON.parse(g.data_json) : {}))

ipcMain.handle('grn-add', (event, grn) => {
  try {
    db.prepare('INSERT OR IGNORE INTO grns (id, data_json, created_at) VALUES (@id, @data_json, @created_at)')
      .run({ id: String(grn.id||''), data_json: JSON.stringify(grn), created_at: grn.date||new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

// ─── Ledger IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.handle('ledger-get-all', () => db.prepare('SELECT * FROM ledger_entries ORDER BY date DESC').all().map(e => ({
  id:e.id, customerId:e.customer_id, type:e.type, amount:e.amount, balance:e.balance,
  description:e.description, ref:e.ref, date:e.date,
})))

ipcMain.handle('ledger-add-entry', (event, entry) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO ledger_entries (id,customer_id,type,amount,balance,description,ref,date,created_at)
      VALUES (@id,@customer_id,@type,@amount,@balance,@description,@ref,@date,@created_at)
    `).run({ id:String(entry.id||''), customer_id:entry.customerId||null, type:entry.type||'purchase',
      amount:Number(entry.amount||0), balance:Number(entry.balance||0), description:entry.description||null,
      ref:entry.ref||null, date:entry.date?new Date(entry.date).toISOString():new Date().toISOString(),
      created_at:new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

// ─── Activity Logs IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('logs-get-all', () => db.prepare('SELECT * FROM activity_logs ORDER BY date DESC LIMIT 500').all().map(l => ({
  id:l.id, action:l.action, details:l.details, user:l.user_name, date:l.date,
})))

ipcMain.handle('logs-add', (event, log) => {
  try {
    db.prepare(`INSERT OR IGNORE INTO activity_logs (id,action,details,user_name,date,created_at)
      VALUES (@id,@action,@details,@user_name,@date,@created_at)
    `).run({ id:String(log.id||''), action:log.action||'', details:log.details||'',
      user_name:log.user||'System', date:log.date?new Date(log.date).toISOString():new Date().toISOString(),
      created_at:new Date().toISOString() })
    // Keep table trimmed to 500 most recent logs
    db.prepare('DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY date DESC LIMIT 500)').run()
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

// ─── App Settings IPC Handlers ──────────────────────────────────────────────────
ipcMain.handle('settings-save', (event, key, value) => {
  try {
    db.prepare(`INSERT INTO app_settings (key, value_json, updated_at) VALUES (@key, @value_json, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run({ key: String(key), value_json: JSON.stringify(value), updated_at: new Date().toISOString() })
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
})

ipcMain.handle('settings-get', (event, key) => {
  try {
    const row = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get(key)
    return row ? JSON.parse(row.value_json) : null
  } catch (e) { return null }
})

// ─── Reset all business data (license switch) ───────────────────────────────────────
ipcMain.handle('reset-business-data', () => {
  const transaction = db.transaction(() => {
    const tables = [
      'product_batches','products','sales','customers',
      'restaurant_tables','kots','recipes',
      'el_products','el_serials','el_suppliers','el_grns','el_sales',
      'repair_jobs','el_customers','warranties','warranty_claims',
      'grns','ledger_entries','activity_logs',
    ]
    tables.forEach(t => db.prepare(`DELETE FROM ${t}`).run())
  })
  try { transaction(); return { success: true } }
  catch (error) { return { success: false, error: error?.message || 'Failed to reset local business data' } }
});

// ─── Local App Snapshot Backup (Electron userData) ──────────────────────────
ipcMain.handle('local-backup-save', (event, payload) => {
  try {
    const snapshot = payload && typeof payload === 'object' ? payload : {};
    const tempPath = `${localBackupPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tempPath, localBackupPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to write local backup' };
  }
});

ipcMain.handle('local-backup-load', () => {
  try {
    if (!fs.existsSync(localBackupPath)) return { success: true, data: null };
    const raw = fs.readFileSync(localBackupPath, 'utf8');
    if (!raw || !raw.trim()) return { success: true, data: null };
    const parsed = JSON.parse(raw);
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to read local backup', data: null };
  }
});

// ─── Backup & Restore Database ──────────────────────────────────────────────
ipcMain.handle('download-sqlite-backup', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      title: 'Save Paxxmo SQLite Backup',
      defaultPath: `paxxmo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    };
    
    const { filePath } = win 
      ? await dialog.showSaveDialog(win, opts) 
      : await dialog.showSaveDialog(opts);

    if (filePath) {
      if (!fs.existsSync(dbPath)) return { success: false, error: 'Source database file not found' };
      fs.copyFileSync(dbPath, filePath);
      return { success: true };
    }
    return { success: false, error: 'Cancelled' };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to save backup' };
  }
});

ipcMain.handle('restore-sqlite-backup', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      title: 'Restore Paxxmo SQLite Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
      properties: ['openFile']
    };
    
    const { filePaths } = win 
      ? await dialog.showOpenDialog(win, opts) 
      : await dialog.showOpenDialog(opts);

    if (filePaths && filePaths.length > 0) {
      const sourceFile = filePaths[0];
      if (!fs.existsSync(sourceFile)) return { success: false, error: 'Selected file not found' };

      // Make a safety copy of the current DB just in case
      const safetyBackup = dbPath + '.bak';
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, safetyBackup);
      }

      // Close the DB connection before overwriting
      db.close();

      ['', '-wal', '-shm', '-journal'].forEach(ext => {
        if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
      });

      // Overwrite the actual db file
      fs.copyFileSync(sourceFile, dbPath);

      // Re-initialize the db connection in memory without exiting the app
      db = new Database(dbPath);

      // Re-initialize the db connection in memory
      db = new Database(dbPath);

      return { success: true, requiresReload: true };
    }
    return { success: false, error: 'Cancelled' };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to restore backup' };
  }
});

ipcMain.handle('download-sql-dump', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      title: 'Save Paxxmo SQL Dump',
      defaultPath: `paxxmo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`,
      filters: [{ name: 'SQL Dump', extensions: ['sql'] }],
    };

    const { filePath } = win
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts);

    if (!filePath) return { success: false, error: 'Cancelled' };

    const dump = buildSqlDump();
    fs.writeFileSync(filePath, dump, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to export SQL dump' };
  }
});

ipcMain.handle('restore-sql-dump', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      title: 'Restore Paxxmo SQL Dump',
      filters: [{ name: 'SQL Dump', extensions: ['sql'] }],
      properties: ['openFile'],
    };

    const { filePaths } = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);

    if (!filePaths || filePaths.length === 0) return { success: false, error: 'Cancelled' };

    const sourceFile = filePaths[0];
    if (!fs.existsSync(sourceFile)) return { success: false, error: 'Selected SQL file not found' };
    
    let sqlContent = fs.readFileSync(sourceFile, 'utf8');
    // Strip BOM if present
    sqlContent = sqlContent.replace(/^\uFEFF/, '');
    if (!sqlContent || !sqlContent.trim()) return { success: false, error: 'SQL file is empty' };

    const safetyBackup = `${dbPath}.bak`;
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, safetyBackup);

    db.close();
    ['', '-wal', '-shm', '-journal'].forEach(ext => {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    });
    db = new Database(dbPath);

    db.exec(sqlContent);

    return { success: true, requiresReload: true };
  } catch (error) {
    try {
      if (fs.existsSync(`${dbPath}.bak`)) {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        fs.copyFileSync(`${dbPath}.bak`, dbPath);
      }
      db = new Database(dbPath);
    } catch (_) {}
    return { success: false, error: error?.message || 'Failed to restore SQL dump' };
  }
});

// ─── Batch IPC Handlers ─────────────────────────────────────────────────────

ipcMain.handle('get-product-batches', (event, productId) => {
  return db.prepare('SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry ASC').all();
});

ipcMain.handle('add-product-batch', (event, batch) => {
  const stmt = db.prepare(`
    INSERT INTO product_batches (id, product_id, batch_no, expiry, stock, cost, price)
    VALUES (@id, @product_id, @batch_no, @expiry, @stock, @cost, @price)
  `);
  stmt.run({
    ...batch,
    price: batch.price || null
  });
  return batch;
});

ipcMain.handle('update-product-batch', (event, id, updates) => {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  if (!fields) return;
  const stmt = db.prepare(`UPDATE product_batches SET ${fields} WHERE id = @id`);
  stmt.run({ ...updates, id });
});

ipcMain.handle('delete-product-batch', (event, id) => {
  db.prepare(`DELETE FROM product_batches WHERE id = @id`).run({ id });
});

// ─── HelaQR API Proxy (bypasses CORS in renderer) ───────────────────────────
// All HelaQR HTTP calls are routed through the main process (Node.js)
// so they are never subject to browser CORS policy.
ipcMain.handle('helaqr-fetch', async (event, { url, method = 'POST', headers = {}, body }) => {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: {}, error: String(err?.message || err) };
  }
});

// ─── Global Barcode Lookup (CORS-free via Node.js) ──────────────────────────
// Queries Open Food Facts → UPCitemdb and returns { found, name, category, source }
ipcMain.handle('barcode-lookup', async (event, { barcode }) => {
  const code = String(barcode || '').trim()
  if (!code) return { found: false }

  try {
    // 1. Open Food Facts — covers food/grocery products worldwide
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,categories_tags,quantity`,
      { headers: { 'User-Agent': 'PaxxmoPOS/1.0 - pos@paxxmo.app' } }
    )
    if (offRes.ok) {
      const offData = await offRes.json().catch(() => ({}))
      if (offData.status === 1 && offData.product?.product_name) {
        const p = offData.product
        const name = [p.brands, p.product_name, p.quantity].filter(Boolean).join(' ').trim()
        const rawCat = (p.categories_tags || []).find(c => !c.includes(':')) ||
          (p.categories_tags || [])[0]?.replace(/^[a-z]{2}:/, '') || ''
        const cat = rawCat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
        return { found: true, name, category: cat, source: 'Open Food Facts' }
      }
    }

    // 2. UPCitemdb — covers general consumer products (100 req/day free)
    const upcRes = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'PaxxmoPOS/1.0' } }
    )
    if (upcRes.ok) {
      const upcData = await upcRes.json().catch(() => ({}))
      const item = (upcData.items || [])[0]
      if (item?.title) {
        const name = [item.brand, item.title].filter(Boolean).join(' ').trim()
        const cat = (item.category || '').replace(/[>|]/g, '/').split('/')[0].trim()
        return { found: true, name, category: cat, source: 'UPCitemdb' }
      }
    }

    return { found: false }
  } catch (err) {
    return { found: false, error: String(err?.message || err) }
  }
})

// ─── Silent Receipt Printing (no pop-up windows) ───────────────────────────
function createPrinterWorker() {
  return new BrowserWindow({
    show: false,
    width: 576,
    height: 3000,
    // sandbox: false is required — sandbox:true blocks webContents.print()
    // from targeting named printers (e.g. FP-1100) on Windows.
    webPreferences: { sandbox: false }
  });
}

// ─── Thermal printer profile builder ────────────────────────────────────────
// Converts a paper width string (e.g. "80mm" or "58mm") into a complete
// profile that drives both the BrowserWindow size and the Electron print call.
//
// WHY 8px/mm instead of 96dpi math?
// ─────────────────────────────────
// 96dpi → 1mm = 3.78px, so 80mm = ~302px.  That is correct for CSS layout,
// BUT the FP-1100 (and most Raster/GDI thermal drivers on Windows) report
// themselves as a 203 DPI device.  Electron's Chromium rasterises the window
// content at SCREEN DPI (96) then hands it to the GDI driver which scales it
// to the printer's native 203 DPI.  If the window is only 302px wide the
// driver stretches that to 203dpi×80mm = 640 dots and the layout looks
// compressed/narrow because Chromium packed too much white-space.
//
// The correct approach: make the window exactly as many CSS pixels wide as
// there are usable columns on the paper at a 1:1 pixel-to-unit mapping:
//   80mm paper → 72mm usable → 72 × 8px/mm = 576px  (≈ ESC/POS 576-dot grid)
//   58mm paper → 48mm usable → 48 × 8px/mm = 384px  (≈ ESC/POS 384-dot grid)
// This makes CSS 1px ≈ 1 thermal dot, which is how all commercial receipt
// renderers (EPSON TM, Star Micronics, etc.) calculate their column widths.
function buildThermalProfile(paperWidthStr) {
  const profile = buildThermalProfileShared({ paperWidth: paperWidthStr });
  return {
    ...profile,
    pageSizeMicrons: {
      width: Math.round(profile.paperMm * 1000),
      height: 2000000,
    },
  };
}

// ─── List available printers (for Settings UI picker) ───────────────────────
ipcMain.handle('get-printers', async () => {
  let worker = null;
  try {
    worker = createPrinterWorker();
    // getPrintersAsync() is available in Electron 22+ (replaces deprecated getPrinters())
    const printers = await worker.webContents.getPrintersAsync();
    worker.destroy();
    return {
      success: true,
      printers: printers.map(p => ({ name: p.name, isDefault: p.isDefault }))
    };
  } catch (err) {
    if (worker && !worker.isDestroyed()) worker.destroy();
    return { success: false, printers: [], error: err?.message || 'Failed to list printers' };
  }
});

// ─── Silent print via temp file ─────────────────────────────────────────────
// IMPORTANT: Electron 20+ (and especially Electron 41) BLOCKS loading data:
// URIs via loadURL() for security. We write the HTML to a temp file and load
// it via file:// — this is always permitted and works in all Electron versions.
ipcMain.handle('print-html', async (event, payload = {}) => {
  const html = String(payload?.html || '').trim();
  if (!html) return { success: false, error: 'Missing print HTML' };

  const isA4 = String(payload?.paperWidth || '').toUpperCase() === 'A4';

  // A4 mode: 210mm × 297mm at 96dpi ≈ 794×1123px
  // Thermal mode: use the existing thermal profile
  let windowWidth, pageSizeMicrons;

  if (isA4) {
    windowWidth = 794;
    pageSizeMicrons = { width: 210000, height: 297000 };
    console.log(
      `[Print] A4 mode  windowPx=${windowWidth}px`,
      payload?.deviceName ? `  device="${payload.deviceName}"` : '  device=(system default)'
    );
  } else {
    const profile = buildThermalProfile(payload?.paperWidth || '80mm', payload?.printerMode || 'Raster', payload?.printerProfile || '');
    windowWidth = profile.windowPx;
    pageSizeMicrons = {
      width: Math.round(profile.paperMm * 1000),
      height: 2000000,
    };
    console.log(
      `[Print] paperWidth=${profile.paperMm}mm  usable=${profile.usableMm}mm  windowPx=${profile.windowPx}px`,
      payload?.deviceName ? `  device="${payload.deviceName}"` : '  device=(system default)'
    );
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}.html`
  );
  const cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (_) {} };

  try {
    fs.writeFileSync(tmpFile, html, 'utf8');

    // Convert Windows backslash path to a valid file:// URL
    // e.g. C:\Users\...\Temp\receipt.html  →  file:///C:/Users/.../Temp/receipt.html
    const fileUrl = 'file:///' + tmpFile.split(path.sep).join('/');

    const worker = createPrinterWorker();

    // Width = usable receipt width in px; Height = tall enough for content
    worker.setSize(windowWidth, isA4 ? 1123 : 3000);

    const resultPromise = new Promise((resolve) => {
      worker.webContents.once('did-fail-load', (_e, code, description) => {
        cleanup();
        if (!worker.isDestroyed()) worker.destroy();
        resolve({ success: false, error: `Load failed (${code}): ${description}` });
      });

      worker.webContents.once('did-finish-load', () => {
        const deviceName = String(payload?.deviceName || '').trim();

        const printOptions = {
          silent: payload?.silent !== false,
          printBackground: true,
          color: false,
          pageSize: isA4 ? 'A4' : pageSizeMicrons,
          margins: { marginType: isA4 ? 'default' : 'none' },
        };
        if (deviceName) printOptions.deviceName = deviceName;

        worker.webContents.print(printOptions, (success, errorType) => {
          cleanup();
          if (!worker.isDestroyed()) worker.destroy();
          if (success) {
            resolve({ success: true });
          } else {
            console.error(
              '[Print] Failed — device:', deviceName || '(system default)',
              '| errorType:', errorType
            );
            resolve({ success: false, error: errorType || 'Print callback returned failure' });
          }
        });
      });
    });

    await worker.loadURL(fileUrl);
    return await resultPromise;

  } catch (error) {
    cleanup();
    if (worker && !worker.isDestroyed()) worker.destroy();
    return { success: false, error: error?.message || 'Silent print failed' };
  }
});


// ─── Window ─────────────────────────────────────────────────────────────────
function attachWindowDiagnostics(win, label) {
  win.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error(`[${label}] did-fail-load`, code, desc, url);
  });

  win.webContents.on('render-process-gone', (_, details) => {
    console.error(`[${label}] render-process-gone`, details?.reason || details);
  });

  win.webContents.on('console-message', (_, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[${label}] renderer`, message, `(${sourceId}:${line})`);
    }
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '../dist/icon.png');
  const iconExists = fs.existsSync(iconPath);

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'CeyPos POS',
    ...(iconExists ? { icon: iconPath } : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.show();
  mainWindow.focus();

  attachWindowDiagnostics(mainWindow, 'main');

  const loadRenderer = async (retries = 40) => {
    if (!app.isPackaged) {
      for (let i = 0; i < retries; i++) {
        try {
          await mainWindow.loadURL(DEV_SERVER_URL);
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      // Fallback: try one more time and surface error
      await mainWindow.loadURL(DEV_SERVER_URL);
      return;
    }

    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  };

  loadRenderer().catch((err) => {
    console.error('[createWindow] loadRenderer failed:', err.message);
    dialog.showErrorBox('Startup Error', `Unable to load app window.\n\n${err.message}`);
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // ─── Auto Updater ────────────────────────────────────────────────────────
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
      mainWindow.webContents.send('update-status', 'downloading');
    });

    autoUpdater.on('update-downloaded', () => {
      mainWindow.webContents.send('update-status', 'ready');
    });

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Error:', err.message);
    });

    // Renderer can trigger install & restart
    ipcMain.on('install-update', () => {
      autoUpdater.quitAndInstall();
    });
  }

  let customerWindow = null;

  const createCustomerWindow = async () => {
    if (customerWindow && !customerWindow.isDestroyed()) return;

    const displays = screen.getAllDisplays();
    const externalDisplay = displays.find((d) => d.id !== screen.getPrimaryDisplay().id);
    const bounds = externalDisplay?.workArea;

    customerWindow = new BrowserWindow({
      width: bounds?.width || 900,
      height: bounds?.height || 700,
      x: bounds?.x,
      y: bounds?.y,
      autoHideMenuBar: true,
      title: 'CeyPos Customer Display',
      backgroundColor: '#0b1220',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    attachWindowDiagnostics(customerWindow, 'customer');

    try {
      if (!app.isPackaged) {
        await customerWindow.loadURL(`${DEV_SERVER_URL}/#/customer-screen`);
      } else {
        await customerWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/customer-screen' });
      }
    } catch (err) {
      console.error('Customer window failed to load:', err?.message || err);
    }
  };

  ipcMain.on('customer-display-open', () => {
    createCustomerWindow();
  });

  ipcMain.on('customer-display-close', () => {
    if (customerWindow && !customerWindow.isDestroyed()) {
      customerWindow.close();
      customerWindow = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
