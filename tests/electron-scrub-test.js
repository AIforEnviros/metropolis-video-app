const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const testVideoPath = path.join(projectRoot, 'test-videos', 'test-video.mp4');
let mainWindow = null;
let previewWindow = null;
let savedSessionData = null;
let sessionDataToLoad = null;

function registerRendererStubs() {
  const connectedMIDIDevices = [
    { id: 0, name: 'SPD-20', connected: true },
    { id: 1, name: 'DJ Controller', connected: true }
  ];
  const handlers = {
    'get-midi-devices': () => ({ success: true, devices: connectedMIDIDevices, connectedCount: 2 }),
    'reinitialize-midi': () => ({ success: true, devices: connectedMIDIDevices, connectedCount: 2 }),
    'is-preview-popout-open': () => Boolean(previewWindow && !previewWindow.isDestroyed()),
    'save-session': (_event, sessionData) => {
      savedSessionData = sessionData;
      sessionDataToLoad = sessionData;
      return { success: true, filePath: path.join(projectRoot, 'test-session.json') };
    },
    'load-session': () => ({
      success: true,
      sessionData: JSON.parse(JSON.stringify(sessionDataToLoad))
    })
  };
  Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler));
  ipcMain.on('path-to-file-url', (event, filePath) => {
    event.returnValue = require('node:url').pathToFileURL(filePath).href;
  });

  ipcMain.handle('create-preview-popout', async () => {
    if (!previewWindow || previewWindow.isDestroyed()) {
      previewWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: path.join(projectRoot, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false
        }
      });
      await previewWindow.loadFile(path.join(projectRoot, 'preview-popout.html'));
    }
    return { success: true };
  });
  ipcMain.handle('close-preview-popout', () => {
    if (previewWindow && !previewWindow.isDestroyed()) previewWindow.destroy();
    previewWindow = null;
    return { success: true };
  });
  ipcMain.on('preview-popout-command', (_event, command) => {
    if (previewWindow && !previewWindow.isDestroyed()) previewWindow.webContents.send('preview-command', command);
  });
  ipcMain.on('preview-popout-update', (_event, update) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('preview-update', update);
  });
}

async function waitFor(window, expression, message, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out: ${message}`);
}

async function waitForNode(predicate, message, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out: ${message}`);
}

async function readState(window) {
  return window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    return {
      time: video.currentTime,
      paused: video.paused,
      rate: video.playbackRate,
      active: document.getElementById('scrubActiveBadge').style.display !== 'none',
      centre: document.getElementById('scrubCentreDisplay').textContent,
      status: document.getElementById('scrubStatusLine').textContent
    };
  })()`);
}

async function click(window, selector) {
  await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click()`);
}

