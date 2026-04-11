import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Database Init ──────────────────────────────────────────────────────────
const dbPath = path.join(app.getPath('userData'), 'paxxmo.db');
const db = new Database(dbPath);

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

// ─── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:5173').catch(() => {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
