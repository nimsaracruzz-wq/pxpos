import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600, title: 'TEST WINDOW' });
  win.loadURL('https://example.com');
  win.show();
  win.focus();
  console.log('Window created and shown');
});