async function setSlider(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const slider = document.querySelector(${JSON.stringify(selector)});
    slider.value = ${JSON.stringify(String(value))};
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function run() {
  registerRendererStubs();
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(projectRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  mainWindow = window;

  const rendererErrors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) rendererErrors.push(message);
  });
  console.log('Loading renderer');
  await window.loadFile(path.join(projectRoot, 'index.html'));
  console.log('Waiting for matrix');
  await waitFor(window, `document.querySelectorAll('.clip-slot').length === 36`, 'matrix initialization');

  const previewControlLayout = await window.webContents.executeJavaScript(`(() => ({
    scrubTop: document.getElementById('scrubPanel').getBoundingClientRect().top,
    standardTop: document.getElementById('previewControlsPanel').getBoundingClientRect().top
  }))()`);
  assert.ok(
    previewControlLayout.scrubTop < previewControlLayout.standardTop,
    'scrub controls should appear above playback and cue controls'
  );
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('previewControlsPanelBody').classList.contains('collapsed')`),
    true,
    'playback and cue controls should start collapsed'
  );
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('previewControlsPanelToggle').getAttribute('aria-expanded')`),
    'false'
  );
  await click(window, '#previewControlsPanelToggle');
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('previewControlsPanelBody').classList.contains('collapsed')`),
    false,
    'playback and cue controls should expand when requested'
  );

  console.log('Dropping test video');
  const dropResult = await window.webContents.executeJavaScript(`(() => {
    try {
      const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
      window.draggedFile = {
        name: 'test-video.mp4',
        type: 'video/mp4',
        path: ${JSON.stringify(testVideoPath)}
      };
      slot.dispatchEvent(new Event('drop', { bubbles: true }));
      window.draggedFile = null;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.stack || error.message };
    }
  })()`);
  assert.equal(dropResult.ok, true, dropResult.error);
  console.log('Waiting for video metadata');
  try {
    await waitFor(window, `document.getElementById('videoPlayer').duration > 0`, 'test video metadata', 10000);
  } catch (error) {
    const diagnostics = await window.webContents.executeJavaScript(`(() => {
      const video = document.getElementById('videoPlayer');
      return {
        src: video.src,
        currentSrc: video.currentSrc,
        networkState: video.networkState,
        readyState: video.readyState,
        errorCode: video.error && video.error.code,
        errorMessage: video.error && video.error.message,
        status: document.getElementById('videoPlaybackStatus').textContent
      };
    })()`);
    console.error('Video metadata diagnostics:', diagnostics, rendererErrors);
    throw error;
  }
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'new slot scrub default-on');
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`),
    'manual-cc'
  );
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.clip-slot[data-clip-number="1"] .clip-scrub-indicator').textContent`),
    'Fader'
  );
  // The default U shortcut operates the same saved per-clip toggle as the UI.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'keyboard scrub toggle off');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'keyboard scrub toggle on');
  // Disable it for the legacy mode-by-mode scenarios below; later assertions
  // verify this OFF preference is retained for slot one.
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'disable default scrub for scenario setup');
  const encodedFileURL = await window.webContents.executeJavaScript(
    `window.electronAPI.pathToFileURL(${JSON.stringify(path.join(projectRoot, 'folder #1', 'video test.mp4'))})`
  );
  assert.ok(encodedFileURL.includes('%23') && encodedFileURL.includes('%20'), `file URL was not safely encoded: ${encodedFileURL}`);
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('videoPlaybackStatus').style.display`),
    'none'
  );
  const rangeSliderLimits = await window.webContents.executeJavaScript(`(() => {
    const slider = document.getElementById('scrubRangeSlider');
    return { min: slider.min, max: slider.max, step: slider.step };
  })()`);
  assert.deepEqual(rangeSliderLimits, { min: '0.1', max: '10', step: '0.05' });
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').disabled`), true);

  // A default Loop clip with no cue points must give full-video boundary
  // ownership to B/F instead of natively wrapping back to 00:00.
  await setSlider(window, '#scrubSpeedSlider', 4);
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubFullRangeToggle');
  await click(window, '#scrubDrumKeyLearnBtn');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubDrumKeyDisplay').textContent.toLowerCase() === 'x'`, 'keyboard learn');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('videoPlayer').loop === false`, 'B/F native-loop ownership');
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime > document.getElementById('videoPlayer').duration - 1`, 'no-cue full-video automatic reversal', 5000);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('videoPlayer').loop === true`, 'native loop restoration after B/F');
  await click(window, '#scrubFullRangeToggle');

  // Work around auto-play for deterministic cue-based scenarios.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  await click(window, '#recordCuePointBtn');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 3`);
  await click(window, '#recordCuePointBtn');
  await waitFor(window, `document.querySelectorAll('.cue-marker').length === 2`, 'cue point setup');

  // Accent points are separate, direct-trigger positions. Repeated accent
  // triggers restart the accent, while normal cue navigation resumes from the
  // logical normal cue position that was active before the accent.
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 1.25;
  })()`);
  await click(window, '.accent-set-btn[data-accent-slot="1"]');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 3.4`);
  await click(window, '.accent-set-btn[data-accent-slot="2"]');
  await waitFor(window, `document.querySelectorAll('.accent-marker').length === 2`, 'accent point setup');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.cue-marker').length`), 2);

  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 0;
  })()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 1.98`, 'first normal cue before accent');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= 1.24 && document.getElementById('videoPlayer').currentTime < 1.55`, 'accent one trigger');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 1.8`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= 1.24 && document.getElementById('videoPlayer').currentTime < 1.55`, 'accent one retrigger');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 2.98`, 'normal cue progression after accent');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);

  await click(window, '#shortcutsBtn');
  await waitFor(window, `document.getElementById('midiDeviceStatus').textContent.includes('Connected (2): SPD-20, DJ Controller')`, 'multi-input MIDI status');
  await click(window, '.midi-learn-btn[data-action="accent2"]');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 62, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  await waitFor(window, `document.querySelector('.midi-mapping-display[data-action="accent2"]').textContent.includes('Note 62')`, 'accent MIDI learn');
  await click(window, '.midi-learn-btn[data-action="toggleScrubMode"]');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 63, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  await waitFor(window, `document.querySelector('.midi-mapping-display[data-action="toggleScrubMode"]').textContent.includes('Note 63')`, 'scrub toggle MIDI learn');
  await click(window, '#saveShortcutsBtn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 63, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'MIDI scrub toggle on');
  await new Promise(resolve => setTimeout(resolve, 20));
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 63, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'MIDI scrub toggle off');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0`);
  // Mappings remain device-independent: the same note learned from the drum
  // controller must also work when it arrives from the DJ controller.
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 62, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= 3.39 && document.getElementById('videoPlayer').currentTime < 3.7`, 'accent MIDI trigger');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);

  // An accent can temporarily own its own scrub mode, range, and speed. The
  // same accent trigger restarts the effect, and Escape restores the clip's
  // ordinary scrub selection without overwriting it.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 1.6`);
  await click(window, '.accent-set-btn[data-accent-slot="3"]');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubSettingsScopeLabel').textContent`), /ACCENT A3/);
  await click(window, '.scrub-mode-btn[data-mode="manual-stutter"]');
  await setSlider(window, '#scrubRangeSlider', 0.8);
  await setSlider(window, '#scrubSpeedSlider', 1.5);

  // The general scrub trigger always belongs to the clip, even while the
  // accent settings are visible. It must not run A3's Manual Stutter as an
  // unsaved clip mode.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1') && document.getElementById('scrubActiveSource').textContent.includes('B/F')`, 'clip scrub ownership while editing accent');
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubSettingsScopeLabel').textContent`), /EDITING: ACCENT A3/);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'manual-stutter');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'clip scrub deactivation before accent handover');

  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none' && document.getElementById('scrubStatusLine').textContent.includes('Accent A3')`, 'accent scrub activation');
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveSource').textContent`), /ACTIVE: ACCENT A3/);
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubSettingsScopeLabel').textContent`), /EDITING: CLIP 1/);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'back-forward');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '2');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '4');
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 1.95`, 'accent manual stutter wait', 3000);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime < 1.8`, 'accent scrub retrigger restart', 3000);

  // The clip's own scrub trigger hands playback back from the accent and
  // immediately performs the saved B/F trigger.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1') && document.getElementById('scrubActiveSource').textContent.includes('B/F')`, 'accent-to-clip scrub handover');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'back-forward');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '2');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '4');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'clip scrub deactivation after accent handover');

  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0.5`);
  await click(window, '.accent-set-btn[data-accent-slot="4"]');
  const draggedAccentTarget = await window.webContents.executeJavaScript(`(() => {
    const marker = document.querySelector('.accent-marker[data-accent-slot="4"]');
    const track = document.getElementById('timelineTrack');
    const rect = track.getBoundingClientRect();
    const targetX = rect.left + (rect.width * 0.7);
    marker.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: marker.getBoundingClientRect().left
    }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: targetX, clientY: rect.top }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: targetX, clientY: rect.top }));
    return document.getElementById('videoPlayer').duration * 0.7;
  })()`);
  await waitFor(window, `Math.abs(document.getElementById('videoPlayer').currentTime - ${draggedAccentTarget}) < 0.05`, 'dragged accent preview position');
  const draggedAccentLeft = parseFloat(await window.webContents.executeJavaScript(`document.querySelector('.accent-marker[data-accent-slot="4"]').style.left`));
  assert.ok(Math.abs(draggedAccentLeft - 70) < 0.6, `dragged accent marker rendered at ${draggedAccentLeft}%`);

  await setSlider(window, '#scrubRangeSlider', 0.5);
  await setSlider(window, '#scrubSpeedSlider', 4);
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').disabled`), false);

  await window.webContents.executeJavaScript(`(() => {
    window.__backwardStrokeSeeked = 0;
    document.getElementById('videoPlayer').addEventListener('seeked', () => {
      if (document.getElementById('scrubStatusLine').textContent.includes('Playing: Back')) {
        window.__backwardStrokeSeeked += 1;
      }
    });
  })()`);
  await click(window, '#restartClipBtn');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'first-hit activation');
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime < 2.22`, 'automatic reverse at range end', 3000);
  await waitFor(window, `window.__backwardStrokeSeeked >= 2`, 'automatic backward decoded frames', 3000);
  let state = await readState(window);
  assert.match(state.centre, /00:02/);
  const backwardCompletedSeeks = await window.webContents.executeJavaScript(`window.__backwardStrokeSeeked`);
  assert.ok(backwardCompletedSeeks >= 2, `automatic backward stroke decoded ${backwardCompletedSeeks} frames`);
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward') && !document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime < 1.95`, 'automatic forward turn at range start', 3000);

  await setSlider(window, '#scrubSpeedSlider', 1);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:03') && document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward') && document.getElementById('videoPlayer').currentTime > 2.85`, 'B/F next cue starts forward');
  const cueForwardTime = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime < ${cueForwardTime} - 0.03`, 'B/F trigger reverses after cue-started playback', 3000);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:02') && document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward')`, 'B/F wrapped cue starts forward');

  // A trigger during motion reverses at the current frame rather than jumping
  // to the opposite boundary.
  await setSlider(window, '#scrubSpeedSlider', 1);
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 1.9 && document.getElementById('videoPlayer').currentTime < 2.1`, 'forward mid-stroke position', 3000);
  const localTurnTime = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  await window.webContents.executeJavaScript(`(() => {
    window.__localMidReverseMax = document.getElementById('videoPlayer').currentTime;
    document.getElementById('videoPlayer').addEventListener('seeked', () => {
      window.__localMidReverseMax = Math.max(window.__localMidReverseMax, document.getElementById('videoPlayer').currentTime);
    });
  })()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime < ${localTurnTime} - 0.04`, 'mid-stroke direction reversal', 3000);
  const localMidReverseMax = await window.webContents.executeJavaScript(`window.__localMidReverseMax`);
  assert.ok(localMidReverseMax <= localTurnTime + 0.08, `local reversal jumped from ${localTurnTime} to ${localMidReverseMax}`);

  // B/F alone can replace the centred 10-second range with the clip's full
  // playable In/Out span, while retaining current-frame direction changes.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0.75`);
  await click(window, '#setInPointBtn');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 3.5`);
  await click(window, '#setOutPointBtn');
  await click(window, '#scrubFullRangeToggle');
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 0.73 && document.getElementById('videoPlayer').currentTime <= 0.8`, 'B/F full In/Out range start');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeValue').textContent`), 'Full');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);
  await setSlider(window, '#scrubSpeedSlider', 4);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime > 1.2`, 'B/F full range forward motion', 3000);
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime < 3.4`, 'B/F In/Out automatic end reversal', 3000);
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward') && !document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime < 1.1`, 'B/F In/Out automatic start reversal', 3000);

  // Clearing In/Out while Full is selected expands B/F to the complete video.
  // Reaching the real media end must reverse there and continue, not reset to
  // zero and remain paused.
  await click(window, '#clearInOutBtn');
  await waitFor(window, `document.getElementById('videoPlayer').currentTime < 0.05`, 'B/F full video start after clearing In/Out');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime > document.getElementById('videoPlayer').duration - 1`, 'B/F full video automatic end reversal', 5000);
  await click(window, '#scrubFullRangeToggle');

  // Auto-reverse can be disabled per slot to restore the previous B/F
  // stop-and-wait boundary behavior.
  await click(window, '#scrubAutoReverseToggle');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), false);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 2.2 && document.getElementById('scrubStatusLine').textContent.includes('Next: Back')`, 'B/F stop-and-wait at range end', 3000);
  const stoppedAtEnd = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.ok(Math.abs(await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`) - stoppedAtEnd) < 0.02, 'B/F should remain stopped at the end boundary');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime <= 1.8 && document.getElementById('scrubStatusLine').textContent.includes('Next: Forward')`, 'B/F stop-and-wait at range start', 3000);
  await click(window, '#scrubAutoReverseToggle');

  // Escape must restore the original paused state and rate.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'escape deactivation');
  state = await readState(window);
  assert.equal(state.paused, true);
  assert.equal(state.rate, 1);

  // Manual CC owns playback, learns from MIDI, and maps exact endpoints.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  await click(window, '.scrub-mode-btn[data-mode="manual-cc"]');
  await click(window, '#scrubActivateBtn');
  await click(window, '#scrubCCLearnBtn');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 64 });
  await waitFor(window, `document.getElementById('scrubCCDisplay').textContent.includes('CC 14')`, 'CC learn');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 0 });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime < 1.8`, 'CC low endpoint');
  state = await readState(window);
  assert.ok(Math.abs(state.time - 1.75) < 0.04, `CC low mapped to ${state.time}`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 127 });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime > 2.2`, 'CC high endpoint');
  state = await readState(window);
  assert.ok(Math.abs(state.time - 2.25) < 0.04, `CC high mapped to ${state.time}`);
  assert.equal(state.paused, true);

  // A dense MIDI burst must coalesce intermediate seeks instead of queuing all
  // 128 frames and leaving playback trailing behind the physical fader.
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 0 });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime < 1.8`, 'CC burst reset');
  await window.webContents.executeJavaScript(`(() => {
    window.__faderSeekCount = 0;
    document.getElementById('videoPlayer').addEventListener('seeking', () => window.__faderSeekCount++);
  })()`);
  for (let value = 0; value <= 127; value++) {
    window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value });
  }
  await waitFor(window, `document.getElementById('videoPlayer').currentTime > 2.2`, 'coalesced CC burst endpoint');
  const burstSeekCount = await window.webContents.executeJavaScript(`window.__faderSeekCount`);
  assert.ok(burstSeekCount <= 8, `CC burst caused ${burstSeekCount} decoder seeks`);

  // Live mode switching must initialize each distinct behavior.
  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'stutter start');
  await new Promise(resolve => setTimeout(resolve, 450));
  state = await readState(window);
  assert.ok(state.time >= 1.7 && state.time <= 2.3, `stutter state: ${JSON.stringify(state)}`);

  // Manual stutter plays one pass, waits at the end, and only restarts when
  // its learned drum/key trigger is pressed.
  await setSlider(window, '#scrubSpeedSlider', 1);
  await click(window, '.scrub-mode-btn[data-mode="manual-stutter"]');
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 2.2`, 'manual stutter waits at end', 3000);
  assert.match(
    await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`),
    /Waiting for trigger/
  );
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime < 2.15`, 'manual stutter trigger restart', 3000);
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 2.2`, 'manual stutter second wait', 3000);
  await setSlider(window, '#scrubSpeedSlider', 4);

  await window.webContents.executeJavaScript(`(() => {
    window.__localPendulumSeeked = 0;
    document.getElementById('videoPlayer').addEventListener('seeked', () => {
      window.__localPendulumSeeked += 1;
    });
  })()`);
  await click(window, '.scrub-mode-btn[data-mode="pendulum"]');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'pendulum takes manual control');
  const samples = [];
  for (let index = 0; index < 12; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 45));
    samples.push((await readState(window)).time);
  }
  const deltas = samples.slice(1).map((value, index) => value - samples[index]);
  assert.ok(deltas.some(value => value > 0.01), 'pendulum moved forward');
  assert.ok(deltas.some(value => value < -0.01), 'pendulum moved backward');
  assert.ok(samples.every(value => value >= 1.72 && value <= 2.28), `pendulum samples stayed in range: ${samples.join(', ')}`);
  const localCompletedSeeks = await window.webContents.executeJavaScript(`window.__localPendulumSeeked`);
  assert.ok(localCompletedSeeks >= 3, `pendulum decoded ${localCompletedSeeks} frames`);

  await click(window, '.scrub-mode-btn[data-mode="drift"]');
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'drift start');
  state = await readState(window);
  assert.equal(state.rate, 1);
  const driftStart = state.time;
  await waitFor(window, `document.getElementById('videoPlayer').currentTime > ${driftStart} + 0.08`, 'drift advancement', 1000);
  state = await readState(window);
  assert.ok(state.time > driftStart + 0.08, 'drift advanced from centre');

  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'hold pause');
  state = await readState(window);
  assert.ok(Math.abs(state.time - 2) < 0.04, `hold froze at centre: ${state.time}`);

  // The remappable next-cue key gets priority even while a scrub slider has
  // focus, and wraps from the final cue back to the first.
  await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').focus()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:03')`, 'active scrub cue recenter');
  state = await readState(window);
  assert.equal(state.paused, true);
  assert.ok(Math.abs(state.time - 3) < 0.04, `hold remained at the new cue: ${state.time}`);

  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:02')`, 'last cue wraps to first');
  state = await readState(window);
  assert.equal(state.paused, true);
  assert.ok(Math.abs(state.time - 2) < 0.04, `hold wrapped to the first cue: ${state.time}`);

  // MIDI drum mapping also activates on the first hit, matching keyboard behavior.
  await click(window, '#scrubActivateBtn');
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubDrumLearnBtn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(window, `document.getElementById('scrubDrumDisplay').textContent.includes('Note 60')`, 'drum MIDI learn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'MIDI first-hit activation');
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'MIDI back-forward trigger');

  // Exercise the same controller with the pop-out as the playback owner.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'deactivate before pop-out');
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 2;
  })()`);
  await click(window, '#outputWindowBtn');
  await waitForNode(() => previewWindow && !previewWindow.isDestroyed(), 'pop-out creation');
  await waitFor(previewWindow, `document.getElementById('previewVideo').duration > 0`, 'pop-out video metadata', 10000);

  await window.webContents.executeJavaScript(`document.activeElement && document.activeElement.blur()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime >= 1.24 && document.getElementById('previewVideo').currentTime < 1.55`, 'pop-out accent trigger');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Accent A3')`, 'pop-out accent scrub activation');
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 1.95`, 'pop-out accent manual stutter wait', 3000);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'pop-out accent scrub deactivation');
  await previewWindow.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('previewVideo');
    video.pause();
    video.currentTime = 2;
  })()`);
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime >= 1.98`, 'restore pop-out scrub centre after accent');

  await click(window, '.scrub-mode-btn[data-mode="manual-cc"]');
  await click(window, '#scrubActivateBtn');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 0 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime < 1.8`, 'pop-out CC low endpoint');
  let popoutTime = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  assert.ok(Math.abs(popoutTime - 1.75) < 0.04, `pop-out CC low mapped to ${popoutTime}`);
  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutFaderSeekCount = 0;
    document.getElementById('previewVideo').addEventListener('seeking', () => window.__popoutFaderSeekCount++);
  })()`);
  for (let value = 0; value <= 127; value++) {
    window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value });
  }
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime > 2.2`, 'coalesced pop-out CC burst endpoint');
  const popoutFaderSeekCount = await previewWindow.webContents.executeJavaScript(`window.__popoutFaderSeekCount`);
  assert.ok(popoutFaderSeekCount <= 8, `pop-out CC burst caused ${popoutFaderSeekCount} decoder seeks`);

  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused`, 'pop-out stutter start');
  await new Promise(resolve => setTimeout(resolve, 450));
  popoutTime = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  assert.ok(popoutTime >= 1.7 && popoutTime <= 2.3, `pop-out stutter stayed in range at ${popoutTime}`);

  await setSlider(window, '#scrubSpeedSlider', 1);
  await click(window, '.scrub-mode-btn[data-mode="manual-stutter"]');
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 2.2`, 'pop-out manual stutter waits at end', 3000);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime < 2.15`, 'pop-out manual stutter trigger restart', 3000);
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 2.2`, 'pop-out manual stutter second wait', 3000);
  await setSlider(window, '#scrubSpeedSlider', 4);

  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutPendulumSeeked = 0;
    document.getElementById('previewVideo').addEventListener('seeked', () => {
      window.__popoutPendulumSeeked += 1;
    });
  })()`);
  await click(window, '.scrub-mode-btn[data-mode="pendulum"]');
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused`, 'pop-out pendulum pause');
  const popoutSamples = [];
  for (let index = 0; index < 12; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 45));
    popoutSamples.push(await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`));
  }
  const popoutDeltas = popoutSamples.slice(1).map((value, index) => value - popoutSamples[index]);
  assert.ok(popoutDeltas.some(value => value > 0.01), 'pop-out pendulum moved forward');
  assert.ok(popoutDeltas.some(value => value < -0.01), 'pop-out pendulum moved backward');
  const popoutCompletedSeeks = await previewWindow.webContents.executeJavaScript(`window.__popoutPendulumSeeked`);
  assert.ok(popoutCompletedSeeks >= 3, `pop-out pendulum decoded ${popoutCompletedSeeks} frames`);

  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused`, 'pop-out paused-state restore');

  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutBackwardSeeked = 0;
    document.getElementById('previewVideo').addEventListener('seeked', () => {
      window.__popoutBackwardSeeked += 1;
    });
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').loop === false`, 'pop-out B/F native-loop ownership');
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back')`, 'pop-out automatic reverse at range end', 3000);
  await waitFor(previewWindow, `window.__popoutBackwardSeeked >= 2`, 'pop-out backward decoded frames', 3000);
  const popoutBackwardSeeks = await previewWindow.webContents.executeJavaScript(`window.__popoutBackwardSeeked`);
  assert.ok(popoutBackwardSeeks >= 2, `pop-out automatic backward stroke decoded ${popoutBackwardSeeks} frames`);
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const previewState = await previewWindow.webContents.executeJavaScript(`({ paused: document.getElementById('previewVideo').paused, time: document.getElementById('previewVideo').currentTime })`);
    return status.includes('Playing: Forward') && !previewState.paused && previewState.time < 1.95;
  }, 'pop-out automatic forward turn at range start', 3000);

  await setSlider(window, '#scrubSpeedSlider', 1);
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 1.9 && document.getElementById('previewVideo').currentTime < 2.1`, 'pop-out forward mid-stroke position', 3000);
  const popoutTurnTime = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutMidReverseMax = document.getElementById('previewVideo').currentTime;
    document.getElementById('previewVideo').addEventListener('seeked', () => {
      window.__popoutMidReverseMax = Math.max(window.__popoutMidReverseMax, document.getElementById('previewVideo').currentTime);
    });
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const time = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
    return status.includes('Playing: Back') && time < popoutTurnTime - 0.04;
  }, 'pop-out mid-stroke direction reversal', 3000);
  const popoutMidReverseMax = await previewWindow.webContents.executeJavaScript(`window.__popoutMidReverseMax`);
  assert.ok(popoutMidReverseMax <= popoutTurnTime + 0.08, `pop-out reversal jumped from ${popoutTurnTime} to ${popoutMidReverseMax}`);

  await setSlider(window, '#scrubSpeedSlider', 4);
  await click(window, '#scrubFullRangeToggle');
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime < 0.05`, 'pop-out B/F full video start');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime > 0.5`, 'pop-out B/F full range forward motion', 3000);
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const previewState = await previewWindow.webContents.executeJavaScript(`({ time: document.getElementById('previewVideo').currentTime, duration: document.getElementById('previewVideo').duration })`);
    return status.includes('Playing: Back') && previewState.time > previewState.duration - 1;
  }, 'pop-out B/F full video automatic end reversal', 5000);
  await click(window, '#scrubFullRangeToggle');

  await click(window, '#scrubAutoReverseToggle');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const previewState = await previewWindow.webContents.executeJavaScript(`({ paused: document.getElementById('previewVideo').paused, time: document.getElementById('previewVideo').currentTime })`);
    return status.includes('Next: Back') && previewState.paused && previewState.time >= 2.2;
  }, 'pop-out B/F stop-and-wait at range end', 3000);
  const popoutStoppedAtEnd = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.ok(Math.abs(await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`) - popoutStoppedAtEnd) < 0.02, 'pop-out B/F should remain stopped at the end boundary');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const previewState = await previewWindow.webContents.executeJavaScript(`({ paused: document.getElementById('previewVideo').paused, time: document.getElementById('previewVideo').currentTime })`);
    return status.includes('Next: Forward') && previewState.paused && previewState.time <= 1.8;
  }, 'pop-out B/F stop-and-wait at range start', 3000);
  await click(window, '#scrubAutoReverseToggle');

  // Per-slot scrub/accent settings restore independently and serialize in session v1.13.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'slot one scrub disabled');
  await waitFor(previewWindow, `document.getElementById('previewVideo').loop === true`, 'pop-out native loop restoration after B/F');
  await click(window, '#outputWindowBtn');
  await waitForNode(() => !previewWindow || previewWindow.isDestroyed(), 'pop-out close');
  await setSlider(window, '#scrubRangeSlider', 0.65);
  await setSlider(window, '#scrubSpeedSlider', 1.7);
  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.clip-slot[data-clip-number="1"] .clip-scrub-indicator').classList.contains('off')`),
    true
  );

  const secondDropResult = await window.webContents.executeJavaScript(`(() => {
    try {
      const slot = document.querySelector('.clip-slot[data-clip-number="2"]');
      window.draggedFile = {
        name: 'test-video-2.mp4',
        type: 'video/mp4',
        path: ${JSON.stringify(testVideoPath)}
      };
      slot.dispatchEvent(new Event('drop', { bubbles: true }));
      window.draggedFile = null;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.stack || error.message };
    }
  })()`);
  assert.equal(secondDropResult.ok, true, secondDropResult.error);
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="2"]').classList.contains('selected') && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot two default scrub activation', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'manual-cc');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '2');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1');

  await setSlider(window, '#scrubRangeSlider', 1.25);
  await setSlider(window, '#scrubSpeedSlider', 1.5);
  await click(window, '.scrub-mode-btn[data-mode="drift"]');
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="1"]').classList.contains('selected') && document.getElementById('videoPlayer').duration > 0`, 'slot one restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'hold');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.65');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.7');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`), 'none');

  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'drift' && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot two restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '1.25');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.5');
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubFullRangeToggle');
  await click(window, '#scrubAutoReverseToggle');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0.8`);
  await click(window, '.accent-set-btn[data-accent-slot="1"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

  savedSessionData = null;
  await click(window, '#saveSessionBtn');
  await waitForNode(() => savedSessionData !== null, 'session save capture');
  assert.equal(savedSessionData.version, '1.13');
  assert.deepEqual(savedSessionData.midiMappings.accent2, { type: 'noteon', channel: 1, note: 62 });
  assert.deepEqual(savedSessionData.midiMappings.toggleScrubMode, { type: 'noteon', channel: 1, note: 63 });
  assert.equal(savedSessionData.tabs.accentPoints['0']['1']['1'].time, 1.25);
  assert.equal(savedSessionData.tabs.accentPoints['0']['2']['1'].time, 0.8);
  assert.equal(savedSessionData.tabs.accentPoints['0']['1']['2'].time, 3.4);
  assert.ok(Math.abs(savedSessionData.tabs.accentPoints['0']['1']['4'].time - draggedAccentTarget) < 0.05);
  assert.deepEqual(
    {
      mode: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubMode,
      range: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubRange,
      speed: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubSpeed
    },
    { mode: 'manual-stutter', range: 0.8, speed: 1.5 }
  );
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['1'], {
    enabled: false,
    mode: 'hold',
    range: 0.65,
    speed: 1.7,
    fullRange: false,
    autoReverse: true
  });
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['2'], {
    enabled: true,
    mode: 'back-forward',
    range: 1.25,
    speed: 1.5,
    fullRange: true,
    autoReverse: false
  });

  // Round-trip through the real session loader, not just the serialized object.
  await setSlider(window, '#scrubRangeSlider', 3);
  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.13 reload', 10000);
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0 && document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'hold'`, 'reloaded slot one', 10000);
  await waitFor(window, `document.querySelectorAll('.accent-marker').length === 4`, 'reloaded slot one accents');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'manual-stutter');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.8');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.5');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.65');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`), 'none');
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward' && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'reloaded slot two', 10000);
  await waitFor(window, `document.querySelectorAll('.accent-marker').length === 1`, 'reloaded slot two accents');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '1.25');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubFullRangeToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), false);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

  // v1.12 accents did not have their own scrub settings. They migrate to None
  // with the default 2-second range and 1x speed.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.version = '1.12';
  const legacyAccent = sessionDataToLoad.tabs.accentPoints['0']['1']['1'];
  delete legacyAccent.scrubMode;
  delete legacyAccent.scrubRange;
  delete legacyAccent.scrubSpeed;
  await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent = 'Loading v1.12 accent test…'`);
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.12 accent migration', 10000);
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0`, 'v1.12 accent slot restore', 10000);
  await click(window, '.scrub-target-btn[data-scrub-target="accent1"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubNoneModeBtn').classList.contains('selected')`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '2');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1');

  // v1.10 per-slot sessions did not have autoReverse. They must migrate to
  // the new continuous/default behavior rather than unexpectedly stopping.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.version = '1.10';
  delete sessionDataToLoad.tabs.accentPoints;
  Object.values(sessionDataToLoad.tabs.scrubSettings).forEach(tabSettings => {
    Object.values(tabSettings).forEach(settings => delete settings.autoReverse);
  });
  await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent = 'Loading v1.10 test…'`);
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.10 migration', 10000);
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward'`, 'v1.10 slot restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), true);

  // v1.8 global scrub values migrate to each loaded slot with scrub ON.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.version = '1.8';
  delete sessionDataToLoad.tabs.scrubSettings;
  sessionDataToLoad.scrubSettings.range = 0.8;
  sessionDataToLoad.scrubSettings.speed = 2.2;
  sessionDataToLoad.scrubSettings.lastMode = 'hold';
  await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent = 'Loading legacy test…'`);
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'legacy session migration', 10000);
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0 && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'migrated slot video load', 10000);
  const migratedState = await window.webContents.executeJavaScript(`(() => ({
    mode: document.querySelector('.scrub-mode-btn.selected').dataset.mode,
    range: document.getElementById('scrubRangeSlider').value,
    speed: document.getElementById('scrubSpeedSlider').value,
    fullRange: document.getElementById('scrubFullRangeToggle').checked,
    autoReverse: document.getElementById('scrubAutoReverseToggle').checked,
    active: document.getElementById('scrubActiveBadge').style.display !== 'none'
  }))()`);
  assert.deepEqual(migratedState, { mode: 'hold', range: '0.8', speed: '2.2', fullRange: false, autoReverse: true, active: true });

  const relevantErrors = rendererErrors.filter(message => !message.includes('MIDI') && !message.includes('favicon'));
  assert.deepEqual(relevantErrors, []);
  window.destroy();
  if (previewWindow && !previewWindow.isDestroyed()) previewWindow.destroy();
  console.log('Scrub integration test passed');
}

app.whenReady().then(run).then(() => app.quit()).catch(error => {
  console.error(error);
  app.exit(1);
});
