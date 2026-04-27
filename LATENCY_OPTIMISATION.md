# MIDI → Video Trigger Latency Optimisation Guide

## The Complete Signal Chain

```
Drum hit → MIDI hardware → @julusian/midi (native C++) → main.js callback
         → IPC (webContents.send) → preload.js → script.js MIDI handler
         → handleMIDIMessage() → executeMappedAction() → navigateToNextCuePoint()
         → video.currentTime = X → browser decode → GPU compositor → screen
```

**Theoretical minimum:** ~15-25ms glass-to-glass (with the right video codec)  
**Current estimated:** ~40-80ms typical, 200ms+ outliers (especially with DevTools open)

---

## Critical Issues (fix these first)

### 1. DevTools is always open — `main.js:43`

```js
mainWindow.webContents.openDevTools()
```

This is the single biggest latency killer. Every `console.log` in the entire app gets serialized and streamed to the DevTools frontend over an internal IPC channel. With DevTools attached, each log call costs **5-50ms extra**. Remove or gate behind a dev-mode flag for production use.

### 2. Every MIDI message logs unconditionally — `main.js:478`

```js
console.log('🎹 RAW MIDI RECEIVED:', message, ...)  // "DIAGNOSTIC: Always log"
```

This fires inside the MIDI callback on every single MIDI message — every drum hit, every note-off, everything. With DevTools open this is catastrophically slow. Even without DevTools it adds unnecessary serialization on the hot path. Remove completely or gate behind a flag that defaults to `false`.

### 3. `backgroundThrottling` not disabled — `main.js:30-35`

```js
webPreferences: {
    // backgroundThrottling: false  <-- MISSING
}
```

When the main window loses focus (e.g., you click the output popout), Chromium throttles the renderer's JS execution to 1 Hz. MIDI messages can sit in the queue for **up to 1 full second** before being processed. Add `backgroundThrottling: false` to the webPreferences object.

### 4. Renderer logs are forwarded to main process — `main.js:51-53`

```js
mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer]: ${message}`)
})
```

Every `console.log` in `script.js` costs double — once in the renderer, once re-logged in main. Remove this in production.

---

## High Impact

### 5. `displayMIDIActivity()` DOM write runs before the seek — `script.js:3627`

```js
window.electronAPI.onMIDIMessage((message) => {
    displayMIDIActivity(message)   // DOM write FIRST
    handleMIDIMessage(message)      // actual action second
})
```

The DOM write (updating the MIDI indicator) forces a style recalc before the seek even starts. Move it after the action dispatch, or defer with `requestAnimationFrame`.

### 6. Synthetic `.click()` indirection — `script.js:3692-3702`

```js
case 'nextCuePoint':
    nextCuePointBtn.click()   // fires a DOM event that bubbles before reaching handler
```

This fires a DOM click event which has to bubble before the actual handler runs. Call `navigateToNextCuePoint()` directly instead. Saves ~0.3-0.5ms and removes unnecessary event dispatch. Same applies to all other actions in `executeMappedAction()`.

### 7. `Object.entries(midiMappings)` on every MIDI message — `script.js:3636`

```js
for (const [action, mapping] of Object.entries(midiMappings)) {
```

`Object.entries()` allocates a new array on every call, which is every MIDI message. Build a reverse lookup map once when mappings change:

```js
// e.g. { "1_noteon_60": "nextCuePoint", "1_cc_14": "prevCuePoint" }
const midiReverseMap = {}
```

Then lookup is O(1) with no heap allocation per message.

### 8. Debounce is 15ms — `script.js:3582`

```js
const MIDI_DEBOUNCE_MS = 15
```

15ms of dead-time between triggers. For most patterns this is fine, but rapid double-strikes or flams on the same pad will drop hits. Consider reducing to 3-5ms.

---

## Medium Impact

### 9. `updateTimeline()` is synchronous on the seek path — `script.js:2291`

```js
video.currentTime = nextCuePoint.time
updateTimeline()   // immediate DOM writes after seek
video.play()
```

`updateTimeline()` writes multiple CSS properties and may scroll a container, forcing layout before `video.play()`. Defer with `requestAnimationFrame`.

### 10. `<video controls>` adds compositor overhead — `index.html:1542`

```html
<video id="videoPlayer" controls muted>
```

The native browser controls bar repaints constantly during seeks and playback. Remove the `controls` attribute — custom UI controls are already implemented.

### 11. Two linear cue-point scans per navigation — `script.js:2222-2227` and `2318-2324`

For small cue counts this is negligible. For large Metropolis setups with many cues, maintain a sorted index and use binary search instead.

### 12. `timeupdate` cue-stop tolerance is 150ms — `script.js:4500`

```js
Math.abs(currentTime - cuePoint.time) < 0.15
```

In `forward-stop` mode, the video can play 150ms past a cue before being snapped back. `timeupdate` fires ~4-66x/second so the effective tolerance is even larger on slower systems.

---

## The Biggest Factor of All: Video Codec

All the JS optimisations above combined are worth maybe 30-50ms. Your video codec dominates.

| Codec | Seek time | Notes |
|-------|-----------|-------|
| H.264 streaming (long-GOP) | 50-500ms | Likely current format. Browser must decode back to last keyframe |
| H.264 all-intra (`keyint=1`) | ~16ms | Every frame is a keyframe — any-frame seek |
| ProRes (MOV) | ~16ms | All-intra by nature, excellent for this use case |
| DNxHD / DNxHR | ~16ms | Same as ProRes |
| HEVC all-intra | ~16ms | Smaller files than ProRes |

**Transcode Metropolis clips to all-intra H.264 or ProRes.** This alone could reduce seeks from 200ms to 16ms.

FFmpeg command for all-intra H.264 (no audio, high quality):

```bash
ffmpeg -i input.mp4 -c:v libx264 -x264opts keyint=1 -crf 18 -an output.mp4
```

For ProRes (Mac/Resolve-friendly):

```bash
ffmpeg -i input.mp4 -c:v prores_ks -profile:v 3 -an output.mov
```

---

## Estimated Impact Summary

| Fix | Estimated saving |
|-----|-----------------|
| Close DevTools in production | 5-50ms jitter |
| Remove MIDI callback console.log | 1-5ms per hit |
| Add `backgroundThrottling: false` | Prevents 1-second freezes when window loses focus |
| Remove renderer→main log forwarding | Halves cost of every renderer log |
| Move `displayMIDIActivity` after seek | 0.5-1ms |
| Call nav functions directly (no `.click()`) | 0.3ms |
| Build MIDI reverse lookup map | Removes per-hit allocation |
| Reduce debounce 15ms → 5ms | Up to 10ms headroom on rapid hits |
| Transcode to all-intra codec | 50-400ms on seeks |

**Achievable floor after all fixes:** ~15-25ms glass-to-glass with all-intra codec.

---

## Files Reference

| File | Relevant lines |
|------|---------------|
| `main.js` | 30-35 (webPreferences), 43 (DevTools), 51-53 (log forwarding), 478 (MIDI log), 506 (IPC send), 586-601 (GPU flags) |
| `script.js` | 62 (preload), 1603 (cue sort), 2222-2227 (linear scan), 2288/2395 (seek), 2291/2397 (updateTimeline), 3582 (debounce), 3627 (displayMIDIActivity), 3636 (Object.entries), 3692-3702 (synthetic click), 4438-4546 (timeupdate), 4500 (150ms tolerance) |
| `index.html` | 1542 (`<video controls>`) |
| `preview-popout.html` | 64-78 (time reporting throttled to 10fps — stale currentTime in popout mode) |
