const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const midi = require('@julusian/midi');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Keep track of windows
let mainWindow = null;
let popoutWindow = null;

// MIDI state
const midiInputs = new Map();
let midiDevices = [];
let midiInitialized = false;

// Development mode detection
const isDev = process.argv.includes('--dev');

// MIDI debug mode (enable with: npm start -- --midi-debug)
const MIDI_DEBUG = process.argv.includes('--midi-debug');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      // Scrub range enforcement and MIDI-driven animation must keep running
      // when the projection window has focus.
      backgroundThrottling: false
    },
    title: 'Metropolis Live Remix',
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile('index.html');

  // Keep the performance launch clean. DevTools only opens when explicitly
  // requested through `npm run dev` / the `--dev` flag.
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

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
    // Close pop-out window if main window closes
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.close();
    }
  });
}

// IPC: Create preview pop-out window
ipcMain.handle('create-preview-popout', async () => {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.focus();
    return { success: true };
  }

  // Detect external display for pop-out
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  let windowOptions = {
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    },
    title: 'Metropolis Preview',
    backgroundColor: '#000000'
  };

  if (externalDisplay) {
    windowOptions.x = externalDisplay.bounds.x;
    windowOptions.y = externalDisplay.bounds.y;
    windowOptions.width = externalDisplay.bounds.width;
    windowOptions.height = externalDisplay.bounds.height;
    windowOptions.fullscreen = true;
    windowOptions.frame = false;
    console.log(`Pop-out positioned on external display at ${externalDisplay.bounds.x},${externalDisplay.bounds.y} (${externalDisplay.bounds.width}x${externalDisplay.bounds.height})`);
  } else {
    windowOptions.width = 1280;
    windowOptions.height = 720;
    console.log('No external display detected, using 1280x720 pop-out window');
  }

  popoutWindow = new BrowserWindow(windowOptions);
  popoutWindow.loadFile('preview-popout.html');

  popoutWindow.on('closed', () => {
    popoutWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('preview-popout-closed');
    }
  });

  return { success: true };
});

// IPC: Close preview pop-out
ipcMain.handle('close-preview-popout', async () => {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.close();
    popoutWindow = null;
  }
  return { success: true };
});

// IPC: Check if preview pop-out is open
ipcMain.handle('is-preview-popout-open', async () => {
  return { isOpen: popoutWindow && !popoutWindow.isDestroyed() };
});

// IPC: Forward commands from main window to pop-out
ipcMain.on('preview-popout-command', (event, command) => {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.webContents.send('preview-command', command);
  }
});

// IPC: Forward updates from pop-out to main window
ipcMain.on('preview-popout-update', (event, update) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('preview-update', update);
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
  // Use the platform-aware URL implementation so POSIX paths, spaces, # and
  // other reserved characters work identically on macOS and Windows.
  return { path: pathToFileURL(filePath).href };
});

ipcMain.on('path-to-file-url', (event, filePath) => {
  event.returnValue = pathToFileURL(filePath).href;
});

// ==============================================================
// FFMPEG VIDEO REVERSAL FUNCTIONALITY
// ==============================================================

