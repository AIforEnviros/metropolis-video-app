const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Preview pop-out window management
  createPreviewPopout: () => ipcRenderer.invoke('create-preview-popout'),
  closePreviewPopout: () => ipcRenderer.invoke('close-preview-popout'),
  isPreviewPopoutOpen: () => ipcRenderer.invoke('is-preview-popout-open'),
  sendPreviewCommand: (command) => ipcRenderer.send('preview-popout-command', command),
  sendPreviewUpdate: (update) => ipcRenderer.send('preview-popout-update', update),

  // Listen for preview commands (for preview-popout.html)
  onPreviewCommand: (callback) => {
    ipcRenderer.on('preview-command', (event, command) => callback(command));
  },

  // Listen for preview updates (for main window)
  onPreviewUpdate: (callback) => {
    ipcRenderer.on('preview-update', (event, update) => callback(update));
  },

  // Listen for preview pop-out closed event
  onPreviewPopoutClosed: (callback) => {
    ipcRenderer.on('preview-popout-closed', () => callback());
  },

  // File system operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  getFilePath: (filePath) => ipcRenderer.invoke('get-file-path', filePath),

  // Session management
  saveSession: (sessionData) => ipcRenderer.invoke('save-session', sessionData),
  loadSession: () => ipcRenderer.invoke('load-session'),

  // Video reversal for bounce mode
  generateReversedVideo: (videoPath) => ipcRenderer.invoke('generate-reversed-video', videoPath),
  checkReversedVideo: (videoPath) => ipcRenderer.invoke('check-reversed-video', videoPath),
  cancelVideoReversal: (videoPath) => ipcRenderer.invoke('cancel-video-reversal', videoPath),

  // Listen for video reversal progress updates
  onReverseVideoProgress: (callback) => {
    ipcRenderer.on('reverse-video-progress', (event, data) => callback(data));
  },

  // MIDI operations
  getMIDIDevices: () => ipcRenderer.invoke('get-midi-devices'),
  selectMIDIDevice: (portIndex) => ipcRenderer.invoke('select-midi-device', portIndex),
  getCurrentMIDIDevice: () => ipcRenderer.invoke('get-current-midi-device'),

  // Listen for MIDI messages
  onMIDIMessage: (callback) => {
    ipcRenderer.on('midi-message', (event, message) => callback(message));
  },

  // Platform info
  platform: process.platform,

  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Log that preload script has loaded
console.log('Metropolis Preload Script Loaded');
console.log('Platform:', process.platform);
console.log('Electron Version:', process.versions.electron);
