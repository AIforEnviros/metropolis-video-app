\# Video Performance Application - Metropolis Live Remix

## 🚨 CRITICAL: Project Structure

**ELECTRON APPLICATION (ACTIVE DEVELOPMENT)**

This is now an Electron-based desktop application for production live performance use.

**Running the Application:**
- **Development mode:** `npm start` (launches Electron app)
- **Build distributables:** `npm run build` (creates .exe, .dmg, etc.)
- **Install dependencies:** `npm install` (required after cloning)

**Architecture:**
- **Main Process:** `main.js` - Electron window management, native APIs, MIDI integration
- **Renderer Process:** `index.html` + `script.js` - UI and video playback logic
- **IPC Communication:** `preload.js` - Secure bridge between main and renderer processes

**Status:** Phase 2 - Electron Conversion (from completed web prototype)
- Web prototype (Phase 1) completed: 19/21 steps (90%)
- Now converting to Electron for production performance use
- All core features validated in web version

**Legacy Code:**
- `src/` directory contains old React/TypeScript prototype (can be ignored/removed)
- Git history on `master` branch contains complete web prototype version

---

\## Project Overview

A live video performance application designed for remixing the 1927 film Metropolis in a live band setting. The drummer uses MIDI triggers to control scene transitions and tempo, while the band performs alongside the visuals. The app enables frame-accurate control over film segments with unlimited cue points for seamless live cinema performance.



\## Performance Context

\- \*\*Primary use case\*\*: Live remix performance of 1927 Metropolis film

\- \*\*Key performer\*\*: Drummer controls scene progression via MIDI triggers

\- \*\*Workflow\*\*: Linear progression through film scenes with rhythmic control

\- \*\*Creative goal\*\*: Synchronize live music with classic cinema, allowing musical tempo to drive visual pacing



\## Why This Architecture Makes Sense

\- \*\*Unlimited cue points\*\*: Essential for marking every scene transition, beat, and rhythmic moment in the film

\- \*\*MIDI step-through\*\*: Drummer can advance scenes in time with the music rather than fixed film timing

\- \*\*Tempo control\*\*: Adjust scene playback speed to match live musical performance tempo

\- \*\*Matrix organization\*\*: Different film segments loaded across tabs for different songs/movements

\- \*\*Session persistence\*\*: Save complete show setups with all cue points for recurring performances



\## Core Features



\### Video Matrix System

\- Drag-and-drop interface for loading video files into matrix slots

\- Each matrix slot contains one video with unlimited cue points

\- Individual clip playback controls for each matrix slot

\- Tab-based organization (each song/performance gets its own page)



\### Cue Point System

\- \*\*Unlimited cue points\*\* per video clip

\- Cue points are NOT directly MIDI-mapped

\- Navigation through cue points via dedicated transport controls:

&nbsp; - \*\*STEP FORWARD\*\*: Advances to next cue point (MIDI/keyboard mappable)

&nbsp; - \*\*STEP BACKWARDS\*\*: Cycles through cue points in reverse (MIDI/keyboard mappable)  

&nbsp; - \*\*RESET\*\*: Returns to first cue point of selected clip (MIDI/keyboard mappable)



\### Transport Controls

\- \*\*Global transport buttons\*\*: Play/Pause/Reverse for overall playback control

\- All transport functions must be MIDI and keyboard mappable

\- Individual clip selection and playback within the matrix



\### Output System

\- \*\*Dual screen support\*\*: Send output to separate display for live performance

\- Clean output feed for projection/external displays



\### MIDI Integration

**Native MIDI via Electron (node-midi):**

\- **Direct hardware access:** Native MIDI device communication without Web MIDI API limitations

\- **Lower latency:** Critical for live drumming - sub-10ms response time

\- **Reliable connection:** No browser permission prompts or connection drops

\- **Device enumeration:** Automatically detect and list all connected MIDI controllers

**MIDI Mapping Capabilities:**

\- Everything except individual cue points must be MIDI mappable:
  - Global transport controls (play/pause/reverse)
  - Cue point navigation (forward/back/restart)
  - Clip selection and switching
  - Tab switching
  - Speed control
  - Output window toggle
  - "Shit It Up" control intensity

\- **MIDI Learn mode:** Click any control, trigger MIDI input, auto-map

\- **Save MIDI mappings:** Stored in session files for each show setup