// [BOUNCE MODE FIX] Track active FFmpeg processes for timeout and cancellation
let activeFFmpegProcesses = new Map(); // videoPath -> ffmpegCommand

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
      let timeoutId = null;

      // [BOUNCE MODE FIX] Create FFmpeg process and store reference
      const ffmpegCommand = ffmpeg(videoPath)
        .videoFilters('reverse')
        .audioFilters('areverse') // Also reverse audio if present
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
          // [BOUNCE MODE FIX] Set 10-minute timeout
          timeoutId = setTimeout(() => {
            console.error(`[TIMEOUT] Video reversal timed out after 10 minutes: ${videoPath}`);
            ffmpegCommand.kill('SIGTERM');
            activeFFmpegProcesses.delete(videoPath);
            reject(new Error('Video reversal timed out after 10 minutes. Try splitting the video into smaller segments.'));
          }, 600000); // 10 minutes in milliseconds
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
          // [BOUNCE MODE FIX] Clear timeout and remove from active processes
          if (timeoutId) clearTimeout(timeoutId);
          activeFFmpegProcesses.delete(videoPath);
          console.log(`Video reversal complete: ${outputPath}`);
          resolve({
            success: true,
            path: outputPath,
            cached: false
          });
        })
        .on('error', (err, stdout, stderr) => {
          // [BOUNCE MODE FIX] Clear timeout and remove from active processes
          if (timeoutId) clearTimeout(timeoutId);
          activeFFmpegProcesses.delete(videoPath);
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Failed to reverse video: ${err.message}`));
        });

      // [BOUNCE MODE FIX] Store reference and start processing
      activeFFmpegProcesses.set(videoPath, ffmpegCommand);
      ffmpegCommand.run();
    });
  } catch (error) {
    console.error('Video reversal error:', error);
    return { success: false, error: error.message };
  }
});

// [BOUNCE MODE FIX] IPC: Cancel video reversal
ipcMain.handle('cancel-video-reversal', async (event, videoPath) => {
  try {
    const ffmpegCommand = activeFFmpegProcesses.get(videoPath);
    if (ffmpegCommand) {
      console.log(`Cancelling video reversal for: ${videoPath}`);
      ffmpegCommand.kill('SIGTERM');
      activeFFmpegProcesses.delete(videoPath);
      return { success: true, message: 'Video reversal cancelled' };
    } else {
      return { success: false, message: 'No active reversal process found for this video' };
    }
  } catch (error) {
    console.error('Error cancelling video reversal:', error);
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

function closeAllMIDIInputs() {
  for (const { input, device } of midiInputs.values()) {
    try {
      input.removeAllListeners('message');
      input.closePort();
      console.log(`Closed MIDI input: ${device.name}`);
    } catch (error) {
      console.warn(`MIDI cleanup warning for ${device.name}:`, error.message);
    }
  }
  midiInputs.clear();
  midiInitialized = false;
}

function forwardMIDIMessage(device, deltaTime, message) {
  const [status, data1, data2] = message;
  const messageType = status & 0xF0;
  const channel = (status & 0x0F) + 1;
  const midiMessage = {
    type: getMIDIMessageType(messageType),
    channel,
    data1,
    data2,
    raw: message,
    deviceId: device.id,
    deviceName: device.name
  };

  if (midiMessage.type === 'noteon' || midiMessage.type === 'noteoff') {
    midiMessage.note = data1;
    midiMessage.velocity = data2;
  } else if (midiMessage.type === 'cc') {
    midiMessage.controller = data1;
    midiMessage.value = data2;
  } else if (midiMessage.type === 'program') {
    midiMessage.program = data1;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('midi-message', midiMessage);
  }

  if (MIDI_DEBUG) {
    console.log(`MIDI [${device.name}]: ${midiMessage.type} Ch${channel} [${data1}, ${data2}] dt=${deltaTime}`);
  }
}

// Enumerate and connect every available MIDI input. Mappings intentionally do
// not include device identity, so the same channel/note or CC from either
// controller performs the same action.
function initializeMIDI() {
  closeAllMIDIInputs();
  midiInitialized = true;

  try {
    const enumerator = new midi.Input();
    const portCount = enumerator.getPortCount();
    console.log(`Found ${portCount} MIDI input devices`);

    midiDevices = [];
    for (let portIndex = 0; portIndex < portCount; portIndex++) {
      midiDevices.push({
        id: portIndex,
        name: enumerator.getPortName(portIndex),
        connected: false
      });
    }

    for (const device of midiDevices) {
      const input = new midi.Input();
      input.on('message', (deltaTime, message) => {
        forwardMIDIMessage(device, deltaTime, message);
      });

      try {
        input.openPort(device.id);
        device.connected = true;
        midiInputs.set(device.id, { input, device });
        console.log(`Connected MIDI input [${device.id}]: ${device.name}`);
      } catch (error) {
        input.removeAllListeners('message');
        device.error = error.message;
        console.error(`Failed to open MIDI input [${device.id}] ${device.name}:`, error.message);
      }
    }

    return {
      success: true,
      devices: midiDevices,
      connectedCount: midiInputs.size
    };
  } catch (error) {
    midiDevices = [];
    midiInitialized = false;
    console.error('MIDI initialization error:', error);
    return { success: false, devices: [], connectedCount: 0, error: error.message };
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
  if (!midiInitialized) {
    return initializeMIDI();
  }
  return { success: true, devices: midiDevices, connectedCount: midiInputs.size };
});

// IPC: Reinitialize MIDI (close all ports, re-enumerate, connect all inputs)
ipcMain.handle('reinitialize-midi', async () => {
  return initializeMIDI();
});

// ==============================================================
// END MIDI FUNCTIONALITY
// ==============================================================

// ==============================================================
// HARDWARE ACCELERATION FOR VIDEO PERFORMANCE
// ==============================================================

// Enable hardware acceleration and GPU optimizations for smooth video playback
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// ==============================================================
// END HARDWARE ACCELERATION
// ==============================================================

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  // Initialize MIDI after window is created
  setTimeout(() => {
    if (!midiInitialized) initializeMIDI();
  }, 1000); // Small delay to ensure window is fully loaded

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      if (!midiInitialized) initializeMIDI();
    }
  });
});

app.on('window-all-closed', () => {
  closeAllMIDIInputs();

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
