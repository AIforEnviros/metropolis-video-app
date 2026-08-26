# Scrub Modes

This document is the behavior contract for the scrub-mode feature. If implementation details, tooltips, or other documentation disagree with this file, update them to match the behavior described here.

## Core Model

- Scrub is anchored to the last cue point reached through cue navigation. If no cue has been navigated to for the selected clip, it uses the current playhead position.
- **Range** is the total scrub duration, not the duration on each side.
- **Cue position in range** controls where the anchor sits: **Start** makes the cue/accent the exact range start, **Centre** divides the range evenly around it (the default and legacy behavior), and **End** makes it the exact range end.
- At the beginning or end of a video, the range is shortened instead of moving the selected anchor away from the cue/accent.
- Range limits: **0.1–10 seconds**, in **0.05-second** increments.
- Speed limits: **0.1×–4×**.
- Scrub playback temporarily owns play, pause, seeking, and playback rate. Deactivation restores the play/pause state and speed that existed before activation.
- New video slots default to Fader mode with scrub ON, a 2-second range, and 1× scrub speed.
- Enabled state, mode, range, cue position, speed, and B/F options are independent for every video slot; selecting a loaded slot restores and, when enabled, activates its saved scrub behavior.
- Changing clip or tab safely deactivates scrub and clears stale cue-center state.
- The embedded preview and pop-out projection window must exhibit the same behavior.
- The Scrub Modes panel has an explicit **Clip / A1 / A2 / A3 / A4** settings target. This controls only which saved configuration is being edited; it does not activate playback.
- A separate ACTIVE display identifies the scrub source currently running. Playback triggers never silently switch the settings editor target.

## Modes

### Fader (`manual-cc`)

- For clips with normal cue points, pauses playback while active as before.
- For clips with no normal cue points, stays **armed** while the video plays normally from end to end.
- The first learned-fader movement on an armed clip captures the current frame as the scrub anchor, pauses playback, and temporarily takes ownership for scratching.
- MIDI CC faders do not report touch/release, so 100 ms without a new fader value marks the end of the scratch gesture.
- After the final decoder seek completes, forward playback resumes from the last scratched frame. A clip that was paused before the gesture remains paused.
- The ACTIVE display distinguishes **FADER ARMED** from **FADER SCRATCHING**.
- Maps a learned MIDI CC value from 0–127 across the complete scrub range.
- CC 0 selects the range start; CC 127 selects the range end.
- Coalesces dense MIDI input so only one decoder seek is active at a time and the newest fader position always wins.
- Final smoothness also depends on source encoding and keyframe spacing; see `VIDEO_COMPATIBILITY.md`.

### B/F (`back-forward`)

- Activates at the range start and waits.
- The first trigger starts forward playback.
- While B/F is active, **Next Cue Point** recenters the range at the destination cue and immediately starts a forward stroke. The following scrub trigger reverses from the current frame.
- Every later trigger reverses direction at the current playhead position. It must not jump to either range boundary.
- **Auto-reverse at boundaries** is ON by default. Reaching either boundary reverses direction automatically, so playback keeps bouncing until scrub mode is deactivated.
- Turning **Auto-reverse at boundaries** OFF restores stop-and-wait behavior: playback stops at the reached boundary until the next trigger reverses it away from that boundary.
- A trigger can reverse playback immediately at any point in either boundary mode.
- B/F alone can use **Full video / In-Out** instead of the positioned 0.1–10 second range. Its boundaries are the clip's valid In/Out points when set, otherwise `00:00` and the complete video duration. Cue position is disabled and ignored while Full range is selected.
- While B/F is active it temporarily disables the clip's native loop setting so a full-video boundary cannot restart at `00:00` before B/F reverses or stops. The clip's normal loop setting is restored afterward.
- Forward strokes use normal video playback. Backward strokes use decoder-paced frame seeks because Chromium does not reliably support a negative playback rate.

### Pendulum (`pendulum`)

- Oscillates continuously between the range boundaries.
- Reverses automatically at each boundary.
- Uses decoder-paced frame seeks in both directions so reverse frames are allowed to decode and display.
- The drum/key trigger pauses or resumes the oscillation.

### Stutter (`stutter`)

- Plays forward from range start to range end, then jumps back to range start and repeats.
- Waits for each restart seek to finish before requesting another, preventing short ranges from overwhelming the decoder.
- The drum/key trigger pauses or resumes the effect.

### Manual Stutter (`manual-stutter`)

