# Scrub / Accent / Pop-out Conflict Fix Plan

Branch: `codex/drum-trigger-latency`
Date: 2026-09-04

This plan fixes conflicts between scrub modes, accents, the clip play modes, and the pop-out projection window. Work through the tasks in order. Each task is independent enough to be its own commit.

## Ground rules

- Stay on `codex/drum-trigger-latency` for all work. Do not check out, merge into, rebase onto, or push `master`. Do not push anything; the user will push when ready.
- `SCRUB_MODES.md` and `ACCENT_CUES.md` are the behavior contracts. When a fix changes behavior, update the contract in the same commit.
- Run `npm.cmd run test:scrub` after every task. It must pass before you move on.
- The embedded preview and the pop-out window must behave identically. Every fix must cover both playback owners (`previewPopoutOpen` true and false).
- Do not reintroduce Bounce mode.
- All code lives in `script.js` (renderer), `preview-popout.html` (pop-out renderer), `main.js` (main process), and `tests/electron-scrub-test.js`. Line numbers below are approximate; search by function name.
- Commit after each task with a short message. Do not batch everything into one commit.
- Wrap `video.play()` rejections everywhere the same way the codebase already does: ignore `AbortError`, log everything else.

## Task 0: Commit the current working tree

The working tree has about 500 uncommitted lines in `script.js`, `preview-popout.html`, `tests/electron-scrub-test.js`, `SCRUB_MODES.md`, and `ACCENT_CUES.md`. Commit them now in three commits:

1. Cue identity repair and cue-edit reconciliation (`ensureCuePointIdentities`, `repairLoadedCueNavigationState`, `captureCueNavigationIdentity`, `reconcileCueNavigationAfterEdit`, `resolveAccentMainCueIndex`, and their call sites in `recordCuePoint`, cue marker drag, cue delete, delete-all, delete-selected, and `loadSessionData`).
2. Atomic Q/W/R navigation under scrub (`getPreviousCueTargetIndex`, `getVerifiedStoredCueIndex`, `getLogicalCueIndexAtPosition`, `beginScrubNavigation`, `recenterActiveScrubForPreviousCue`, the `configureActiveScrubMode` options, changes to `restartClip`, `navigateToPreviousCuePoint`, `navigateToNextCuePoint`, `triggerAccent`, `activateAccentScrub`, and the priority Q/W/R keyboard block).
3. Pop-out navigation generation guard (`scrubNavigationGeneration`, `SCRUB_POPOUT_PLAYBACK_UPDATE_TYPES`, the stale-update filter in `onPreviewUpdate`, the `sendToPopout` stamping, and the `adoptNavigationGeneration` / `withNavigationGeneration` helpers in `preview-popout.html`), plus the doc and test changes.

Expected state after Task 0: the suite fails only at `pop-out MIDI latency result`. Task 1 fixes that.

## Task 1: Fix the flaky pop-out latency assertion in the test harness

Problem: `tests/electron-scrub-test.js` creates the pop-out `BrowserWindow` with `show: false` (inside the `create-preview-popout` handler). A hidden window delivers `requestVideoFrameCallback` roughly once per second. The B/F bounce cycle in that test is also about one second, so the single callback phase-locks onto the forward-stroke end and never observes a reverse frame. The `[LATENCY] #9002` trace then logs `no changed frame in pop-out within 2000ms` and the test times out. The app itself is fine; the reverse stroke seeks correctly.

Change:

- In the test's `create-preview-popout` handler, create the pop-out window with `show: true` and a small size (for example 320x180) positioned away from the main window, so it composites every frame. Keep `backgroundThrottling: false`.
- If the main test window is also created hidden, apply the same change to it so embedded `[LATENCY] #9001` measurements are real.

Acceptance: `npm.cmd run test:scrub` passes twice in a row.

## Task 2: Make Play/Pause scrub-aware

Problem: `pausePlayVideo()` (Space, and the mapped `pausePlay` action) drives the video or pop-out directly while scrub owns playback. In Hold the video plays away from the held frame. In Pendulum it plays underneath the seek loop. In Stutter it pauses the video but leaves `scrubEffectRunning` true, so the next drum hit "pauses" an already paused effect.

