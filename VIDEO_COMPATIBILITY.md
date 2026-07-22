# Video Compatibility and Scrub Performance

The filename extension describes the container, not the video codec inside it. Electron can open an `.mp4` or `.mov` container and still reject the encoded video stream.

## Recommended Performance Format

For the most predictable Windows/macOS playback, use:

- MP4 container
- H.264/AVC video
- `yuv420p` pixel format
- Constant frame rate matching the source
- No audio track (the performance audio comes from Ableton Live)
- Frequent keyframes for responsive fader scrubbing

The app now reports whether a failure is a file-access problem, a decoder failure, or an unsupported source. The message appears directly below the preview.

## Why the Fader Depends on Encoding

Fader mode has a latest-value-wins seek pipeline: it sends only one seek to the decoder at a time and discards superseded MIDI positions. This prevents controller messages from building up behind the physical fader.

The decoder must still start at a keyframe and decode forward to display many requested frames. A file with long gaps between keyframes will therefore scrub less smoothly than a file prepared for interactive seeking.

## FFmpeg Conversion

This is a balanced performance conversion for 24 fps material, using a keyframe approximately every half second:

```bash
ffmpeg -i input.mov -an -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -g 12 -keyint_min 12 -sc_threshold 0 -movflags +faststart output-performance.mp4
```

For other frame rates, set `-g` and `-keyint_min` to roughly half the frame rate. For example, use `15` at 30 fps.

For the smoothest possible fader response, an all-intra encode (`-g 1`) makes every frame independently seekable, but creates much larger files:

```bash
ffmpeg -i input.mov -an -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -g 1 output-scrub.mp4
```

## macOS Acceptance Check

1. Pull the branch and run `npm install` followed by `npx electron-rebuild -f -w @julusian/midi`.
2. Start with `npm start`.
3. Drop a known H.264 MP4 whose path contains a space onto a clip slot.
4. Confirm the preview loads, plays, seeks, and opens in the pop-out window.
5. Try a previously failing video and record the exact message shown below the preview.
6. Convert that file with the balanced command above and repeat the test.

Native macOS testing is still required because the Windows test environment cannot exercise macOS folder permissions or Apple decoder behavior.