- Plays forward from range start to range end once, then stops at the range end and waits.
- Each drum/key trigger immediately jumps back to the range start and plays one more pass.
- A trigger received during a pass restarts that pass immediately from the range start.

### Drift (`drift`)

- Starts at the scrub center and plays forward at one quarter of the scrub speed, with a minimum playback rate of 0.1×.
- The drum/key trigger restarts the drift from the center.

### Hold (`hold`)

- Pauses and holds the exact scrub-center frame.
- The next drum/key trigger deactivates scrub and restores the pre-scrub playback state.

## Cue Navigation and Priority

- While scrub is active, **Next Cue Point** advances the scrub center to the first cue after the current center.
- In B/F, that cue advance begins forward playback immediately; other modes retain their normal recenter behavior.
- Advancing from the final cue wraps directly to the first cue.
- The remapped Next Cue Point key receives priority even if a scrub slider still has focus.
- `Escape` always deactivates scrub, including when a slider has focus.
- The learned scrub drum key always controls the selected clip's saved scrub mode, regardless of whether the settings editor is displaying Clip or A1-A4. When inactive, its first hit activates the clip mode; for B/F, that same hit begins the first forward stroke.
- If an accent scrub effect is active, the clip's scrub trigger hands playback back to the clip and performs the clip-mode trigger immediately.
- A learned MIDI drum note follows exactly the same ownership and first-hit behavior as the keyboard scrub trigger.
- **Toggle Clip Scrub On/Off** is independently keyboard and MIDI mappable in **Keyboard Shortcuts**. Its default key is `U`, and it performs the same saved per-clip toggle as clicking the Scrub On/Off button.

## MIDI and Keyboard Learn

- **CC Fader** accepts MIDI Control Change messages.
- **Range MIDI** maps CC 0–127 across the visible Range slider's 0.1–10 second limits and edits the currently displayed Clip or Accent scope. It is ignored while B/F Full range has disabled the slider.
- **Speed MIDI** maps CC 0–127 across the visible Speed slider's 0.1×–4× limits and edits the currently displayed Clip or Accent scope.
- Dense Range and Speed CC streams are coalesced to the newest value once per animation frame.
- **Drum (MIDI)** accepts Note On messages with velocity greater than zero.
- **Drum (Key)** accepts a keyboard key or modified key combination.
- Scrub mappings are stored separately from the standard keyboard/MIDI action mappings.

## Session Persistence

Scrub settings are retained in the application's session format **v1.17**.

Saved per video slot:

- Enabled/disabled state
- Selected scrub mode
- Range
- Cue position in range (Start/Centre/End)
- Speed
- B/F Full video / In-Out selection
- B/F Auto-reverse at boundaries selection

Saved globally because they describe the physical controls:

- Learned CC controller
- Learned Range CC controller
- Learned Speed CC controller
- Learned MIDI drum note
- Learned keyboard drum trigger

Loading a session restores each slot independently. A slot saved with scrub ON activates automatically when its connected video is selected. Sessions from v1.8 and earlier migrate their former global range, speed, and last mode to every video slot with scrub ON.

## Automated Verification

Run the real Electron integration suite from the project directory:

```powershell
npm.cmd run test:scrub
```

On macOS or a shell where `npm` is directly available:

```bash
npm run test:scrub
```

The suite uses `test-videos/test-video.mp4` and verifies:

- All seven modes
- Keyboard and MIDI learn
- First-hit activation
- Current-position B/F reversals, automatic boundary turnarounds, and optional stop-and-wait boundaries
- Decoder-completed reverse frames
- Cue advancement by cue identity, focused-control priority, media-edge range clamping, and last-to-first wrapping
- Pre-scrub state restoration
- Embedded and pop-out playback behavior
- Cue-less Fader armed playback, momentary scratching, decoder-safe idle resumption, and paused-state retention
- Dense 128-message fader bursts without decoder seek backlogs
- Cross-platform file URL encoding for spaces and reserved characters
- Start/Centre/End range anchoring, clip/accent separation, and media-edge clamping
- Per-slot mode/range/cue-position/speed/B-F-options/ON-OFF restoration, Range/Speed CC mappings, and session v1.17 round-tripping

## Hardware Acceptance Checks

Automated tests cannot measure the physical controller or performance setup. Before merging or releasing changes, verify:

- Trigger feel and latency with the performance MIDI controller
- Fast repeated B/F reversals
- Pendulum smoothness with representative Metropolis footage
- Very short ranges at several speeds
- Operation while the projection window has focus
- External-display behavior during a realistic performance session
