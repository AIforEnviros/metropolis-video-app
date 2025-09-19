const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;
let outputWindow;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.floor(width * 0.8),
    height: Math.floor(height * 0.9),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    title: 'Metropolis Video Performance - Control Interface'
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (outputWindow) {
      outputWindow.close();
    }
  });
}

function createOutputWindow() {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  if (externalDisplay) {
    outputWindow = new BrowserWindow({
      x: externalDisplay.bounds.x,
      y: externalDisplay.bounds.y,
      width: externalDisplay.bounds.width,
      height: externalDisplay.bounds.height,
      fullscreen: true,
      frame: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      title: 'Metropolis Video Performance - Output Display'
    });

    outputWindow.loadURL(
      isDev
        ? 'http://localhost:3000/output'
        : `file://${path.join(__dirname, '../build/index.html#output')}`
    );

    outputWindow.on('closed', () => {
      outputWindow = null;
    });
  }
}

app.whenReady().then(() => {
  createMainWindow();

  // Create output window after a short delay
  setTimeout(() => {
    createOutputWindow();
  }, 2000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle dual-screen setup
app.on('ready', () => {
  screen.on('display-added', () => {
    if (!outputWindow) {
      createOutputWindow();
    }
  });

  screen.on('display-removed', () => {
    if (outputWindow) {
      outputWindow.close();
      outputWindow = null;
    }
  });
});