Change, in `pausePlayVideo()`:

- If `scrubModeActive` is true, do not touch `video` or send `play`/`pause` to the pop-out directly.
- For `stutter`, `pendulum`, `drift`, `manual-stutter`: toggle the effect the same way the drum trigger does for Stutter (pause the effect if `scrubEffectRunning`, otherwise resume it), keeping `scrubEffectRunning` and `scrubLoopLastTimestamp` consistent.
- For `back-forward`: if a stroke is running, stop it in place (`pauseScrubOutput()`, set `scrubBackForwardActiveDirection = 0`, keep `scrubBackForwardDirection` so the next trigger reverses correctly). If no stroke is running, do nothing.
- For `hold`: do nothing.
- For `manual-cc`: when the fader is armed (`scrubFaderMomentaryArmed` and not `scrubFaderGestureActive`), allow normal play/pause but keep `globalPlayIntent` updated. Otherwise do nothing.
- Call `updateScrubStatus()` afterwards.

Add to `SCRUB_MODES.md` under Core Model: "While scrub is active, Play/Pause pauses or resumes the running effect instead of the raw video. It never moves the playhead."

Test: activate Hold, press Space, assert the video stays paused at the hold frame. Activate Stutter, press Space, assert paused; press the drum trigger once, assert playing.

## Task 3: Stop speed changes from overriding scrub

Problem: `changeSpeed()` and `updateSpeedControls()` call `setVideoSpeed()`, which sets `video.playbackRate` and sends `setSpeed` to the pop-out even while scrub is active. This overrides the scrub rate mid-effect. On deactivation `scrubSavedPlaybackRate` restores the old speed, discarding the new one.

Change:

- In `changeSpeed()`: always store `clipSpeeds[clipNumber]` and update the UI. If `scrubModeActive`, set `scrubSavedPlaybackRate = newSpeed` and return without calling `setVideoSpeed()`. Otherwise call `setVideoSpeed()` as now.
- In `updateSpeedControls()`: same guard around the `setVideoSpeed()` call.

Test: activate Stutter at 2x scrub speed, press the 0.5x preset, assert `video.playbackRate` is still 2. Deactivate scrub, assert `video.playbackRate` is 0.5.

## Task 4: Native loop and `ended` must not fight scrub

Problem: only B/F disables `video.loop`. In Stutter, Manual Stutter, and Drift a range that reaches the end of the clip wraps to 00:00 before `currentPos >= end` fires. The embedded `ended` listener calls `handlePlaybackEnd()` during scrub, and the pop-out `ended` handler only handles B/F full range.

Change:

- In `syncScrubNativeLoopSetting()`, return `false` for every non-null scrub mode, not just `back-forward`. Keep restoring the clip's loop setting on deactivation.
- In the embedded `video.addEventListener('ended')` handler: if `scrubModeActive`, handle B/F full range as now, and for every other mode call the mode's boundary action (Stutter: restart at range start; Manual Stutter: stop at range end; Drift: pause; Pendulum: nothing, the loop owns it) and return without calling `handlePlaybackEnd()`.
- In the pop-out `ended` branch of `onPreviewUpdate`: same behavior.
- In `scrubAnimationTick`, also treat `currentPos >= getScrubDuration() - 0.02` as reaching the range end for Stutter and Manual Stutter, so an `ended` event is not required.

Add to `SCRUB_MODES.md`: "Every active scrub mode temporarily disables the clip's native loop so a range that touches the end of the clip cannot wrap to 00:00."

Test: set the range so its end is at the video duration, activate Stutter, assert the video never reports `currentTime < start - 0.05` while the effect runs for one second.

## Task 5: Pop-out clip change anchors on the wrong clip

