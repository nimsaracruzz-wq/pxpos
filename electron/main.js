import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import os from 'os';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// ─── Database Init ──────────────────────────────────────────────────────────
const dbPath = path.join(app.getPath('userData'), 'paxxmo.db');
let db = new Database(dbPath);

// Helper: SHA-256 hash for passwords
function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
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
  const user = db.prepare(`
    SELECT id, username, barcode, role, name FROM system_users
    WHERE barcode = ? AND active = 1
  `).get(barcode);
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
    `).run({ id, username, password_hash: hashPassword(password), barcode: barcode || null, role, name });
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

ipcMain.handle('get-device-id', () => {
  return getMachineDeviceId();
});

ipcMain.handle('get-device-metadata', () => {
  const ipAddresses = getLocalIPv4Addresses();
  return {
    deviceId: getMachineDeviceId(),
    hostname: os.hostname(),
    ipAddresses,
    lastIp: ipAddresses[0] || '',
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

      // Overwrite the actual db file
      fs.copyFileSync(sourceFile, dbPath);

      // Re-initialize the db connection in memory without exiting the app
      db = new Database(dbPath);

      // Reload all front-end windows so they fetch the fresh database data
      BrowserWindow.getAllWindows().forEach((w) => w.reload());

      return { success: true };
    }
    return { success: false, error: 'Cancelled' };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to restore backup' };
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

// ─── Silent Receipt Printing (no pop-up windows) ───────────────────────────
ipcMain.handle('print-html', async (event, payload = {}) => {
  const html = String(payload?.html || '').trim();
  if (!html) return { success: false, error: 'Missing print HTML' };

  let printWindow = null;
  try {
    printWindow = new BrowserWindow({
      show: false,
      width: 420,
      height: 760,
      webPreferences: {
        sandbox: true,
      },
    });

    const resultPromise = new Promise((resolve) => {
      const cleanup = () => {
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.close();
        }
        printWindow = null;
      };

      printWindow.webContents.once('did-fail-load', (e, code, description) => {
        cleanup();
        resolve({ success: false, error: `Load failed (${code}): ${description}` });
      });

      printWindow.webContents.once('did-finish-load', () => {
        const options = {
          silent: payload?.silent !== false,
          printBackground: true,
        };

        const deviceName = String(payload?.deviceName || '').trim();
        if (deviceName) options.deviceName = deviceName;

        printWindow.webContents.print(options, (success, errorType) => {
          cleanup();
          if (success) resolve({ success: true });
          else resolve({ success: false, error: errorType || 'Print failed' });
        });
      });
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const result = await resultPromise;
    return result;
  } catch (error) {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
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