\- **Multiple device support:** Use multiple MIDI controllers simultaneously

\- **Comprehensive keyboard shortcuts:** Alternative to MIDI for all functions

\- **Real-time responsiveness:** Sub-frame accuracy for live performance



\### Special Features

\- \*\*"Shit It Up" control\*\*: A dial/knob that can be "dialed like a motherfucker" 

&nbsp; - Range: 0 to maximum intensity

&nbsp; - Purpose: Add chaos/intensity effects to video output

&nbsp; - Must be MIDI mappable for live performance control



\## Technical Requirements



\### Performance Priorities

\- \*\*Low latency\*\*: Critical for live performance

\- \*\*Stable playback\*\*: No dropped frames during performance

\- \*\*Responsive UI\*\*: Immediate feedback for all user interactions

\- \*\*MIDI reliability\*\*: Consistent MIDI response timing



\### UI Layout Requirements

\- Create annotated UI mockup with numbered sections explaining each area

\- Matrix grid for video slots

\- Transport controls prominently placed

\- Cue point indicators and controls

\- Tab system for multiple pages/songs

\- "Shit It Up" knob prominently featured



\## Development Notes



\### User Experience Goals

\- Designed for live performance environment (dark stages, quick decisions)

\- Jarman's workflow: Each song should have its own dedicated page/tab

\- Intuitive drag-and-drop video loading

\- Visual feedback for all active states and selections



\### Technical Considerations

\- Support common video formats (MP4, MOV, AVI, etc.)

\- Handle various video resolutions and frame rates

\- Efficient memory management for multiple loaded videos

\- Smooth scrubbing through cue points



\## Development Guidelines



\### Testing Requirements

\*\*CRITICAL: Test every feature thoroughly before presenting code.\*\* 

\- Verify drag-and-drop actually works with real files

\- Confirm videos actually load and play (not just UI mockups)

\- Test all buttons and controls perform their intended functions

\- Don't just make it look right - make it work right

\- If something doesn't work, debug and fix it before showing the code

\- Test with actual video files, not placeholder content



\### Development Approach

\- \*\*Start simple\*\*: Build one feature at a time, test it completely, then move to the next

\- \*\*Incremental development\*\*: Don't try to build everything at once

\- \*\*Working code over pretty code\*\*: Functionality first, polish later

\- \*\*Real testing\*\*: Use actual video files and user interactions, not simulated behavior



\### Git Workflow Strategy

\*\*IMPROVED WORKFLOW (Starting Step 8):\*\*

\- \*\*Push regularly\*\*: Always push after completing each step to avoid data loss
\- \*\*Smaller commits\*\*: Break each step into 2-4 focused commits instead of one large commit
\- \*\*Commit pattern for each step\*\*:
  1. Add HTML structure changes
  2. Add CSS styling changes
  3. Add JavaScript functionality
  4. Update development plan documentation

\*\*Example commit sequence for a step:\*\*
```bash
git add index.html && git commit -m "Add tab bar HTML structure"
git add index.html && git commit -m "Style tab buttons with active states"
git add script.js && git commit -m "Implement tab switching functionality"
git add Development_plan.md && git commit -m "Mark Step X completed"
git push origin master
```

\*\*Benefits:\*\*
\- Better progress tracking and debugging
\- Easier to revert specific changes
\- Regular remote backup of work
\- More granular code review capability

\### Session Management

\- \*\*End-of-session reminder\*\*: At the end of each working session, ask the user if they would like to push any changes to GitHub to keep the repository updated



\## Current Development Status

**Phase 2: Electron Conversion - IN PROGRESS**

\- Converting validated web prototype to Electron desktop application

\- Branch: `electron-conversion` (merges to `master` when complete)

\- Core features completed in web prototype (Phase 1):
  - ✅ 6x6 clip matrix with drag-and-drop video loading
  - ✅ Unlimited cue points per clip with draggable timeline markers
  - ✅ Tab system for multi-song organization
  - ✅ Session save/load functionality
  - ✅ Keyboard shortcuts system
  - ✅ Dual-screen output window
  - ✅ Per-clip speed control (0.1x-10x)
  - ✅ File browser with drag-and-drop
  - ✅ Clip management (move/remove)

\- Electron conversion tasks:
  - Setup Electron project structure (main.js, preload.js, package.json)
  - Migrate existing HTML/CSS/JS to Electron renderer process
  - Implement native MIDI integration via node-midi
  - Optimize for production performance (hardware acceleration, native file access)
  - Create distributable packages for Windows/Mac

