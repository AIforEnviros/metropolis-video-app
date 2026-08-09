# Accent Cue Points

This document defines the behavior of accent cue points. Accents are direct-trigger moments inside a video clip; they are separate from the normal cue sequence.

## Core Model

- Every loaded video slot has four accent positions: **A1**, **A2**, **A3**, and **A4**.
- An accent stores one timestamp in the same video as the slot's normal cue points. It does not create a nested clip or a second video.
- Pressing **Set A1-A4** records the current preview position. Setting an occupied accent replaces its previous timestamp.
- The timeline shows accents as purple labelled markers. Double-click a marker, or use its clear button, to remove it.
- Accent points move and swap with the rest of their video-slot data.

## Trigger Behavior

- The default keyboard triggers are `A`, `S`, `D`, and `F` for Accent 1-4.
- Each accent action can be remapped independently in **Keyboard Shortcuts**, including MIDI Learn.
- Triggering an assigned accent seeks to its timestamp and plays from there.
- Repeated triggers restart the accent immediately, making rhythmic repetition possible.
- Triggering an unassigned accent does nothing.
- Embedded preview and pop-out playback use the same accent behavior.

## Relationship to Normal Cue Points

- Triggering an accent does not change the logical position in the normal cue sequence.
- The next **Next Cue Point** command continues to the normal cue after the one active before the accent.
- The next **Previous Cue Point** command goes to the normal cue before the one active before the accent, or to the clip's In point when already before/at the first cue.
- Restarting, changing clips, changing tabs, or clearing the clip clears any temporary accent-return context.
- While scrub mode is active, an accent recenters the active scrub range at the accent timestamp. The next normal cue command still resumes from the preserved normal sequence position.

## Session Persistence

Session format **v1.12** saves accent timestamps per tab, video slot, and accent number in `tabs.accentPoints`. Older sessions without accent data load with all four accent positions unset.

## Verification

Run:

```powershell
npm.cmd run test:scrub
```

The Electron integration suite covers per-slot storage, repeated direct triggering, preserved normal cue progression, pop-out playback, and session round-tripping.
