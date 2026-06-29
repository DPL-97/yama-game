// Electron main process (CommonJS – package.json uses "type":"module" for Vite,
// so this file uses .cjs to stay in CommonJS mode as required by Electron).
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 900,
    minWidth: 360,
    minHeight: 700,
    resizable: true,
    backgroundColor: '#0e1a2b',
    title: 'Yama Game',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the Vite-built app from the dist folder
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Hide the default menu bar (the game has its own UI)
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  // On macOS re-create a window when the dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
