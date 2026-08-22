# Master Output Fade

## Purpose

The global **Master Output** fader fades the performance output between full video and solid black without pausing or seeking playback. Cue progression, scrub modes, accents, clip changes, and tab changes continue normally underneath black.

The embedded preview and pop-out output always receive the same fade level:

- **100%**: video is fully visible.
- **1–99%**: video is progressively mixed with black.
- **0%**: output is solid black and the UI displays a **BLACK** badge.

The fade uses a separate black overlay. It does not change the opacity used internally to switch between forward and reverse playback.

## MIDI Assignment

1. Open **Keyboard Shortcuts**.
2. Find **Master Output Fade Fader**.
3. Click **Learn** and move the intended hardware fader.
4. The mapping must be a MIDI CC message; notes are ignored while learning this control.
5. Click **Save Changes**.

MIDI CC value `0` maps to black and `127` maps to fully visible by default. Enable **Reverse MIDI direction** below the on-screen fader when the hardware should work in the opposite direction. The on-screen slider itself always reads from black on the left to fully visible on the right.

The mapping remains device-independent, consistent with the rest of the application. Controllers sending the same channel and CC number will both operate the fade. The output fade has priority if its CC is also assigned to another action, so use a dedicated channel/CC to avoid a mapping conflict.

## Persistence and Startup

Session format **v1.15 and later** saves the MIDI mapping and the Reverse MIDI direction preference. It intentionally does not save the live fade position. A new application launch starts fully visible, preventing a saved session from unexpectedly reopening black.

Loading another session while the app is running retains the current output level, preventing a black output from flashing visible during a show change.

## Verification

Run:

```powershell
npm.cmd run test:scrub
```

The Electron regression test covers CC-only learning, black/midpoint/visible positions, uninterrupted playback beneath black, rapid CC movement, pop-out synchronization, reversed direction, and session round-tripping.
