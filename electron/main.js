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

// Add user
ipcMain.handle('users-add', (event, { id, username, password, barcode, role, name }) => {
  try {
    db.prepare(`
      INSERT INTO system_users (id, username, password_hash, barcode, role, name)
      VALUES (@id, @username, @password_hash, @barcode, @role, @name)
    `).run({ id, username, password_hash: hashPassword(password), barcode: normalizeBarcodeValue(barcode) || null, role, name });
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

// Clear business transactional product data when switching to a different license key.
ipcMain.handle('reset-business-data', () => {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM product_batches').run();
    db.prepare('DELETE FROM products').run();
  });

  try {
    transaction();
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to reset local business data' };
  }
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
let printerWorkerWindow = null;

function getPrinterWorker() {
  if (!printerWorkerWindow || printerWorkerWindow.isDestroyed()) {
    printerWorkerWindow = new BrowserWindow({
      show: false,
      width: 576,
      height: 3000,
      // sandbox: false is required — sandbox:true blocks webContents.print()
      // from targeting named printers (e.g. FP-1100) on Windows.
      webPreferences: { sandbox: false }
    });
  }
  return printerWorkerWindow;
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
  try {
    const worker = getPrinterWorker();
    // getPrintersAsync() is available in Electron 22+ (replaces deprecated getPrinters())
    const printers = await worker.webContents.getPrintersAsync();
    return {
      success: true,
      printers: printers.map(p => ({ name: p.name, isDefault: p.isDefault }))
    };
  } catch (err) {
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

    const worker = getPrinterWorker();

    // Width = usable receipt width in px; Height = tall enough for content
    worker.setSize(windowWidth, isA4 ? 1123 : 3000);

    const resultPromise = new Promise((resolve) => {
      worker.webContents.removeAllListeners('did-fail-load');
      worker.webContents.removeAllListeners('did-finish-load');

      worker.webContents.once('did-fail-load', (_e, code, description) => {
        cleanup();
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
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'CeyPos POS',
    icon: path.join(__dirname, '../dist/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  attachWindowDiagnostics(mainWindow, 'main');

  const loadRenderer = async (retries = 30) => {
    if (!app.isPackaged) {
      for (let i = 0; i < retries; i++) {
        try {
          await mainWindow.loadURL(DEV_SERVER_URL);
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  };

  loadRenderer().catch((err) => {
    dialog.showErrorBox('Startup Error', `Unable to load app window. ${err.message}`);
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

  const createCustomerWindow = async () => {
    const displays = screen.getAllDisplays();
    const externalDisplay = displays.find((d) => d.id !== screen.getPrimaryDisplay().id);
    const bounds = externalDisplay?.workArea;

    const customerWindow = new BrowserWindow({
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

  createCustomerWindow();
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
