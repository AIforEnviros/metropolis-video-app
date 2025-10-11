# Bounce Mode - Outstanding Issue

## Problem
The bounce mode reverse playback transition is **NOT SMOOTH**.

### Symptoms
- Forward playback works perfectly
- When video reaches the end and should reverse, there is **lag/freeze**
- Only the last portion of the clip plays in reverse smoothly
- Then it bounces forward smoothly again

### What We've Tried
1. ✗ Native `video.playbackRate = -1` (browsers don't support this well)
2. ✗ `setInterval` with frame-by-frame rewind (too choppy)
3. ✗ `requestAnimationFrame` with manual currentTime adjustment (current implementation - still lags on transition)

### Current Implementation
- File: `script.js` lines 2433-2478
- Method: `requestAnimationFrame` loop that decrements `video.currentTime`
- Issue: Transition from `ended` event to reverse animation is not smooth

### Next Steps to Try

#### Option 1: Pre-buffer approach
Start the reverse animation BEFORE video ends (e.g., at 95% duration) to eliminate the transition gap

#### Option 2: Dual video elements
Use two hidden video elements - one playing forward, one loaded backward, seamlessly switch between them

#### Option 3: Video seeking optimization
Pre-seek to various timestamps during forward playback to improve browser caching for reverse

#### Option 4: Canvas-based rendering
Render video frames to a canvas and manually control playback for full control

#### Option 5: Check if specific video codec/format helps
Some formats may seek better than others in reverse

### Testing Notes
- User has tested multiple times - consistently laggy transition
- All other modes (loop, forward-next, forward-stop) work perfectly
- Auto-start functionality now working correctly

### Files to Review
- `script.js` - `handlePlaybackEnd()` function (bounce case)
- `script.js` - bounce animation frame logic

### Status
**BLOCKED** - Needs different technical approach for smooth reverse playback
