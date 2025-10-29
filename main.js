const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const midi = require('@julusian/midi');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Keep track of windows
let mainWindow = null;
let outputWindow = null;

// MIDI state
let midiInput = null;
let currentMIDIPort = null;
let midiDevices = [];

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

  // Detect external display for output window
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  // Configure window options based on display detection
  let windowOptions = {
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Metropolis Output',
    backgroundColor: '#000000'
  };

  if (externalDisplay) {
    // External display detected - position output window there in fullscreen
    windowOptions.x = externalDisplay.bounds.x;
    windowOptions.y = externalDisplay.bounds.y;
    windowOptions.width = externalDisplay.bounds.width;
    windowOptions.height = externalDisplay.bounds.height;
    windowOptions.fullscreen = true;
    windowOptions.frame = false;
    console.log(`Output window positioned on external display at ${externalDisplay.bounds.x},${externalDisplay.bounds.y} (${externalDisplay.bounds.width}x${externalDisplay.bounds.height})`);
  } else {
    // No external display - use default size on primary display
    windowOptions.width = 1920;
    windowOptions.height = 1080;
    console.log('No external display detected, using default output window size');
  }

  outputWindow = new BrowserWindow(windowOptions);

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
      defaultPath: `mimolume_${Date.now()}.json`,
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

// ==============================================================
// FFMPEG VIDEO REVERSAL FUNCTIONALITY
// ==============================================================

// IPC: Generate reversed video for bounce mode
ipcMain.handle('generate-reversed-video', async (event, videoPath) => {
  try {
    console.log(`Starting video reversal for: ${videoPath}`);

    // Parse original video path
    const parsedPath = path.parse(videoPath);
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_reversed${parsedPath.ext}`);

    // Check if reversed video already exists
    try {
      await fs.access(outputPath);
      console.log(`Reversed video already exists: ${outputPath}`);
      return { success: true, path: outputPath, cached: true };
    } catch (err) {
      // File doesn't exist, proceed with generation
    }

    return new Promise((resolve, reject) => {
      // Track progress
      let duration = 0;

      ffmpeg(videoPath)
        .videoFilters('reverse')
        .audioFilters('areverse') // Also reverse audio if present
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('codecData', (data) => {
          duration = parseInt(data.duration.replace(/:/g, ''));
        })
        .on('progress', (progress) => {
          if (duration > 0) {
            const percent = (progress.timemark.replace(/:/g, '') / duration) * 100;
            // Send progress updates to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('reverse-video-progress', {
                videoPath,
                percent: Math.min(percent, 100),
                timemark: progress.timemark
              });
            }
          }
        })
        .on('end', () => {
          console.log(`Video reversal complete: ${outputPath}`);
          resolve({
            success: true,
            path: outputPath,
            cached: false
          });
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Failed to reverse video: ${err.message}`));
        })
        .run();
    });
  } catch (error) {
    console.error('Video reversal error:', error);
    return { success: false, error: error.message };
  }
});

// IPC: Check if reversed video exists
ipcMain.handle('check-reversed-video', async (event, videoPath) => {
  try {
    const parsedPath = path.parse(videoPath);
    const reversedPath = path.join(parsedPath.dir, `${parsedPath.name}_reversed${parsedPath.ext}`);

    try {
      await fs.access(reversedPath);
      return { exists: true, path: reversedPath };
    } catch (err) {
      return { exists: false, path: reversedPath };
    }
  } catch (error) {
    return { exists: false, error: error.message };
  }
});

// ==============================================================
// END FFMPEG FUNCTIONALITY
// ==============================================================

// ==============================================================
// MIDI FUNCTIONALITY
// ==============================================================

