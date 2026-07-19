# Metropolis Video App — Developer Quick Start

## Active Architecture

The active project is an Electron desktop application:

- Main process: `main.js`
- Secure renderer bridge: `preload.js`
- Renderer UI and playback: `index.html` and `script.js`
- Projection window: `preview-popout.html`

The `src/` React/TypeScript application and old browser-server commands are legacy code. Do not use them for current development.

## Install and Run

```bash
npm install
npx @electron/rebuild
npm start
```

On restricted Windows PowerShell, use `npm.cmd` and `npx.cmd`:

```powershell
npm.cmd install
npx.cmd @electron/rebuild
npm.cmd start
```

## Verification

Run the scrub-mode Electron integration suite:

```powershell
npm.cmd run test:scrub
```

The suite launches hidden Electron windows and uses `test-videos/test-video.mp4`. It covers the embedded renderer, preload IPC, keyboard and MIDI events, cue navigation, every scrub mode, and the pop-out window.

## Documentation Map

- `CLAUDE.md`: Claude Code project context and historical implementation notes
- `AGENTS.md`: Codex/project-agent context
- `SCRUB_MODES.md`: authoritative scrub behavior contract
- `Development_plan.md`: development history and remaining roadmap
- `README.md`: collaborator setup and basic operating instructions
- `IPMIDI_TROUBLESHOOTING.md`: network MIDI troubleshooting

## Current Branch

Active scrub development is on `feature/scrub-modes`. Check `git status --short --branch` rather than relying on an old branch name in historical documentation.
