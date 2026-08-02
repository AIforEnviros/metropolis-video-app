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
  const handlers = {
    'get-midi-devices': () => ({ success: true, devices: [] }),
    'get-current-midi-device': () => ({ success: true, device: null }),
    'select-midi-device': () => ({ success: true }),
    'reinitialize-midi': () => ({ success: true, devices: [] }),
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

  // Work around auto-play for deterministic setup, then learn a keyboard drum trigger.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  await click(window, '#recordCuePointBtn');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 3`);
  await click(window, '#recordCuePointBtn');
  await waitFor(window, `document.querySelectorAll('.cue-marker').length === 2`, 'cue point setup');
  await setSlider(window, '#scrubRangeSlider', 0.5);
  await setSlider(window, '#scrubSpeedSlider', 4);
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubDrumKeyLearnBtn');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubDrumKeyDisplay').textContent.toLowerCase() === 'x'`, 'keyboard learn');

  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'first-hit activation');
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 2.2`, 'back-forward range stop', 3000);
  let state = await readState(window);
  assert.match(state.centre, /00:02/);
  assert.ok(state.time >= 2.2 && state.time <= 2.27, `back-forward stopped at ${state.time}`);

  await window.webContents.executeJavaScript(`(() => {
    window.__backwardStrokeSeeked = 0;
    document.getElementById('videoPlayer').addEventListener('seeked', () => {
      window.__backwardStrokeSeeked += 1;
    });
  })()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime <= 1.8`, 'backward range stroke', 3000);
  await waitFor(window, `window.__backwardStrokeSeeked >= 2`, 'backward decoded frames', 3000);
  state = await readState(window);
  assert.ok(state.time >= 1.73 && state.time <= 1.8, `backward stroke stopped at ${state.time}`);
  const backwardCompletedSeeks = await window.webContents.executeJavaScript(`window.__backwardStrokeSeeked`);
  assert.ok(backwardCompletedSeeks >= 2, `backward stroke decoded ${backwardCompletedSeeks} frames`);

  // A trigger during motion reverses at the current frame rather than jumping
  // to the opposite boundary.
  await setSlider(window, '#scrubSpeedSlider', 1);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
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
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime <= 1.8`, 'mid-stroke direction reversal', 3000);
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
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime > 1.2`, 'B/F full range forward motion', 3000);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime <= 0.8`, 'B/F full range reverse boundary', 3000);
  await click(window, '#clearInOutBtn');
  await waitFor(window, `document.getElementById('videoPlayer').currentTime < 0.05`, 'B/F full video start after clearing In/Out');
  await click(window, '#scrubFullRangeToggle');
  await setSlider(window, '#scrubSpeedSlider', 4);

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
  await new Promise(resolve => setTimeout(resolve, 180));
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
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 2.2`, 'pop-out forward stroke', 3000);
  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutBackwardSeeked = 0;
    document.getElementById('previewVideo').addEventListener('seeked', () => {
      window.__popoutBackwardSeeked += 1;
    });
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime <= 1.8`, 'pop-out backward stroke', 3000);
  await waitFor(previewWindow, `window.__popoutBackwardSeeked >= 2`, 'pop-out backward decoded frames', 3000);
  const popoutBackwardSeeks = await previewWindow.webContents.executeJavaScript(`window.__popoutBackwardSeeked`);
  assert.ok(popoutBackwardSeeks >= 2, `pop-out backward stroke decoded ${popoutBackwardSeeks} frames`);

  await setSlider(window, '#scrubSpeedSlider', 1);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime >= 1.9 && document.getElementById('previewVideo').currentTime < 2.1`, 'pop-out forward mid-stroke position', 3000);
  const popoutTurnTime = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  await previewWindow.webContents.executeJavaScript(`(() => {
    window.__popoutMidReverseMax = document.getElementById('previewVideo').currentTime;
    document.getElementById('previewVideo').addEventListener('seeked', () => {
      window.__popoutMidReverseMax = Math.max(window.__popoutMidReverseMax, document.getElementById('previewVideo').currentTime);
    });
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime <= 1.8`, 'pop-out mid-stroke direction reversal', 3000);
  const popoutMidReverseMax = await previewWindow.webContents.executeJavaScript(`window.__popoutMidReverseMax`);
  assert.ok(popoutMidReverseMax <= popoutTurnTime + 0.08, `pop-out reversal jumped from ${popoutTurnTime} to ${popoutMidReverseMax}`);

  await click(window, '#scrubFullRangeToggle');
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime < 0.05`, 'pop-out B/F full video start');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime > 0.5`, 'pop-out B/F full range forward motion', 3000);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(previewWindow, `document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime < 0.05`, 'pop-out B/F full range reverse boundary', 3000);
  await click(window, '#scrubFullRangeToggle');

  // Per-slot scrub settings restore independently and serialize in session v1.10.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'slot one scrub disabled');
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
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

  savedSessionData = null;
  await click(window, '#saveSessionBtn');
  await waitForNode(() => savedSessionData !== null, 'session save capture');
  assert.equal(savedSessionData.version, '1.10');
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['1'], {
    enabled: false,
    mode: 'hold',
    range: 0.65,
    speed: 1.7,
    fullRange: false
  });
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['2'], {
    enabled: true,
    mode: 'back-forward',
    range: 1.25,
    speed: 1.5,
    fullRange: true
  });

  // Round-trip through the real session loader, not just the serialized object.
  await setSlider(window, '#scrubRangeSlider', 3);
  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.10 reload', 10000);
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0 && document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'hold'`, 'reloaded slot one', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.65');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`), 'none');
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward' && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'reloaded slot two', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '1.25');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubFullRangeToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

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
    active: document.getElementById('scrubActiveBadge').style.display !== 'none'
  }))()`);
  assert.deepEqual(migratedState, { mode: 'hold', range: '0.8', speed: '2.2', fullRange: false, active: true });

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
