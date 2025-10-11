const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Keep track of windows
let mainWindow = null;
let outputWindow = null;

// Development mode detection
const isDev = process.argv.includes('--dev');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    title: 'Metropolis Live Remix',
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile('index.html');

  // ALWAYS open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window finished loading');
  });

  // Log any console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close output window if main window closes
    if (outputWindow) {
      outputWindow.close();
    }
  });
}

// IPC: Open output window
ipcMain.handle('open-output-window', async () => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus();
    return { success: true, windowId: outputWindow.id };
  }

  outputWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Metropolis Output',
    backgroundColor: '#000000'
  });

  // Load a simple output HTML or communicate with main window
  outputWindow.loadFile('output.html');

  outputWindow.on('closed', () => {
    outputWindow = null;
    // Notify main window that output closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-window-closed');
    }
  });

  return { success: true, windowId: outputWindow.id };
});

// IPC: Close output window
ipcMain.handle('close-output-window', async () => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.close();
    outputWindow = null;
  }
  return { success: true };
});

// IPC: Check if output window is open
ipcMain.handle('is-output-window-open', async () => {
  return { isOpen: outputWindow && !outputWindow.isDestroyed() };
});

// IPC: Send message to output window
ipcMain.on('output-window-message', (event, message) => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.webContents.send('output-message', message);
  }
});

// IPC: Select folder dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return { canceled: true };
  }

  return {
    canceled: false,
    folderPath: result.filePaths[0]
  };
});

// IPC: Read directory
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size
        };
      })
    );
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: Save session file
ipcMain.handle('save-session', async (event, sessionData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Session',
      defaultPath: `metropolis-session-${Date.now()}.json`,
      filters: [
        { name: 'Session Files', extensions: ['json'] }
      ]
    });

    if (result.canceled) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, JSON.stringify(sessionData, null, 2));
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: Load session file
ipcMain.handle('load-session', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Session',
      filters: [
        { name: 'Session Files', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    const fileContent = await fs.readFile(result.filePaths[0], 'utf-8');
    const sessionData = JSON.parse(fileContent);
    return { success: true, sessionData, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: Get file protocol path (for video loading)
ipcMain.handle('get-file-path', async (event, filePath) => {
  // Return file:// URL for video loading
  return { path: `file:///${filePath.replace(/\\/g, '/')}` };
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

console.log('Metropolis Electron Main Process Started');
console.log('Development Mode:', isDev);
