# Metropolis Live Remix — Setup

## Requirements

- Windows or macOS
- Node.js with npm
- Git
- A supported MIDI controller for hardware testing
- A second display or projector for output-window acceptance testing

## Clone and Install

```bash
git clone https://github.com/AIforEnviros/metropolis-video-app.git
cd metropolis-video-app
npm install
npx @electron/rebuild
```

Do not run the application through `npx serve`, localhost, or the legacy React scripts. The active application is Electron.

## Start

```bash
npm start
```

Restricted Windows PowerShell may require:

```powershell
npm.cmd start
```

## Update an Existing Checkout

```bash
git pull
npm install
npx @electron/rebuild
npm start
```

Only rebuild the native dependency when Electron, Node, or `@julusian/midi` has changed, but running the rebuild after dependency updates is safe.

## Test Scrub Modes

```bash
npm run test:scrub
```

Restricted Windows PowerShell:

```powershell
npm.cmd run test:scrub
```

See `SCRUB_MODES.md` for expected behavior and the hardware acceptance checklist.

## MIDI Check

1. Connect the MIDI device before launching the app.
2. Start the Electron application.
3. Open **Keyboard Shortcuts**.
4. Refresh/select the MIDI device.
5. Click **Learn** beside an action and strike the desired pad.
6. Confirm the learned note/CC triggers the action.

## Troubleshooting

If dependencies appear corrupted, keep the lockfile and reinstall exactly:

```bash
rm -rf node_modules
npm ci
npx @electron/rebuild
```

For ipMIDI-specific problems, see `IPMIDI_TROUBLESHOOTING.md`.