Problem: in `selectClipSlot()`'s `loadeddata` handler, `popoutCurrentTime` is not reset when a new clip loads. `getScrubActivationCentre()` therefore anchors the new clip's saved scrub on the previous clip's pop-out position. The initial scrub seek is also sent to the pop-out before its clip has loaded, and the pop-out's own `loadeddata` handler then seeks to the In point afterwards. A seek issued before load may never acknowledge, leaving `scrubPopoutSeekPending` stuck for Pendulum, Stutter, and reverse B/F.

Change:

- In the `loadeddata` handler in `selectClipSlot()`, set `popoutCurrentTime = startTime` and `scrubVirtualPosition = startTime` before any `sendToPopout({ type: 'loadClip' ... })`.
- In `preview-popout.html`, after the `loadClip` handler applies `command.currentTime` on `loadeddata`, send a new update `{ type: 'loaded', currentTime, duration }` through `sendPreviewUpdate` (wrapped with `withNavigationGeneration`).
- In `script.js`, when `previewPopoutOpen` is true, defer `activateSavedScrubForSelectedClip(clipNumber)` until that `loaded` update arrives for the current clip. Store the pending clip number; on `loaded`, if it matches the selected clip, call `activateSavedScrubForSelectedClip`. If the pop-out is closed, call it immediately as now.
- Also reset `scrubPopoutSeekPending = false` when `loaded` arrives.

Test: with the pop-out open and two loaded slots each saved with scrub ON (Hold mode), select slot A, seek the pop-out to 3 s, select slot B, assert `scrubCentreDisplay` shows slot B's In point (00:00) and the pop-out video's `currentTime` is within 0.05 of it.

## Task 6: Preserve the pre-scrub play state across accent handovers

Problem: `activateAccentScrub()` and `triggerClipScrubHit()` call `deactivateScrubMode(true, false)`, which pauses the video, then `activateScrubMode()` captures `scrubSavedPlayState = !video.paused`, which is now false. The pop-out branch reads `globalPlayIntent` instead and is correct. After clip scrub, accent, clip, Escape, the embedded preview stays paused while the pop-out resumes.

Change:

- In `activateScrubMode()`, capture `scrubSavedPlayState = globalPlayIntent` for both playback owners. `globalPlayIntent` is already restored by `deactivateScrubMode()` before the re-activation, so it reflects the pre-scrub intent.
- Verify `globalPlayIntent` is kept accurate by the normal play paths (auto-play on selection, Space, Restart, cue navigation). Fix any path that plays or pauses the embedded video without updating it.

Test: play a clip (auto-play on), trigger clip B/F, trigger an accent configured with Pendulum, trigger the clip drum key, press Escape. Assert the embedded video is playing. Repeat with the pop-out open and assert the pop-out video is playing.

## Task 7: Hold trigger must not persist scrub OFF

Problem: in `handleScrubDrumHit()`, the `hold` case calls `deactivateScrubMode()` with default arguments, which writes `enabled: false` to the slot and marks the session modified. The next hit re-enables it. The session dirty flag and the clip indicator flip on every hit.

Change: call `deactivateScrubMode(true)` in the `hold` case so the slot keeps its saved ON state. Leave `Escape` behavior unchanged.

Update `SCRUB_MODES.md` Hold section: "The trigger deactivates the effect but leaves the slot's Scrub On/Off setting unchanged."

Test: with a slot saved scrub ON in Hold, trigger the drum key twice, assert the slot's saved `enabled` is still true and the session was not marked modified by the hits.

## Task 8: Plain accents under an active B/F clip scrub should play from the accent

Problem: in `triggerAccent()`, when the accent has no scrub mode of its own and clip scrub is active, it calls `recenterActiveScrub(accent.time)`. For B/F that reconfigures at the range start and waits, so the performer sees a frozen frame half a range before the accent.

Change: in that branch, call `recenterActiveScrubForNextCue(accent.time)` instead. For B/F this seeks to the accent and starts a forward stroke; other modes keep their existing recenter behavior. Do not change the accent-return navigation context logic.

Update `ACCENT_CUES.md`: "While clip B/F is active, a plain accent starts a forward stroke from the accent timestamp."

Test: activate clip B/F, trigger an unconfigured accent at 3 s, assert the video is playing and `currentTime` is between 3.0 and 3.3 within 300 ms.