\- \*\*Source material\*\*: Working with 1927 Metropolis film segments

\- \*\*Performance testing\*\*: Ensure smooth playback of vintage film formats and frame rates with native video acceleration



\## Metropolis Technical Considerations

\- \*\*Source format\*\*: 1080p MP4/MOV of restored Metropolis version

\- \*\*Video-only playback\*\*: No audio processing required (music comes from Ableton Live)

\- \*\*Large segment count\*\*: Architecture must handle "A LOT" of film segments efficiently

\- \*\*Memory optimization\*\*: Smart loading/unloading of segments for performance

\- \*\*Segment organization\*\*: Efficient categorization and retrieval of many film clips

\- \*\*Frame rate consistency\*\*: Ensure smooth playback regardless of film restoration frame rate

\- \*\*Visual quality\*\*: Maintain crisp 1080p output for projection/external displays



\### Audio Integration Notes  

\- \*\*No internal audio\*\*: App handles video-only, Ableton Live provides all music/sound

\- \*\*MIDI synchronization\*\*: Tight MIDI timing between drummer triggers and video cues

\- \*\*Silent video files\*\*: All loaded video segments should be audio-free for performance

\- \*\*External sync\*\*: Consider how app coordinates with Ableton Live timing (if needed)



\## UI Layout Specification



\### Main Interface Components (Based on Provided Mockup)



\*\*Left Panel - File Browser:\*\*

\- File list showing video files with file sizes

\- Drag-and-drop source for loading clips into matrix

\- Shows file types and sizes for reference



\*\*Top Section - Global Transport Controls:\*\*

\- 5 circular buttons in sequence:

&nbsp; 1. \*\*Previous Clip\*\* (skip to previous clip in matrix)

&nbsp; 2. \*\*Reverse Play\*\* (reverse playback)

&nbsp; 3. \*\*Pause\*\* (pause/play toggle)

&nbsp; 4. \*\*Forward Play\*\* (normal forward playback)  

&nbsp; 5. \*\*Next Clip\*\* (skip to next clip in matrix)



\*\*Center - Clips Matrix:\*\*

\- 6x6 grid (36 total clip slots) labeled "Clip 1" through "Clip 36"

\- Each slot can hold one video file with unlimited cue points

\- Visual indication of loaded vs empty slots

\- Click to select/activate individual clips



\*\*Bottom - Tab System:\*\*

\- 5 tabs shown: "Tab 1" through "Tab 5" 

\- Each tab represents a different song/performance page

\- Unlimited tabs possible for unlimited songs



\*\*Right Panel - Output Preview:\*\*

\- Large preview window showing current video output

\- This represents what gets sent to the external screen



\*\*Right Panel - Cue Point Controls:\*\*

\- \*\*Restart Clip\*\* (<<): Return to first cue point

\- \*\*Back 1 Cue Point\*\* (<): Step backward through cue points  

\- \*\*Forward 1 Cue Point\*\* (>): Step forward through cue points

\- \*\*Record Cue Point\*\* (circular button): Add new cue point at current position



\*\*Right Panel - "Shit It Up" Control:\*\*

\- Large circular dial labeled "Shit it up, baby!"

\- Range from 0 to "MotherFucker" 

\- \*\*Band in-joke\*\*: When something is too good, it needs to be "shit up"

\- \*\*Chaos mode\*\*: Completely disrupts interface and video output for comedic effect

\- Designed to be "dialed like a motherfucker" when things get too perfect



\### Metropolis-Specific Workflow

1\. \*\*Preparation\*\*: Load film segments into matrix slots, mark cue points at key scene transitions

2\. \*\*Performance\*\*: Drummer triggers scene advancement via MIDI, maintaining musical timing

3\. \*\*Tempo sync\*\*: Adjust individual scene speeds to match live musical performance

4\. \*\*Linear progression\*\*: Step through scenes sequentially, but at musically-driven pace

5\. \*\*Visual climax\*\*: "Shit it up" control for intense visual effects during musical peaks



\### Film Segment Organization

\- \*\*By act/movement\*\*: Different tabs for different parts of Metropolis story arc

\- \*\*By scene type\*\*: Action sequences, character moments, machinery scenes, etc.

