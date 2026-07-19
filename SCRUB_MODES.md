# Scrub Modes

This document is the behavior contract for the scrub-mode feature. If implementation details, tooltips, or other documentation disagree with this file, update them to match the behavior described here.

## Core Model

- Scrub is centered on the last cue point reached through cue navigation. If no cue has been navigated to for the selected clip, it uses the current playhead position.
- **Range** is the total duration around the center, not the duration on each side.
- Range limits: **0.1–10 seconds**, in **0.05-second** increments.
- Speed limits: **0.1×–4×**.
- Scrub playback temporarily owns play, pause, seeking, and playback rate. Deactivation restores the play/pause state and speed that existed before activation.
- Changing clip or tab safely deactivates scrub and clears stale cue-center state.
- The embedded preview and pop-out projection window must exhibit the same behavior.

## Modes

### Fader (`manual-cc`)

- Pauses playback while active.
- Maps a learned MIDI CC value from 0–127 across the complete scrub range.
- CC 0 selects the range start; CC 127 selects the range end.

### B/F (`back-forward`)

- Activates at the range start and waits.
- The first trigger starts forward playback.
- Every later trigger reverses direction at the current playhead position. It must not jump to either range boundary.
- Reaching the range start or end stops playback and waits for another trigger.
- A trigger at a stopped boundary reverses playback away from that boundary.
- Forward strokes use normal video playback. Backward strokes use decoder-paced frame seeks because Chromium does not reliably support a negative playback rate.

### Pendulum (`pendulum`)

- Oscillates continuously between the range boundaries.
- Reverses automatically at each boundary.
- Uses decoder-paced frame seeks in both directions so reverse frames are allowed to decode and display.
- The drum/key trigger pauses or resumes the oscillation.

### Stutter (`stutter`)

- Plays forward from range start to range end, then jumps back to range start and repeats.
- The drum/key trigger pauses or resumes the effect.

### Drift (`drift`)

- Starts at the scrub center and plays forward at one quarter of the scrub speed, with a minimum playback rate of 0.1×.
- The drum/key trigger restarts the drift from the center.

### Hold (`hold`)

- Pauses and holds the exact scrub-center frame.
- The next drum/key trigger deactivates scrub and restores the pre-scrub playback state.

## Cue Navigation and Priority

- While scrub is active, **Next Cue Point** advances the scrub center to the first cue after the current center.
- Advancing from the final cue wraps directly to the first cue.
- The remapped Next Cue Point key receives priority even if a scrub slider still has focus.
- `Escape` always deactivates scrub, including when a slider has focus.
- The learned scrub drum key has first-hit activation: when a mode is selected but inactive, the first hit activates it. For B/F, that same hit begins the first forward stroke.
- A learned MIDI drum note has the same first-hit activation behavior.

## MIDI and Keyboard Learn

- **CC Fader** accepts MIDI Control Change messages.
- **Drum (MIDI)** accepts Note On messages with velocity greater than zero.
- **Drum (Key)** accepts a keyboard key or modified key combination.
- Scrub mappings are stored separately from the standard keyboard/MIDI action mappings.

## Session Persistence

Scrub settings are stored in session format **v1.8**:

- Range and speed
- Learned CC controller
- Learned MIDI drum note
- Learned keyboard drum trigger
- Last selected scrub mode

Loading a session restores the settings and selected mode but does not automatically activate scrub.

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

- All six modes
- Keyboard and MIDI learn
- First-hit activation
- Current-position B/F reversals and boundary waiting
- Decoder-completed reverse frames
- Cue advancement, focused-control priority, and last-to-first wrapping
- Pre-scrub state restoration
- Embedded and pop-out playback behavior

## Hardware Acceptance Checks

Automated tests cannot measure the physical controller or performance setup. Before merging or releasing changes, verify:

- Trigger feel and latency with the performance MIDI controller
- Fast repeated B/F reversals
- Pendulum smoothness with representative Metropolis footage
- Very short ranges at several speeds
- Operation while the projection window has focus
- External-display behavior during a realistic performance session
