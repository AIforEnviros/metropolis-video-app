# Per-Clip MIDI Controller Permissions

## Purpose

MIDI mappings remain shared across every connected controller. Per-clip MIDI permissions add a second, allow-by-default check: after a MIDI message matches an action, the selected clip decides whether the physical controller that sent it may execute that action.

This prevents one performer from accidentally changing cue or scrub playback during clips controlled by the other performer without duplicating the application's MIDI mappings.

## Setup

1. Connect both MIDI controllers before launching the application.
2. Configure the shared mappings in **Keyboard & MIDI Shortcuts** and the Scrub Modes panel as normal.
3. Right-click a clip and choose **MIDI Permissions…**.
4. Leave a checkbox selected to allow that controller and action. Clear it to block that combination on this clip.
5. Close the window with **Done**. Changes take effect immediately and are saved with the session.

**Allow All** removes every restriction from the selected clip. A **MIDI 🔒** badge appears on any clip containing at least one restriction.

## Restricted actions

- Next Cue
- Previous Cue
- Restart
- Scrub Trigger
- Scrub Fader
- Scrub Range
- Scrub Speed
- Accents A1-A4

Next/Previous Clip, tab switching, keyboard shortcuts, and Master Output Fade remain global and are never filtered by this feature.

## Behavior

- New clips and older sessions allow every controller by default.
- Permissions belong to the video slot and move with it when clips are moved or swapped.
- Selecting a new clip immediately activates that clip's permissions.
- Mappings remain device-independent. Blocking a controller does not alter or delete the underlying mapping and does not block another allowed controller sending the same note or CC.
- Saved restrictions for a disconnected controller remain visible as **Not connected** when the permission window is opened.
- Controller identity is based on the MIDI input name reported by the operating system. If a controller appears under a different name on another computer, configure that listed input for the clip before performing.

## Performance

Permission checks are synchronous in-memory lookups in the renderer before the existing mapped action runs. They perform no disk access, IPC calls, or asynchronous work in the trigger path. Continuous scrub CC controls use the same check.

Automated coverage is part of `npm.cmd run test:scrub`. Physical testing should confirm the intended permissions with both performance controllers connected.