\- \*\*By musical section\*\*: Organize clips to match band's song structure

\- \*\*Rhythmic scenes\*\*: Mark every beat/accent for tight drummer-visual sync



\### "Shit It Up" Control - Chaos Mode Effects

When the dial is turned up, progressively add visual/interface chaos:

\- \*\*Low levels (1-3)\*\*: Subtle visual glitches, slight interface jitter

\- \*\*Medium levels (4-6)\*\*: More pronounced effects, UI elements start moving/shaking

\- \*\*High levels (7-9)\*\*: Significant visual distortion, interface chaos, color shifts

\- \*\*Maximum "MotherFucker" level (10)\*\*: Complete visual mayhem - everything goes bonkers

\- \*\*Purpose\*\*: Comic relief during performance when things are going "too well"

\- \*\*Recovery\*\*: Dial back down to restore normal operation

\- \*\*Performance use\*\*: Strategic deployment for audience entertainment



\### Per-Clip Controls (Advanced Features)

\- \*\*Timeline Scrubber\*\*: 

&nbsp; - Drag to scrub through video in real-time

&nbsp; - Visual markers showing existing cue points on timeline

&nbsp; - \*\*Frame-by-frame precision\*\* for exact cue point placement

&nbsp; - Smooth real-time preview while scrubbing

\- \*\*Tempo Control\*\*: 

&nbsp; - Individual speed adjustment per clip (\*\*0.1x to 10x speed range\*\*)

&nbsp; - Maintains pitch/doesn't affect audio sync if video has audio track

&nbsp; - MIDI mappable for live tempo adjustments

\- \*\*Cue Point Markers\*\*:

&nbsp; - Visual indicators on scrubber timeline

&nbsp; - Click to jump directly to specific cue point

&nbsp; - Color-coded or numbered for quick reference

&nbsp; - \*\*Truly unlimited\*\* cue points per clip

&nbsp; - \*\*Auto-save\*\* - all cue points saved automatically as they're created



\### Session Management

\- \*\*Save/Load Sessions\*\*: Complete project state saved as session files

&nbsp; - All loaded videos and their file paths

&nbsp; - All cue points for every clip

&nbsp; - Tab organization and names

&nbsp; - Tempo settings for each clip

&nbsp; - MIDI mappings and keyboard shortcuts

&nbsp; - Last browsed folder location

\- \*\*Auto-load\*\*: \*\*Last used session file automatically loads on program startup\*\*

\- \*\*Session file format\*\*: Lightweight format for quick loading/saving

\- \*\*Backup system\*\*: Auto-backup sessions to prevent data loss during performance



\### File Management

\- \*\*Session Files\*\*: 

&nbsp; - Save entire project state including all tabs, clips, and cue points

&nbsp; - Quick save/load for different shows or performances

&nbsp; - Export/import capabilities for sharing setups

\- \*\*Auto-recovery\*\*: 

&nbsp; - Automatic session backup every few minutes during use

&nbsp; - Recovery prompt if application crashes or closes unexpectedly



\## Architecture Considerations

**Electron-Specific Architecture:**

\- **Main Process (main.js):**
  - Window management (main window + output window)
  - Native MIDI integration via node-midi
  - File system access without browser restrictions
  - IPC message routing between processes
  - Application lifecycle management

\- **Renderer Process (index.html + script.js):**
  - UI rendering and user interactions
  - Video playback and cue point management
  - Session state management
  - Communication with main process via IPC

\- **Preload Script (preload.js):**
  - Secure bridge between main and renderer
  - Exposes only necessary APIs to renderer
  - Protects against security vulnerabilities

**Performance Optimizations:**
\- Hardware video acceleration (native GPU access)
\- Direct file system access (no blob URLs)
\- Native video codecs for better performance
\- Lower latency MIDI processing
\- Efficient memory management for multiple videos

**Cross-Platform:**
\- Windows and Mac support via electron-builder
\- Distributable packages (.exe, .dmg, .app, etc.)
\- Consistent behavior across platforms

**Development Benefits:**
\- 90% code reuse from web prototype
\- Rapid iteration with hot reload (electron-reload)
\- Native debugging tools (Chrome DevTools)
\- Plugin architecture for future effects/features
\- Modular design for easy maintenance and updates



\## Future Considerations

\- Plugin system for video effects

\- Audio-reactive features

\- Show/setlist management

\- Configuration import/export for different performance setups

