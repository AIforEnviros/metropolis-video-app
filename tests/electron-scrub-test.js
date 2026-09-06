const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const testVideoPath = path.join(projectRoot, 'test-videos', 'test-video.mp4');
const runShortRangeDiagnostics = process.argv.includes('--short-range-diagnostics');
let mainWindow = null;
let previewWindow = null;
let savedSessionData = null;
let sessionDataToLoad = null;
let collectedSessionData = null;
let previewCommands = [];

function registerRendererStubs() {
  const connectedMIDIDevices = [
    { id: 0, name: 'SPD-20', connected: true },
    { id: 1, name: 'DJ Controller', connected: true }
  ];
  const handlers = {
    'get-midi-devices': () => ({ success: true, devices: connectedMIDIDevices, connectedCount: 2 }),
    'reinitialize-midi': () => ({ success: true, devices: connectedMIDIDevices, connectedCount: 2 }),
    'collect-all-and-save': (_event, sessionData) => {
      collectedSessionData = JSON.parse(JSON.stringify(sessionData));
      const uniquePaths = new Set();
      Object.values(sessionData.tabs.videos).forEach(tabVideos => {
        Object.values(tabVideos || {}).forEach(videoData => {
          if (videoData?.filePath) uniquePaths.add(videoData.filePath);
        });
      });
      return {
        success: true,
        sessionData: collectedSessionData,
        sessionFilePath: path.join(projectRoot, 'portable-test', 'test-session.json'),
        files: [...uniquePaths].map(sourcePath => ({
          sourcePath,
          collectedPath: sourcePath,
          relativePath: `Media/${path.basename(sourcePath)}`
        }))
      };
    },
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
        show: true,
        width: 320,
        height: 180,
        x: 1000,
        y: 0,
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
    previewCommands.push(JSON.parse(JSON.stringify(command)));
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

async function measureVideoActivity(window, selector, durationMs = 650) {
  return window.webContents.executeJavaScript(`(() => new Promise(resolve => {
    const video = document.querySelector(${JSON.stringify(selector)});
    let seeking = 0;
    let seeked = 0;
    let callbackId = null;
    let previousWallTime = null;
    let maximumFrameGap = 0;
    const mediaTimes = [];
    const onSeeking = () => { seeking += 1; };
    const onSeeked = () => { seeked += 1; };
    const onFrame = (now, metadata) => {
      mediaTimes.push(metadata.mediaTime);
      if (previousWallTime !== null) maximumFrameGap = Math.max(maximumFrameGap, now - previousWallTime);
      previousWallTime = now;
      callbackId = video.requestVideoFrameCallback(onFrame);
    };
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    callbackId = video.requestVideoFrameCallback(onFrame);
    setTimeout(() => {
      if (callbackId !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callbackId);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      let directionChanges = 0;
      let previousDirection = 0;
      for (let index = 1; index < mediaTimes.length; index += 1) {
        const delta = mediaTimes[index] - mediaTimes[index - 1];
        const direction = Math.abs(delta) < 0.0005 ? 0 : Math.sign(delta);
        if (direction && previousDirection && direction !== previousDirection) directionChanges += 1;
        if (direction) previousDirection = direction;
      }
      resolve({
        frames: mediaTimes.length,
        uniqueFrames: new Set(mediaTimes.map(time => time.toFixed(4))).size,
        seeking,
        seeked,
        pendingSeeks: Math.max(0, seeking - seeked),
        directionChanges,
        maximumFrameGapMs: Number(maximumFrameGap.toFixed(1)),
        minimumTime: mediaTimes.length ? Number(Math.min(...mediaTimes).toFixed(4)) : null,
        maximumTime: mediaTimes.length ? Number(Math.max(...mediaTimes).toFixed(4)) : null,
        paused: video.paused,
        stillSeeking: video.seeking
      });
    }, ${Number(durationMs)});
  }))()`);
}

async function runShortRangeModeDiagnostics(controlWindow, playbackWindow, videoSelector, outputLabel) {
  const results = [];
  await setSlider(controlWindow, '#scrubRangeSlider', 0.1);
  for (const speed of [1, 2, 4]) {
    await setSlider(controlWindow, '#scrubSpeedSlider', speed);
    await click(controlWindow, '.scrub-mode-btn[data-mode="stutter"]');
    await waitFor(playbackWindow, `!document.querySelector(${JSON.stringify(videoSelector)}).paused`, `${outputLabel} 0.1s stutter ${speed}x start`);
    results.push({
      output: outputLabel,
      mode: 'stutter',
      range: 0.1,
      speed,
      ...(await measureVideoActivity(playbackWindow, videoSelector))
    });

    await click(controlWindow, '.scrub-mode-btn[data-mode="pendulum"]');
    await waitFor(playbackWindow, `document.querySelector(${JSON.stringify(videoSelector)}).paused`, `${outputLabel} 0.1s pendulum ${speed}x start`);
    results.push({
      output: outputLabel,
      mode: 'pendulum',
      range: 0.1,
      speed,
      ...(await measureVideoActivity(playbackWindow, videoSelector))
    });
  }
  results.filter(result => result.mode === 'stutter').forEach(result => {
    assert.ok(
      result.pendingSeeks <= 1,
      `${outputLabel} ${result.speed}x Stutter queued ${result.pendingSeeks} decoder seeks`
    );
    assert.ok(
      result.seeked > 0,
      `${outputLabel} ${result.speed}x Stutter completed no decoder seeks`
    );
  });
  results.forEach(result => console.log(`SHORT_RANGE ${JSON.stringify(result)}`));

  // Stop the seek-heavy diagnostic before restoring the normal test state.
  await click(controlWindow, '#scrubActivateBtn');
  await waitFor(controlWindow, `document.getElementById('scrubActiveBadge').style.display === 'none'`, `${outputLabel} short-range diagnostic stop`);
  await setSlider(controlWindow, '#scrubRangeSlider', 0.5);
  await setSlider(controlWindow, '#scrubSpeedSlider', 4);
  await playbackWindow.webContents.executeJavaScript(`(() => {
    const video = document.querySelector(${JSON.stringify(videoSelector)});
    video.pause();
    video.load();
  })()`);
  await waitFor(
    playbackWindow,
    `document.querySelector(${JSON.stringify(videoSelector)}).duration > 0 && document.querySelector(${JSON.stringify(videoSelector)}).readyState >= 2`,
    `${outputLabel} short-range decoder reload`,
    10000
  );
  await playbackWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(videoSelector)}).currentTime = 2`);
  await waitFor(
    playbackWindow,
    `!document.querySelector(${JSON.stringify(videoSelector)}).seeking && Math.abs(document.querySelector(${JSON.stringify(videoSelector)}).currentTime - 2) < 0.04`,
    `${outputLabel} short-range decoder recovery`
  );
  await click(controlWindow, '#scrubActivateBtn');
  await waitFor(controlWindow, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, `${outputLabel} short-range mode restore`);
  return results;
}

async function run() {
  registerRendererStubs();
  const window = new BrowserWindow({
    show: true,
    width: 960,
    height: 720,
    x: 0,
    y: 0,
    webPreferences: {
      preload: path.join(projectRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  mainWindow = window;

  const rendererErrors = [];
  const rendererMessages = [];
  window.webContents.on('console-message', (_event, level, message) => {
    rendererMessages.push(message);
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

  await window.webContents.executeJavaScript(`(() => {
    window.__unexpectedAlertCount = 0;
    window.alert = () => { window.__unexpectedAlertCount += 1; };
  })()`);
  for (const selector of [
    '#recordCuePointBtn',
    '#setInPointBtn',
    '#setOutPointBtn',
    '#clearInOutBtn',
    '#restartClipBtn',
    '#prevCuePointBtn',
    '#nextCuePointBtn'
  ]) {
    await click(window, selector);
  }
  assert.equal(
    await window.webContents.executeJavaScript(`window.__unexpectedAlertCount`),
    0,
    'clip controls should be silent when no clip is selected'
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
  // With no normal cue points, Fader stays armed while the clip plays. Moving
  // the controller temporarily scratches, then playback resumes from the last
  // decoded scratch frame after the CC stream becomes idle.
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime > 1.1`, 'cue-less Fader armed playback', 5000);
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveSource').textContent`), /FADER ARMED/);
  await click(window, '#scrubCCLearnBtn');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 64 });
  await waitFor(window, `document.getElementById('scrubCCDisplay').textContent.includes('CC 14')`, 'cue-less Fader CC learn');
  const beforeMomentaryScratch = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 0 });
  await waitFor(window, `document.getElementById('videoPlayer').paused && document.getElementById('scrubActiveSource').textContent.includes('FADER SCRATCHING') && document.getElementById('videoPlayer').currentTime < ${beforeMomentaryScratch - 0.7}`, 'cue-less Fader scratch ownership');
  const scratchedPosition = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  assert.ok(scratchedPosition < beforeMomentaryScratch - 0.7, `cue-less scratch moved from ${beforeMomentaryScratch} to ${scratchedPosition}`);
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('scrubActiveSource').textContent.includes('FADER ARMED')`, 'cue-less Fader playback resume', 3000);
  const resumedScratchPosition = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  await waitFor(window, `document.getElementById('videoPlayer').currentTime > ${resumedScratchPosition + 0.1}`, 'cue-less Fader resumed progression');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'pause armed cue-less Fader');
  const beforePausedScratch = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 127 });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime > ${beforePausedScratch + 0.7}`, 'paused cue-less Fader scratch seek');
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('FADER ARMED')`, 'paused cue-less Fader release', 3000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').paused`), true);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'resume after paused cue-less Fader test');
  await window.webContents.executeJavaScript(`window.alert = message => { window.__lastAlert = message; }; true`);
  collectedSessionData = null;
  await click(window, '#collectAllBtn');
  await waitForNode(() => collectedSessionData !== null, 'Collect All & Save renderer request');
  assert.equal(collectedSessionData.version, '1.18');
  await waitFor(window, `document.getElementById('collectAllBtn').disabled === false && document.getElementById('collectAllBtn').textContent === 'Collect All & Save'`, 'Collect All & Save button restoration');
  assert.match(await window.webContents.executeJavaScript(`window.__lastAlert`), /unique video file\(s\) collected/);
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

  // The performance trigger is execution-only. It must not arm a clip whose
  // saved scrub state is OFF; only the dedicated toggle may do that.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`),
    'none',
    'keyboard scrub trigger must not arm an OFF clip'
  );
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').loop`), true);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'keyboard scrub toggle arms B/F');
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

  // A direct accent coincident with a normal cue must be treated as an
  // intentional jump, not immediately stopped by Forward & Stop detection.
  await window.webContents.executeJavaScript(`(() => {
    const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
    slot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
  })()`);
  await click(window, '#clipContextMenu .context-menu-item[data-mode="forward-stop"]');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  await click(window, '.accent-set-btn[data-accent-slot="1"]');
  await window.webContents.executeJavaScript(`document.activeElement && document.activeElement.blur()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').paused`),
    false,
    'coincident accent must keep playing in Forward & Stop mode'
  );
  await window.webContents.executeJavaScript(`(() => {
    const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
    slot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
  })()`);
  await click(window, '#clipContextMenu .context-menu-item[data-mode="loop"]');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 1.25`);
  await click(window, '.accent-set-btn[data-accent-slot="1"]');
  await click(window, '#restartClipBtn');

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
  await click(window, '.midi-learn-btn[data-action="nextCuePoint"]');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 66, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  await waitFor(window, `document.querySelector('.midi-mapping-display[data-action="nextCuePoint"]').textContent.includes('Note 66')`, 'next cue MIDI learn');
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.shortcut-input[data-action="outputFade"]').textContent`),
    'MIDI CC only'
  );
  await click(window, '.midi-learn-btn[data-action="outputFade"]');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 64, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.midi-learn-btn[data-action="outputFade"]').textContent`),
    'Waiting...',
    'output fade learn must ignore note messages'
  );
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 127, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.querySelector('.midi-mapping-display[data-action="outputFade"]').textContent.includes('CC 21')`, 'output fade CC learn');
  await click(window, '#saveShortcutsBtn');

  // Per-clip permissions restrict a physical controller without changing the
  // shared mapping. Clip navigation/global actions are intentionally absent.
  await window.webContents.executeJavaScript(`(() => {
    const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
    slot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
  })()`);
  await click(window, '#clipContextMenu .context-menu-item[data-action="midi-permissions"]');
  await waitFor(window, `document.querySelectorAll('#midiPermissionsGrid .midi-permission-checkbox').length === 22`, 'MIDI permissions matrix');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('midiPermissionsGrid').textContent.includes('Next Clip')`), false);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('midiPermissionsGrid').textContent.includes('Previous Clip')`), false);
  await click(window, '.midi-permission-checkbox[data-action="nextCuePoint"][data-device-key="spd-20"]');
  await click(window, '#closeMidiPermissionsBtn');
  assert.ok(await window.webContents.executeJavaScript(`document.querySelector('.clip-slot[data-clip-number="1"] .midi-restriction-badge') !== null`));
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 0;
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 66, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.ok(await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime < 0.2`), 'blocked SPD-20 next cue must be ignored');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 66, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= 1.98`, 'allowed DJ controller next cue');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);

  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 0, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '1'`, 'output fade black endpoint');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('outputFadeSlider').value`), '0');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('outputBlackBadge').style.display`), 'inline-block');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 64, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `Math.abs(Number(document.getElementById('outputFadeOverlay').style.opacity) - (1 - 64 / 127)) < 0.001`, 'output fade midpoint');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 127, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '0'`, 'output fade visible endpoint');

  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.currentTime = 0;
    return video.play();
  })()`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 0, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '1' && document.getElementById('videoPlayer').currentTime > 0.2`, 'video continues beneath black');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').pause()`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 127, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '0'`, 'restore visible output');

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

  // Scrub-to-accent handovers must retain the play intent that existed before
  // the first scrub activation. Exercise the full B/F → Pendulum → B/F chain.
  await click(window, '.scrub-mode-btn[data-mode="pendulum"]');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'pre-handover embedded playback');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'arm clip scrub before embedded handover');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1')`, 'embedded B/F handover start');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: ACCENT A3') && document.getElementById('scrubActiveSource').textContent.includes('PEND')`, 'embedded accent Pendulum handover');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1')`, 'embedded return to clip scrub');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none' && !document.getElementById('videoPlayer').paused`, 'embedded playback restored after scrub handovers');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 're-arm clip scrub before editing accent');

  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
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

  // With the clip deliberately OFF, its general trigger must neither arm the
  // clip nor disturb an independently running accent effect.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.match(
    await window.webContents.executeJavaScript(`document.getElementById('scrubActiveSource').textContent`),
    /ACTIVE: ACCENT A3/,
    'OFF clip trigger must leave the active accent in control'
  );

  // The dedicated toggle explicitly arms the clip and hands playback back.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1') && document.getElementById('scrubActiveSource').textContent.includes('B/F')`, 'toggle-driven accent-to-clip scrub handover');
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
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'pause before B/F state restoration test');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'dedicated toggle activates B/F');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Back') && document.getElementById('videoPlayer').currentTime < 2.22`, 'automatic reverse at range end', 3000);
  await waitFor(window, `window.__backwardStrokeSeeked >= 2`, 'automatic backward decoded frames', 3000);
  let state = await readState(window);
  assert.match(state.centre, /00:02/);
  const backwardCompletedSeeks = await window.webContents.executeJavaScript(`window.__backwardStrokeSeeked`);
  assert.ok(backwardCompletedSeeks >= 2, `automatic backward stroke decoded ${backwardCompletedSeeks} frames`);
  await waitFor(window, `document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward') && !document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime < 1.95`, 'automatic forward turn at range start', 3000);

  await window.webContents.executeJavaScript(`document.activeElement && document.activeElement.blur()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused && document.getElementById('videoPlayer').currentTime >= 1.25 && document.getElementById('videoPlayer').currentTime < 1.55 && document.getElementById('scrubStatusLine').textContent.includes('Playing: Forward')`, 'plain accent starts B/F forward from accent', 300);

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

  // Range placement keeps the current cue as an exact Start, Centre, or End
  // anchor without adding another overlay to the timeline.
  const placementRange = Number(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`));
  await click(window, '.scrub-range-placement-btn[data-placement="start"]');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'Start-positioned B/F waiting state');
  const startPositionedRangeStart = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });

  await click(window, '.scrub-range-placement-btn[data-placement="end"]');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'End-positioned B/F waiting state');
  const endPositionedRangeStart = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  assert.ok(Math.abs((startPositionedRangeStart - placementRange) - endPositionedRangeStart) < 0.05);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });

  await click(window, '.scrub-range-placement-btn[data-placement="center"]');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'Centre-positioned B/F waiting state');
  const centrePositionedRangeStart = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime`);
  assert.ok(Math.abs((startPositionedRangeStart - (placementRange / 2)) - centrePositionedRangeStart) < 0.05);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });

  // Accent placement is stored in the accent scope and must not overwrite the
  // ordinary clip setting.
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await click(window, '.scrub-range-placement-btn[data-placement="end"]');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'end');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'center');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await click(window, '.scrub-range-placement-btn[data-placement="center"]');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');

  // Range and Speed learn continuous MIDI CC mappings and mirror the visible
  // sliders without processing every intermediate value in a dense burst.
  const originalScrubParameters = await window.webContents.executeJavaScript(`({
    range: document.getElementById('scrubRangeSlider').value,
    speed: document.getElementById('scrubSpeedSlider').value
  })`);
  await click(window, '#scrubRangeMIDILearnBtn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 65, velocity: 100 });
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeMIDILearnBtn').textContent`), 'Waiting...');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 15, value: 64 });
  await waitFor(window, `document.getElementById('scrubRangeMIDIDisplay').textContent.includes('CC 15')`, 'scrub range CC learn');
  await click(window, '#scrubSpeedMIDILearnBtn');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 16, value: 64 });
  await waitFor(window, `document.getElementById('scrubSpeedMIDIDisplay').textContent.includes('CC 16')`, 'scrub speed CC learn');

  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 15, value: 0 });
  await waitFor(window, `document.getElementById('scrubRangeSlider').value === '0.1'`, 'scrub range CC low endpoint');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 15, value: 127 });
  await waitFor(window, `document.getElementById('scrubRangeSlider').value === '10'`, 'scrub range CC high endpoint');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 16, value: 0 });
  await waitFor(window, `document.getElementById('scrubSpeedSlider').value === '0.1'`, 'scrub speed CC low endpoint');
  for (let value = 0; value <= 127; value++) {
    window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 16, value });
  }
  await waitFor(window, `document.getElementById('scrubSpeedSlider').value === '4'`, 'scrub speed dense CC endpoint');

  await click(window, '#scrubFullRangeToggle');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn').disabled`), true);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 15, value: 0 });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '10', 'Full range should ignore Range MIDI');
  await click(window, '#scrubFullRangeToggle');
  await setSlider(window, '#scrubRangeSlider', originalScrubParameters.range);
  await setSlider(window, '#scrubSpeedSlider', originalScrubParameters.speed);

  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 15, value: 0 });
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 16, value: 0 });
  await waitFor(window, `document.getElementById('scrubRangeSlider').value === '0.1' && document.getElementById('scrubSpeedSlider').value === '0.1'`, 'accent scope scrub parameter CC');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), originalScrubParameters.range);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), originalScrubParameters.speed);
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await setSlider(window, '#scrubRangeSlider', 0.8);
  await setSlider(window, '#scrubSpeedSlider', 1.5);
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');

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

  // A scrub range ending at the video duration must stay under scrub control
  // instead of the clip's native Loop mode wrapping it to 00:00.
  await click(window, '.scrub-range-placement-btn[data-placement="start"]');
  await setSlider(window, '#scrubRangeSlider', 10);
  await setSlider(window, '#scrubSpeedSlider', 4);
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    window.__stutterEndMin = video.currentTime;
    video.addEventListener('timeupdate', () => {
      window.__stutterEndMin = Math.min(window.__stutterEndMin, video.currentTime);
    });
  })()`);
  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await waitFor(window, `document.getElementById('videoPlayer').loop === false`, 'Stutter native-loop ownership');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const stutterEndMin = await window.webContents.executeJavaScript(`window.__stutterEndMin`);
  assert.ok(stutterEndMin >= 1.95, `end-aligned Stutter wrapped below its range start: ${stutterEndMin}`);

  // Live mode switching must initialize each distinct behavior.
  await click(window, '.scrub-range-placement-btn[data-placement="center"]');
  await setSlider(window, '#scrubRangeSlider', 0.5);
  await setSlider(window, '#scrubSpeedSlider', 2);
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'stutter start');
  await waitFor(window, `document.getElementById('videoPlayer').playbackRate === 2`, 'stutter owns 2x playback rate');
  await click(window, '.speed-preset-btn[data-speed="0.5"]');
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').playbackRate`),
    2,
    'clip speed preset must not override active scrub speed'
  );
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').playbackRate === 0.5`, 'new clip speed restored after scrub deactivation');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').playbackRate === 2`, 'saved scrub speed restored after reactivation');
  await new Promise(resolve => setTimeout(resolve, 450));
  state = await readState(window);
  assert.ok(state.time >= 1.7 && state.time <= 2.3, `stutter state: ${JSON.stringify(state)}`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'Space pauses stutter effect');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'drum trigger resumes paused stutter effect');

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

  if (runShortRangeDiagnostics) {
    console.log('Running embedded 0.1s Pendulum/Stutter diagnostics');
    await runShortRangeModeDiagnostics(window, window, '#videoPlayer', 'embedded');
  }

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
  const holdTimeBeforeSpace = state.time;
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await new Promise(resolve => setTimeout(resolve, 200));
  state = await readState(window);
  assert.equal(state.paused, true, 'Space must not play raw video during Hold');
  assert.ok(Math.abs(state.time - holdTimeBeforeSpace) < 0.04, `Space moved Hold from ${holdTimeBeforeSpace} to ${state.time}`);

  savedSessionData = null;
  await click(window, '#saveSessionBtn');
  await waitForNode(() => savedSessionData !== null, 'clean session before Hold trigger persistence test');
  const cleanHoldSessionStatus = await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'Hold trigger deactivation');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'Hold trigger reactivation');
  assert.equal(
    await window.webContents.executeJavaScript(`document.querySelector('.clip-slot[data-clip-number="1"] .clip-scrub-indicator').classList.contains('off')`),
    false,
    'Hold trigger must preserve the slot scrub ON setting'
  );
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent`),
    cleanHoldSessionStatus,
    'Hold triggers must not mark the session modified'
  );

  // Text entry alone blocks performance keys. A focused range slider must
  // still allow accents, while typing the scrub key into a clip name must not
  // trigger the active Hold effect.
  await window.webContents.executeJavaScript(`(() => {
    const label = document.querySelector('.clip-slot[data-clip-number="1"] .clip-slot-label');
    label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  })()`);
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="1"] .clip-slot-label').isContentEditable`, 'clip rename text entry');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  assert.notEqual(
    await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`),
    'none',
    'scrub drum key must not fire during clip rename text entry'
  );
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').focus()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(window, `Math.abs(document.getElementById('videoPlayer').currentTime - 1.25) < 0.05`, 'accent key while range slider focused');

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

  // MIDI uses the same execution-only rule. The mapped scrub trigger stays
  // inert while OFF, and the separately mapped toggle is what arms it.
  await click(window, '#scrubActivateBtn');
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubDrumLearnBtn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await waitFor(window, `document.getElementById('scrubDrumDisplay').textContent.includes('Note 60')`, 'drum MIDI learn');
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 60, velocity: 100 });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(
    await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`),
    'none',
    'MIDI scrub trigger must not arm an OFF clip'
  );
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 63, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'mapped MIDI scrub toggle arms B/F');
  window.webContents.send('midi-message', {
    type: 'noteon',
    channel: 1,
    note: 60,
    velocity: 100,
    latencyTrace: { id: 9001, mainReceivedAt: performance.timeOrigin + performance.now() }
  });
  await waitFor(window, `!document.getElementById('videoPlayer').paused`, 'MIDI back-forward trigger');
  await waitForNode(
    () => rendererMessages.some(message =>
      message.includes('[LATENCY] #9001') && message.includes('[forward]')),
    'embedded MIDI latency result'
  );

  // Exercise the same controller with the pop-out as the playback owner.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'deactivate before pop-out');
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 2;
  })()`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 0, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '1'`, 'black before pop-out creation');
  await click(window, '#outputWindowBtn');
  await waitForNode(() => previewWindow && !previewWindow.isDestroyed(), 'pop-out creation');
  await waitFor(previewWindow, `document.getElementById('previewVideo').duration > 0`, 'pop-out video metadata', 10000);

  await waitFor(previewWindow, `document.getElementById('outputFadeOverlay').style.opacity === '1'`, 'initial pop-out black synchronization');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('outputFadeOverlay').style.opacity`), '1');
  for (let value = 0; value <= 127; value++) {
    window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value, deviceId: 1, deviceName: 'DJ Controller' });
  }
  await waitFor(previewWindow, `document.getElementById('outputFadeOverlay').style.opacity === '0'`, 'rapid pop-out fade endpoint');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('outputFadeOverlay').style.opacity`), '0');

  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await click(window, '.scrub-mode-btn[data-mode="pendulum"]');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  await window.webContents.executeJavaScript(`document.activeElement && document.activeElement.blur()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused`, 'pre-handover pop-out playback');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'arm clip scrub before pop-out handover');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1')`, 'pop-out B/F handover start');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: ACCENT A3') && document.getElementById('scrubActiveSource').textContent.includes('PEND')`, 'pop-out accent Pendulum handover');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'X' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'X' });
  await waitFor(window, `document.getElementById('scrubActiveSource').textContent.includes('ACTIVE: CLIP 1')`, 'pop-out return to clip scrub');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(previewWindow, `!document.getElementById('previewVideo').paused`, 'pop-out playback restored after scrub handovers');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await click(window, '.scrub-mode-btn[data-mode="manual-stutter"]');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');

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
  const commandsBeforeStutterResync = previewCommands.length;
  window.webContents.send('preview-update', {
    type: 'timeupdate',
    currentTime: 2.3,
    duration: await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').duration`)
  });
  await waitForNode(
    () => previewCommands.slice(commandsBeforeStutterResync).some(command =>
      command.type === 'seek' && command.time < 1.8
    ),
    'pop-out Stutter resync boundary restart',
    150
  );

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

  if (runShortRangeDiagnostics) {
    console.log('Running pop-out 0.1s Pendulum/Stutter diagnostics');
    await runShortRangeModeDiagnostics(window, previewWindow, '#previewVideo', 'pop-out');
  }

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
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 63, velocity: 100, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'mapped MIDI toggle arms pop-out B/F');
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
  window.webContents.send('midi-message', {
    type: 'noteon',
    channel: 1,
    note: 60,
    velocity: 100,
    latencyTrace: { id: 9002, mainReceivedAt: performance.timeOrigin + performance.now() }
  });
  await waitForNode(async () => {
    const status = await window.webContents.executeJavaScript(`document.getElementById('scrubStatusLine').textContent`);
    const time = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
    return status.includes('Playing: Back') && time < popoutTurnTime - 0.04;
  }, 'pop-out mid-stroke direction reversal', 3000);
  await waitForNode(
    () => rendererMessages.some(message =>
      message.includes('[LATENCY] #9002') && message.includes('[reverse] (pop-out)')),
    'pop-out MIDI latency result'
  );
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

  // Pop-out Q/W/R uses the same atomic navigation generation. Rapid commands
  // must leave both the logical center and projection on the newest request.
  await setSlider(window, '#scrubSpeedSlider', 1);
  for (const [keyCode, expectedCentre, label] of [
    ['R', '00:00', 'restart'],
    ['W', '00:02', 'first cue'],
    ['W', '00:03', 'second cue'],
    ['Q', '00:02', 'previous cue'],
    ['R', '00:00', 'final restart']
  ]) {
    previewCommands = [];
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    await waitFor(
      window,
      `document.getElementById('scrubCentreDisplay').textContent.includes('${expectedCentre}')`,
      `pop-out B/F ${label}`
    );
    await waitForNode(() => previewCommands.some(command => command.type === 'seek'), `pop-out B/F ${label} seek command`);
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.equal(
      previewCommands.filter(command => command.type === 'seek').length,
      1,
      `pop-out B/F ${label} should issue one seek`
    );
    assert.ok(
      previewCommands.every(command => Number.isInteger(command.navigationGeneration)),
      `pop-out B/F ${label} commands should carry a navigation generation`
    );
  }
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime < 0.15`, 'pop-out B/F newest navigation position');
  const newestNavigationGeneration = Math.max(
    ...previewCommands.map(command => command.navigationGeneration).filter(Number.isInteger)
  );
  mainWindow.webContents.send('preview-update', {
    type: 'seeked',
    currentTime: 3,
    duration: 4,
    navigationGeneration: newestNavigationGeneration - 1
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.match(
    await window.webContents.executeJavaScript(`document.getElementById('currentTime').textContent`),
    /^00:00/,
    'stale pop-out seek acknowledgement must not replace the newest navigation position'
  );

  // Per-slot scrub/accent settings restore independently and serialize in session v1.18.
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'slot one scrub disabled');
  await waitFor(previewWindow, `document.getElementById('previewVideo').loop === true`, 'pop-out native loop restoration after B/F');
  await click(window, '#outputWindowBtn');
  await waitForNode(() => !previewWindow || previewWindow.isDestroyed(), 'pop-out close');

  // Every active scrub mode must accept a rapid R→W→W→Q→R sequence without
  // losing its logical cue position. Running after the timing-sensitive pop-out
  // diagnostics keeps these extra reconfigurations out of latency measurements.
  const navigationModes = [
    'manual-cc',
    'back-forward',
    'pendulum',
    'stutter',
    'manual-stutter',
    'drift',
    'hold'
  ];
  for (const mode of navigationModes) {
    await click(window, `.scrub-mode-btn[data-mode="${mode}"]`);
    await click(window, '#scrubActivateBtn');
    await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, `${mode} navigation activation`);
    await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').focus()`);

    for (const [keyCode, expectedCentre, label] of [
      ['R', '00:00', 'restart'],
      ['W', '00:02', 'first cue'],
      ['W', '00:03', 'second cue'],
      ['Q', '00:02', 'previous cue'],
      ['R', '00:00', 'final restart']
    ]) {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
      await waitFor(
        window,
        `document.getElementById('scrubCentreDisplay').textContent.includes('${expectedCentre}')`,
        `${mode} ${label}`
      );
    }

    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, `${mode} navigation cleanup`);
  }

  // If scrub was activated between cues rather than by W, Q selects the
  // nearest cue behind the visible playhead. It must not subtract twice and
  // fall through to the same In-point behavior as R.
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2.5`);
  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:02')`, 'between-cue scrub activation');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Q' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Q' });
  await waitFor(window, `Math.abs(document.getElementById('videoPlayer').currentTime - 2) < 0.05`, 'between-cue previous selects nearest cue');
  assert.ok(
    Math.abs((await readState(window)).time - 2) < 0.05,
    'between-cue Q should move to the first cue rather than the clip start'
  );
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'between-cue regression cleanup');

  // B/F can move the visible frame away from its original activation anchor.
  // In that state Q follows the frame the performer can see, not the obsolete
  // zero-second anchor.
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'B/F moving-playhead Q activation');
  await click(window, '#scrubFullRangeToggle');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubFullRangeToggle').checked`), true);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'R' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'R' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:00')`, 'B/F moving-playhead anchor reset');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 2.5`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Q' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Q' });
  await waitFor(window, `document.getElementById('scrubCentreDisplay').textContent.includes('00:02')`, 'B/F moving-playhead previous cue');
  assert.ok(
    Math.abs((await readState(window)).time - 2) < 0.05,
    'Full-range B/F Q should stop on the previous cue and not behave like Restart'
  );
  await click(window, '#scrubFullRangeToggle');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'B/F moving-playhead regression cleanup');

  await click(window, '#outputFadeReverse');
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '1'`, 'reverse MIDI direction applies last CC value');
  await setSlider(window, '#outputFadeSlider', 100);
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '0'`, 'manual slider remains non-reversed');
  await setSlider(window, '#scrubRangeSlider', 0.65);
  await setSlider(window, '#scrubSpeedSlider', 1.7);
  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  await click(window, '.scrub-range-placement-btn[data-placement="start"]');
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

  // With the pop-out owning playback, a newly selected clip must activate its
  // saved scrub only after that clip reports its own loaded start position.
  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  await click(window, '#outputWindowBtn');
  await waitForNode(() => previewWindow && !previewWindow.isDestroyed(), 'pop-out anchor regression window creation');
  await waitFor(previewWindow, `document.getElementById('previewVideo').duration > 0`, 'pop-out anchor regression metadata', 10000);
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="1"]').classList.contains('selected') && document.getElementById('scrubActiveBadge').style.display === 'none'`, 'slot one ready for pop-out anchor regression', 10000);
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot one Hold saved ON');
  await previewWindow.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('previewVideo');
    video.currentTime = 3;
    window.electronAPI.sendPreviewUpdate({
      type: 'timeupdate',
      currentTime: 3,
      duration: video.duration
    });
  })()`);
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="2"]').classList.contains('selected') && document.getElementById('scrubCentreDisplay').textContent.includes('00:00')`, 'slot two pop-out scrub anchor reset', 10000);
  await waitFor(previewWindow, `Math.abs(document.getElementById('previewVideo').currentTime) < 0.05`, 'slot two pop-out loaded at In point', 10000);

  // Restore slot one's pre-test OFF preference; slot two remains enabled and
  // is configured by the persistence scenarios below.
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot one Hold restored after pop-out anchor regression', 10000);
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'slot one scrub OFF restored');
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot two Hold restored', 10000);
  await click(window, '#outputWindowBtn');
  await waitForNode(() => !previewWindow || previewWindow.isDestroyed(), 'pop-out anchor regression close');

  await setSlider(window, '#scrubRangeSlider', 1.25);
  await setSlider(window, '#scrubSpeedSlider', 1.5);
  await click(window, '.scrub-mode-btn[data-mode="drift"]');
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="1"]').classList.contains('selected') && document.getElementById('videoPlayer').duration > 0`, 'slot one restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'hold');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.65');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.7');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'start');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`), 'none');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  await click(window, '.scrub-range-placement-btn[data-placement="end"]');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');

  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'drift' && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'slot two restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '1.25');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.5');
  await click(window, '.scrub-range-placement-btn[data-placement="end"]');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'end');
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  await click(window, '#scrubFullRangeToggle');
  await click(window, '#scrubAutoReverseToggle');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0.8`);
  await click(window, '.accent-set-btn[data-accent-slot="1"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

  // A fresh third slot guarantees the cue-less momentary Fader uses the same
  // pause/seek/idle-resume lifecycle when the pop-out owns playback.
  const thirdDropResult = await window.webContents.executeJavaScript(`(() => {
    try {
      const slot = document.querySelector('.clip-slot[data-clip-number="3"]');
      window.draggedFile = {
        name: 'test-video-3.mp4',
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
  assert.equal(thirdDropResult.ok, true, thirdDropResult.error);
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="3"]').classList.contains('selected') && document.getElementById('scrubActiveSource').textContent.includes('FADER ARMED') && !document.getElementById('videoPlayer').paused`, 'cue-less Fader armed before pop-out', 10000);
  await click(window, '#outputWindowBtn');
  await waitForNode(() => previewWindow && !previewWindow.isDestroyed(), 'cue-less Fader pop-out creation');
  await waitFor(previewWindow, `document.getElementById('previewVideo').duration > 0 && !document.getElementById('previewVideo').paused && document.getElementById('previewVideo').currentTime > 1.1`, 'cue-less Fader pop-out playback', 10000);
  const popoutBeforeScratch = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').currentTime`);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 14, value: 0 });
  await waitForNode(async () => {
    const source = await window.webContents.executeJavaScript(`document.getElementById('scrubActiveSource').textContent`);
    const previewState = await previewWindow.webContents.executeJavaScript(`({ paused: document.getElementById('previewVideo').paused, time: document.getElementById('previewVideo').currentTime })`);
    return source.includes('FADER SCRATCHING') && previewState.paused && previewState.time < popoutBeforeScratch - 0.5;
  }, 'cue-less Fader pop-out scratch ownership', 3000);
  await waitForNode(async () => {
    const source = await window.webContents.executeJavaScript(`document.getElementById('scrubActiveSource').textContent`);
    const paused = await previewWindow.webContents.executeJavaScript(`document.getElementById('previewVideo').paused`);
    return source.includes('FADER ARMED') && !paused;
  }, 'cue-less Fader pop-out playback resume', 3000);
  await click(window, '#outputWindowBtn');
  await waitForNode(() => !previewWindow || previewWindow.isDestroyed(), 'cue-less Fader pop-out close');
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward' && document.getElementById('scrubFullRangeToggle').checked`, 'slot two restore after cue-less Fader pop-out', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);

  // Duplicate is an explicit two-step operation and Escape cancels it without
  // disturbing playback. The completed copy uses an empty slot and carries
  // every persistent clip setting while receiving independent cue identities.
  await window.webContents.executeJavaScript(`(() => {
    const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
    slot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
  })()`);
  await click(window, '#clipContextMenu .context-menu-item[data-action="duplicate"]');
  await waitFor(window, `document.getElementById('clipsMatrix').classList.contains('duplicate-mode') && document.querySelector('.clip-slot[data-clip-number="1"]').classList.contains('duplicate-source')`, 'clip duplicate target mode');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await waitFor(window, `!document.getElementById('clipsMatrix').classList.contains('duplicate-mode') && !document.querySelector('.clip-slot[data-clip-number="5"]').classList.contains('has-video')`, 'cancel clip duplication');

  await window.webContents.executeJavaScript(`(() => {
    const slot = document.querySelector('.clip-slot[data-clip-number="1"]');
    slot.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
  })()`);
  await click(window, '#clipContextMenu .context-menu-item[data-action="duplicate"]');
  await click(window, '.clip-slot[data-clip-number="5"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="5"]').classList.contains('has-video') && document.querySelector('.clip-slot[data-clip-number="5"]').classList.contains('selected') && document.getElementById('videoPlayer').duration > 0`, 'duplicate clip into empty slot', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('clipsMatrix').classList.contains('duplicate-mode')`), false);

  // Tab dragging changes only the saved display order. Stable tab IDs keep
  // their clip collections attached, while Tab 1-5 shortcuts follow the new
  // visible positions.
  const reorderedTabs = await window.webContents.executeJavaScript(`(() => {
    const source = document.querySelector('.tab-btn[data-tab="2"]');
    const target = document.querySelector('.tab-btn[data-tab="0"]');
    const transfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData() {},
      getData() { return ''; }
    };
    const dispatchDrag = (element, type, clientX = 0) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      Object.defineProperty(event, 'clientX', { value: clientX });
      element.dispatchEvent(event);
    };
    dispatchDrag(source, 'dragstart');
    dispatchDrag(target, 'dragover', target.getBoundingClientRect().left + 1);
    dispatchDrag(target, 'drop', target.getBoundingClientRect().left + 1);
    return Array.from(document.querySelectorAll('.tab-btn')).map(button => Number(button.dataset.tab));
  })()`);
  assert.deepEqual(reorderedTabs, [2, 0, 1, 3, 4]);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.tab-btn[data-tab="2"] .tab-btn-text').textContent`), 'Tab 1');
  await new Promise(resolve => setTimeout(resolve, 20));
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '1' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '1' });
  await waitFor(window, `document.querySelector('.tab-btn.active').dataset.tab === '2'`, 'Tab 1 shortcut follows reordered position');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '2' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '2' });
  await waitFor(window, `document.querySelector('.tab-btn.active').dataset.tab === '0'`, 'Tab 2 shortcut follows reordered position');

  savedSessionData = null;
  await click(window, '#saveSessionBtn');
  await waitForNode(() => savedSessionData !== null, 'session save capture');
  assert.equal(savedSessionData.version, '1.18');
  assert.deepEqual(savedSessionData.allTabs, [2, 0, 1, 3, 4]);
  assert.deepEqual(savedSessionData.midiMappings.accent2, { type: 'noteon', channel: 1, note: 62 });
  assert.deepEqual(savedSessionData.midiMappings.toggleScrubMode, { type: 'noteon', channel: 1, note: 63 });
  assert.deepEqual(savedSessionData.midiMappings.outputFade, { type: 'cc', channel: 1, controller: 21 });
  assert.deepEqual(savedSessionData.outputFadeSettings, { reversed: true });
  assert.deepEqual(savedSessionData.tabs.midiPermissions['0']['1'].devices['spd-20'], {
    name: 'SPD-20',
    blocked: ['nextCuePoint']
  });
  assert.deepEqual(savedSessionData.scrubSettings.rangeController, { type: 'cc', channel: 1, controller: 15 });
  assert.deepEqual(savedSessionData.scrubSettings.speedController, { type: 'cc', channel: 1, controller: 16 });
  assert.equal(savedSessionData.tabs.accentPoints['0']['1']['1'].time, 1.25);
  assert.equal(savedSessionData.tabs.accentPoints['0']['2']['1'].time, 0.8);
  assert.equal(savedSessionData.tabs.accentPoints['0']['1']['2'].time, 3.4);
  assert.ok(Math.abs(savedSessionData.tabs.accentPoints['0']['1']['4'].time - draggedAccentTarget) < 0.05);
  assert.deepEqual(
    {
      mode: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubMode,
      range: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubRange,
      placement: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubRangePlacement,
      speed: savedSessionData.tabs.accentPoints['0']['1']['3'].scrubSpeed
    },
    { mode: 'manual-stutter', range: 0.8, placement: 'end', speed: 1.5 }
  );
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['1'], {
    enabled: false,
    mode: 'hold',
    range: 0.65,
    speed: 1.7,
    rangePlacement: 'start',
    fullRange: false,
    autoReverse: true
  });
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['2'], {
    enabled: true,
    mode: 'back-forward',
    range: 1.25,
    speed: 1.5,
    rangePlacement: 'end',
    fullRange: true,
    autoReverse: false
  });
  assert.equal(savedSessionData.tabs.videos['0']['5'].filePath, savedSessionData.tabs.videos['0']['1'].filePath);
  assert.equal(savedSessionData.tabs.speeds['0']['5'], savedSessionData.tabs.speeds['0']['1']);
  assert.equal(savedSessionData.tabs.clipModes['0']['5'], savedSessionData.tabs.clipModes['0']['1']);
  assert.equal(savedSessionData.tabs.clipAutoPlay['0']['5'], savedSessionData.tabs.clipAutoPlay['0']['1']);
  assert.deepEqual(savedSessionData.tabs.inOutPoints['0']['5'], savedSessionData.tabs.inOutPoints['0']['1']);
  assert.deepEqual(savedSessionData.tabs.scrubSettings['0']['5'], savedSessionData.tabs.scrubSettings['0']['1']);
  assert.deepEqual(savedSessionData.tabs.midiPermissions['0']['5'], savedSessionData.tabs.midiPermissions['0']['1']);
  assert.deepEqual(
    savedSessionData.tabs.cuePoints['0']['5'].map(point => point.time),
    savedSessionData.tabs.cuePoints['0']['1'].map(point => point.time)
  );
  assert.ok(savedSessionData.tabs.cuePoints['0']['5'].every((point, index) =>
    point.id !== savedSessionData.tabs.cuePoints['0']['1'][index].id
  ), 'duplicated cues must have independent identities');
  assert.deepEqual(
    Object.fromEntries(Object.entries(savedSessionData.tabs.accentPoints['0']['5']).map(([slot, point]) => [slot, { ...point, id: null }])),
    Object.fromEntries(Object.entries(savedSessionData.tabs.accentPoints['0']['1']).map(([slot, point]) => [slot, { ...point, id: null }]))
  );
  assert.equal(savedSessionData.tabs.currentCueIndex['0']['5'], -1);

  // Round-trip through the real session loader, not just the serialized object.
  await setSlider(window, '#scrubRangeSlider', 3);
  await click(window, '.scrub-mode-btn[data-mode="stutter"]');
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.18 reload', 10000);
  assert.deepEqual(
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.tab-btn')).map(button => Number(button.dataset.tab))`),
    [2, 0, 1, 3, 4]
  );
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeMIDIDisplay').textContent`), /CC 15/);
  assert.match(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedMIDIDisplay').textContent`), /CC 16/);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('outputFadeReverse').checked`), true);
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 127, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '1'`, 'reloaded reversed fade mapping');
  window.webContents.send('midi-message', { type: 'cc', channel: 1, controller: 21, value: 0, deviceId: 1, deviceName: 'DJ Controller' });
  await waitFor(window, `document.getElementById('outputFadeOverlay').style.opacity === '0'`, 'reloaded reversed visible endpoint');
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0 && document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'hold'`, 'reloaded slot one', 10000);
  assert.ok(await window.webContents.executeJavaScript(`document.querySelector('.clip-slot[data-clip-number="1"] .midi-restriction-badge') !== null`));
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 0;
  })()`);
  window.webContents.send('midi-message', { type: 'noteon', channel: 1, note: 66, velocity: 100, deviceId: 0, deviceName: 'SPD-20' });
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.ok(await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime < 0.2`), 'reloaded SPD-20 restriction must remain active');
  await waitFor(window, `document.querySelectorAll('.accent-marker').length === 4`, 'reloaded slot one accents');
  await click(window, '.scrub-target-btn[data-scrub-target="accent3"]');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-mode-btn.selected').dataset.mode`), 'manual-stutter');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.8');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubSpeedSlider').value`), '1.5');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'end');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '0.65');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'start');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubActiveBadge').style.display`), 'none');
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward' && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'reloaded slot two', 10000);
  await waitFor(window, `document.querySelectorAll('.accent-marker').length === 1`, 'reloaded slot two accents');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').value`), '1.25');
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubFullRangeToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), false);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubRangeSlider').disabled`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'end');

  // v1.12 accents did not have their own scrub settings. They migrate to None
  // with the default 2-second range and 1x speed.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.version = '1.12';
  sessionDataToLoad.tabs.currentCueIndex['0']['1'] = 99;
  sessionDataToLoad.tabs.cuePoints['0']['1'].forEach(cuePoint => delete cuePoint.id);
  const legacyAccent = sessionDataToLoad.tabs.accentPoints['0']['1']['1'];
  delete legacyAccent.scrubMode;
  delete legacyAccent.scrubRange;
  delete legacyAccent.scrubRangePlacement;
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
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'center');
  await click(window, '.scrub-target-btn[data-scrub-target="clip"]');
  await window.webContents.executeJavaScript(`(() => {
    const video = document.getElementById('videoPlayer');
    video.pause();
    video.currentTime = 3;
  })()`);
  await click(window, '#prevCuePointBtn');
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= 1.98 && document.getElementById('videoPlayer').currentTime < 2.25`, 'legacy stale previous-cue recovery');
  await click(window, '#restartClipBtn');
  await waitFor(window, `document.getElementById('videoPlayer').currentTime < 0.15`, 'legacy restart recovery');

  // v1.10 per-slot sessions did not have autoReverse or range placement. They
  // migrate to continuous boundaries and the legacy Centre range behavior.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.version = '1.10';
  delete sessionDataToLoad.tabs.accentPoints;
  Object.values(sessionDataToLoad.tabs.scrubSettings).forEach(tabSettings => {
    Object.values(tabSettings).forEach(settings => {
      delete settings.autoReverse;
      delete settings.rangePlacement;
    });
  });
  await window.webContents.executeJavaScript(`document.getElementById('sessionStatus').textContent = 'Loading v1.10 test…'`);
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.getElementById('sessionStatus').textContent.startsWith('Loaded:')`, 'session v1.10 migration', 10000);
  await click(window, '.clip-slot[data-clip-number="2"]');
  await waitFor(window, `document.querySelector('.scrub-mode-btn.selected').dataset.mode === 'back-forward'`, 'v1.10 slot restore', 10000);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById('scrubAutoReverseToggle').checked`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.scrub-range-placement-btn.selected').dataset.placement`), 'center');

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

  // Cue progression is based on cue identity, not the clamped range start.
  // A first cue inside the old 0.1s time-search tolerance was previously
  // skipped when a centred range extended before 00:00.
  const edgeDropResult = await window.webContents.executeJavaScript(`(() => {
    try {
      const slot = document.querySelector('.clip-slot[data-clip-number="4"]');
      window.draggedFile = {
        name: 'test-video-edge-cues.mp4',
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
  assert.equal(edgeDropResult.ok, true, edgeDropResult.error);
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="4"]').classList.contains('selected') && document.getElementById('videoPlayer').duration > 0 && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'edge cue test clip load', 10000);
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('scrubActiveBadge').style.display === 'none'`, 'edge cue setup scrub disabled');

  const edgeDuration = await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').duration`);
  const edgeCueTimes = [0.05, edgeDuration / 2, edgeDuration - 0.05];
  for (const cueTime of edgeCueTimes) {
    await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = ${cueTime}`);
    await click(window, '#recordCuePointBtn');
  }
  await waitFor(window, `document.querySelectorAll('.cue-marker').length === 3`, 'edge cue markers');
  await setSlider(window, '#scrubRangeSlider', 10);
  await click(window, '.scrub-range-placement-btn[data-placement="center"]');
  await click(window, '.scrub-mode-btn[data-mode="hold"]');
  await window.webContents.executeJavaScript(`document.getElementById('videoPlayer').currentTime = 0`);
  await click(window, '#scrubActivateBtn');
  await waitFor(window, `document.getElementById('videoPlayer').paused`, 'edge cue hold activation');

  for (const cueTime of [...edgeCueTimes, edgeCueTimes[0]]) {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
    await waitFor(window, `Math.abs(document.getElementById('videoPlayer').currentTime - ${cueTime}) < 0.025`, `edge cue progression to ${cueTime.toFixed(3)}`);
  }

  // In B/F, W must visibly jump to the selected cue anchor. Oversized ranges
  // can give several cues the same clamped 00:00 range start, so restarting at
  // that boundary makes correct internal progression look completely stuck.
  await setSlider(window, '#scrubSpeedSlider', 0.1);
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(window, `document.getElementById('videoPlayer').currentTime >= ${edgeCueTimes[1]} - 0.025`, 'embedded B/F edge cue anchor jump');
  await click(window, '.scrub-mode-btn[data-mode="hold"]');

  // Re-selecting the clip resets its media position but must retain the same
  // Cue 1 -> Cue 2 -> Cue 3 -> Cue 1 order when the pop-out owns playback.
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="1"]').classList.contains('selected')`, 'leave edge cue clip');
  await click(window, '.clip-slot[data-clip-number="4"]');
  await waitFor(window, `document.querySelector('.clip-slot[data-clip-number="4"]').classList.contains('selected') && document.getElementById('scrubActiveBadge').style.display !== 'none'`, 'reselect edge cue clip', 10000);
  await click(window, '#outputWindowBtn');
  await waitForNode(() => previewWindow && !previewWindow.isDestroyed(), 'edge cue pop-out open');
  await waitFor(previewWindow, `document.getElementById('previewVideo').duration > 0`, 'edge cue pop-out video load', 10000);
  for (const cueTime of [...edgeCueTimes, edgeCueTimes[0]]) {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
    await waitFor(previewWindow, `Math.abs(document.getElementById('previewVideo').currentTime - ${cueTime}) < 0.025`, `pop-out edge cue progression to ${cueTime.toFixed(3)}`);
  }
  await setSlider(window, '#scrubSpeedSlider', 0.1);
  await click(window, '.scrub-mode-btn[data-mode="back-forward"]');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
  await waitFor(previewWindow, `document.getElementById('previewVideo').currentTime >= ${edgeCueTimes[1]} - 0.025`, 'pop-out B/F edge cue anchor jump');
  await click(window, '#outputWindowBtn');
  await waitForNode(() => !previewWindow || previewWindow.isDestroyed(), 'edge cue pop-out close');

  // Portable and ordinary session reconnection must traverse the actual tab
  // collection rather than stopping at the five original tabs.
  sessionDataToLoad = JSON.parse(JSON.stringify(savedSessionData));
  sessionDataToLoad.allTabs = [0, 1, 2, 3, 4, 5];
  sessionDataToLoad.nextTabIndex = 6;
  sessionDataToLoad.currentTab = 0;
  sessionDataToLoad.tabCustomNames = { ...(sessionDataToLoad.tabCustomNames || {}), 5: 'Sixth Tab' };
  const sixthTabCollections = [
    'cuePoints', 'speeds', 'clipNames', 'clipModes', 'clipAutoPlay',
    'currentCueIndex', 'inOutPoints', 'accentPoints', 'scrubSettings', 'midiPermissions'
  ];
  sixthTabCollections.forEach(collection => {
    if (!sessionDataToLoad.tabs[collection]) sessionDataToLoad.tabs[collection] = {};
    sessionDataToLoad.tabs[collection]['5'] = {};
  });
  sessionDataToLoad.tabs.videos['5'] = {
    1: { name: 'sixth-tab-video.mp4', filePath: testVideoPath, thumbnail: null }
  };
  await window.webContents.executeJavaScript(`window.__lastAlert = null`);
  await click(window, '#loadSessionBtn');
  await waitFor(window, `document.querySelector('.tab-btn[data-tab="5"]') !== null`, 'sixth tab restored', 10000);
  await click(window, '.tab-btn[data-tab="5"]');
  await click(window, '.clip-slot[data-clip-number="1"]');
  await waitFor(window, `document.getElementById('videoPlayer').duration > 0 && document.getElementById('videoPlayer').currentSrc`, 'sixth-tab video auto-reconnected', 10000);
  assert.equal(await window.webContents.executeJavaScript(`window.__lastAlert`), null, 'sixth-tab clip must not request manual reconnection');

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