## Task 9: Accent direct jump must not be stopped by a coincident cue

Problem: the direct-jump path in `triggerAccent()` sets `lastTimeupdateTime` but not `justNavigatedToCue`. In `forward-stop` mode, a cue within 0.15 s of the accent makes the `timeupdate` handler snap and pause immediately, so the accent looks dead. The same applies to the pop-out `timeupdate` handler.

Change: in the direct-jump path, find any cue whose time is within 0.15 s of `accent.time`. If found, set `justNavigatedToCue = true`, `lastNavigatedCueIndex` to that cue's index, `lastNavigatedCueTime` to its time, and `lastNavigatedCueClipNumber` / `lastNavigatedCueTab` to the current selection. Do not change `clipCurrentCueIndex` (accents must not move the normal cue position).

Test: forward-stop clip with a cue at 2 s and accent A1 at 2 s, trigger A1, assert the video is still playing after 300 ms.

## Task 10: Keyboard focus guard consistency

Problem: after clicking a scrub slider it keeps focus. In `handleKeyboardShortcuts()`, the drum key, Escape, and Q/W/R bypass the `INPUT` guard, but accents A/S/D/F, Space, tab keys, and U do not, so they go silently dead. The drum-key intercept also fires while typing in a text input (clip rename, tab rename, shortcut editing).

Change:

- Add a helper `isTextEntryTarget(target)` that returns true for `INPUT` elements whose `type` is text-like (`text`, `search`, `number`, `email`, `url`, `password`, or empty), for `TEXTAREA`, and for contenteditable elements. Range inputs, checkboxes, and buttons return false.
- Replace the generic `INPUT` / `TEXTAREA` / contenteditable guard with `isTextEntryTarget(event.target)`.
- Apply the same helper to the drum-key intercept so it does not fire during text entry. Keep the scrub key-learn capture as is.
- Remove the now-redundant priority Q/W/R block only if the new guard makes it unnecessary; otherwise keep it.
- On `change` of `#scrubRangeSlider` and `#scrubSpeedSlider`, call `blur()` on the slider so keyboard focus returns to the document.

Update `SCRUB_MODES.md`: "Range and speed sliders never capture performance keys. Only text fields block shortcuts."

Test: focus `#scrubRangeSlider`, press A, assert accent 1 fired. Start a clip rename, type the drum key character, assert scrub was not triggered.

## Task 11: Resync pop-out dead reckoning from timeupdate

Problem: in `scrubAnimationTick()`, for Stutter, Manual Stutter, and forward B/F with the pop-out open, `scrubVirtualPosition` is advanced by `speed * elapsed` with elapsed capped at 0.1 s. It is corrected only by `paused` and `seeked` updates, never by `timeupdate`. Any main-window stall makes the prediction lag and the range end is detected late.

Change: in the `timeupdate` branch of `onPreviewUpdate`, when `scrubModeActive` and the effect is running forward (Stutter, Manual Stutter, or B/F with `scrubBackForwardActiveDirection > 0`), set `scrubVirtualPosition = Math.max(scrubVirtualPosition, update.currentTime)`. Do not touch it during reverse or Pendulum, where the seek loop owns the position.

Test: with the pop-out open in Stutter, monkey-patch the pop-out `timeupdate` reports to claim a time past the range end, and assert the controller issues a restart seek within 150 ms.

## Task 12: Quiet the AbortError noise

`playScrubOutput()` and `playMomentaryFaderOutput()` log `Scrub play error: [object DOMException]` for every play interrupted by a pause. Ignore `AbortError` there, matching the other play handlers, so real errors are visible in the console and in the test's renderer error capture.

## Final checks

1. `npm.cmd run test:scrub` passes twice in a row.
2. `npm.cmd run test:portable` passes.
3. `SCRUB_MODES.md` and `ACCENT_CUES.md` describe the new behavior from Tasks 2, 4, 7, 8, and 10.
4. Hardware acceptance still required: drum trigger feel, fast B/F reversals, external display with the pop-out fullscreen.
