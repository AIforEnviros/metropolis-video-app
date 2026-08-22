# Accent Cue Points

This document defines the behavior of accent cue points. Accents are direct-trigger moments inside a video clip; they are separate from the normal cue sequence.

## Core Model

- Every loaded video slot has four accent positions: **A1**, **A2**, **A3**, and **A4**.
- An accent stores one timestamp in the same video as the slot's normal cue points. It does not create a nested clip or a second video.
- Pressing **Set A1-A4** records the current preview position. Setting an occupied accent replaces its timestamp while retaining its scrub settings.
- The timeline shows accents as purple labelled markers. Double-click a marker, or use its clear button, to remove it.
- Click and drag a purple marker to reposition the accent while previewing the destination frame. Its scrub mode, range, speed, and trigger assignment remain attached to it.
- Accent points move and swap with the rest of their video-slot data.

## Trigger Behavior

- The default keyboard triggers are `A`, `S`, `D`, and `F` for Accent 1-4.
- Each accent action can be remapped independently in **Keyboard Shortcuts**, including MIDI Learn.
- Triggering an assigned accent seeks to its timestamp and plays from there.
- Repeated triggers restart the accent immediately, making rhythmic repetition possible.
- A1-A4 scrub settings are activated only by that accent's dedicated trigger. The general scrub trigger always belongs to the clip and hands playback back to the clip's saved scrub state if an accent effect is active.
- Triggering an unassigned accent does nothing.
- Embedded preview and pop-out playback use the same accent behavior.

## Optional Per-Accent Scrub

- Every assigned accent has its own optional scrub mode, range, and speed.
- Use the **Settings for: Clip / A1 / A2 / A3 / A4** selector at the top of the main Scrub Modes panel to choose exactly which settings are being edited.
- Triggering an accent never changes the selected editor target. The separate **ACTIVE** line identifies whether clip scrub or a particular accent effect is actually running.
- Accent cards show a compact saved summary such as `M.Stut · 0.8s · 1.5x`; the active accent card is highlighted purple.
- **None** preserves the direct jump-and-play behavior.
- Accent scrub settings temporarily override the selected clip's ordinary scrub controls. Ending the accent effect restores the clip's saved mode, range, speed, enabled state, and B/F options.
- Triggering a configured accent always recenters its scrub range at the accent timestamp.
- Repeated accent triggers restart the configured effect from that accent instead of inheriting its previous position or direction.
- **Fader** selects the accent-centered range and waits for the learned CC controller.
- **B/F** starts a new forward stroke and automatically reverses at the accent-centered range boundaries. Accent B/F does not use the clip's Full Range or stop-and-wait options.
- **Pendulum** starts a new oscillation.
- **Stutter**, **Manual Stutter**, **Drift**, and **Hold** restart from the accent according to their standard scrub behavior.
- `Escape` ends an accent scrub effect. Manual Stutter remains active while waiting at its end boundary so the same accent trigger can restart it.
- Changes update the current in-memory session immediately. Use **Save Session** to write them to the session file.

## Relationship to Normal Cue Points

- Triggering an accent does not change the logical position in the normal cue sequence.
- The next **Next Cue Point** command continues to the normal cue after the one active before the accent.
- The next **Previous Cue Point** command goes to the normal cue before the one active before the accent, or to the clip's In point when already before/at the first cue.
- Restarting, changing clips, changing tabs, or clearing the clip clears any temporary accent-return context.
- While scrub mode is active, an accent recenters the active scrub range at the accent timestamp. The next normal cue command still resumes from the preserved normal sequence position; if the active mode is B/F, that cue jump immediately begins a forward stroke.

## Session Persistence

Session format **v1.14** retains each accent's timestamp, optional scrub mode, range, and speed per tab and video slot in `tabs.accentPoints`. v1.12 accents migrate to **None**, a 2-second range, and 1x speed. Older sessions without accent data load with all four accent positions unset.

## Verification

Run:

```powershell
npm.cmd run test:scrub
```

The Electron integration suite covers per-slot storage, repeated direct triggering, temporary per-accent scrub playback, ordinary-setting restoration, preserved normal cue progression, pop-out playback, migration, and session round-tripping.