// Initialize MIDI input
function initializeMIDI() {
  try {
    // Create a new MIDI input
    midiInput = new midi.Input();

    // Get number of available input ports
    const portCount = midiInput.getPortCount();
    console.log(`Found ${portCount} MIDI input devices`);

    // Build list of MIDI devices
    midiDevices = [];
    for (let i = 0; i < portCount; i++) {
      const portName = midiInput.getPortName(i);
      midiDevices.push({ id: i, name: portName });
      console.log(`  [${i}] ${portName}`);
    }

    // Auto-connect to first device if available
    if (portCount > 0) {
      connectMIDIDevice(0);
    }

    return { success: true, devices: midiDevices };
  } catch (error) {
    console.error('MIDI initialization error:', error);
    return { success: false, error: error.message };
  }
}

// Connect to specific MIDI device
function connectMIDIDevice(portIndex) {
  try {
    // Close existing connection if any
    if (midiInput && currentMIDIPort !== null) {
      midiInput.closePort();
    }

    // Open the specified port
    midiInput.openPort(portIndex);
    currentMIDIPort = portIndex;

    console.log(`Connected to MIDI device: ${midiDevices[portIndex].name}`);

    // Set up message callback
    midiInput.on('message', (deltaTime, message) => {
      // Parse MIDI message
      const [status, data1, data2] = message;
      const messageType = status & 0xF0; // Get message type (high nibble)
      const channel = (status & 0x0F) + 1; // Get channel (low nibble), 1-indexed

      const midiMessage = {
        type: getMIDIMessageType(messageType),
        channel: channel,
        data1: data1,
        data2: data2,
        raw: message
      };

      // Add specific fields based on message type
      if (midiMessage.type === 'noteon' || midiMessage.type === 'noteoff') {
        midiMessage.note = data1;
        midiMessage.velocity = data2;
      } else if (midiMessage.type === 'cc') {
        midiMessage.controller = data1;
        midiMessage.value = data2;
      } else if (midiMessage.type === 'program') {
        midiMessage.program = data1;
      }

      // Send to renderer process
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('midi-message', midiMessage);
      }

      // Log for debugging
      console.log(`MIDI: ${midiMessage.type} Ch${channel} [${data1}, ${data2}]`);
    });

    return { success: true, port: portIndex, name: midiDevices[portIndex].name };
  } catch (error) {
    console.error('MIDI connection error:', error);
    return { success: false, error: error.message };
  }
}

// Helper to get MIDI message type name
function getMIDIMessageType(statusByte) {
  switch (statusByte) {
    case 0x80: return 'noteoff';
    case 0x90: return 'noteon';
    case 0xA0: return 'aftertouch';
    case 0xB0: return 'cc';
    case 0xC0: return 'program';
    case 0xD0: return 'channelpressure';
    case 0xE0: return 'pitchbend';
    default: return 'unknown';
  }
}

// IPC: Get available MIDI devices
ipcMain.handle('get-midi-devices', async () => {
  if (midiDevices.length === 0) {
    return initializeMIDI();
  }
  return { success: true, devices: midiDevices };
});

// IPC: Select MIDI device
ipcMain.handle('select-midi-device', async (event, portIndex) => {
  return connectMIDIDevice(portIndex);
});

// IPC: Get current MIDI device
ipcMain.handle('get-current-midi-device', async () => {
  return {
    success: true,
    port: currentMIDIPort,
    name: currentMIDIPort !== null ? midiDevices[currentMIDIPort].name : null
  };
});

// ==============================================================
// END MIDI FUNCTIONALITY
// ==============================================================

// ==============================================================
// HARDWARE ACCELERATION FOR VIDEO PERFORMANCE
// ==============================================================

// Enable hardware acceleration and GPU optimizations for smooth video playback
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// ==============================================================
// END HARDWARE ACCELERATION
// ==============================================================

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  // Initialize MIDI after window is created
  setTimeout(() => {
    initializeMIDI();
  }, 1000); // Small delay to ensure window is fully loaded

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up MIDI
  if (midiInput && currentMIDIPort !== null) {
    midiInput.closePort();
    console.log('MIDI port closed');
  }

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
