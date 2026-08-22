# Portable Sessions

## Collect All & Save

Use **Collect All & Save** to create a self-contained copy of the current show for backup or transfer to another computer.

1. Load and configure the show normally.
2. Click **Collect All & Save** in the header.
3. Choose or create an empty destination folder. To update a package created earlier, select that same package folder again.
4. Wait for the completion message before moving or deleting any source media.

The destination contains one session JSON file and a `Media` folder. The collected session stores relative media paths, so the complete folder can be moved between Windows and macOS without rewriting paths.

```text
Portable Show/
├── metropolis-session.json
└── Media/
    ├── scene.mp4
    └── scene-2.mp4
```

Files reused by multiple slots are copied once. Different source files with the same filename receive collision-safe names such as `scene.mp4` and `scene-2.mp4`.

For safety, collection writes into either an empty folder or the same valid portable package created earlier. Repeat collection stages the complete update before replacing the old package. Unrelated non-empty folders, unreadable packages, and unmanaged files inside `Media` are left untouched.

## Loading and Relocating

Load the collected JSON with **Load Session**. Media paths resolve relative to the JSON file, so always move the JSON and `Media` folder together.

If the media folder is missing, the app offers to locate it. Select the package's `Media` folder. Loading without the missing files remains available for recovery.

Ordinary sessions with absolute file paths remain compatible. Opening an older session and saving it normally does not automatically copy its media; use **Collect All & Save** when a portable package is required.

## Verification

Run the portable-session file tests with:

```powershell
npm.cmd run test:portable
```

The test covers shared media, filename collisions, relative paths, moving and updating a complete package, preservation of show data, and refusal to overwrite unrelated files.
