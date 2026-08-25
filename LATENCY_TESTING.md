# MIDI-to-Video Latency Testing

This optional diagnostic mode measures the app's contribution to MIDI-trigger latency without changing normal playback behaviour.

## Start the app in latency mode

From Command Prompt in the project folder:

```bat
npm.cmd start -- --latency-debug
```

Use the app normally and watch the same Command Prompt window. A mapped MIDI trigger that changes the displayed video frame prints a line similar to:

```text
[LATENCY] #3 scrub trigger: back-forward [reverse] (pop-out) | IPC 0.4ms | dispatch 0.2ms | action→frame 18.1ms | total 18.7ms | decode 1.3ms
```

Normal launches with `npm.cmd start` do not create latency traces or request diagnostic frame callbacks.

## What the figures mean

- `IPC`: native MIDI callback in Electron's main process to receipt in the renderer.
- `dispatch`: renderer receipt to starting the mapped playback action.
- `action→frame`: playback action to the expected display time of the first matching video frame.
- `total`: native MIDI callback to the expected display time of that frame.
- `decode`: Chromium's reported media processing duration, when available.

B/F scrub-trigger measurements also include `[forward]` or `[reverse]` so the two directions can be compared directly.

Pop-out measurements capture the pop-out video's local frame time as their baseline. This avoids the delay in the main window's throttled timeline updates being counted as trigger latency.

These measurements do not include the time from physically striking the drum to the computer receiving MIDI, or the delay added by the projector/display. A high-frame-rate phone recording is still the best way to measure the complete physical system.

## First comparison test

Use one representative performance clip and leave at least one second between strikes:

1. Test the embedded preview with 10 B/F reversals.
2. Open the pop-out preview and test another 10 B/F reversals.
3. Test 10 next-cue triggers.
4. Copy the resulting `[LATENCY]` lines for comparison.

Testing isolated strikes avoids one frame being incorrectly associated with two rapidly overlapping diagnostic traces.
