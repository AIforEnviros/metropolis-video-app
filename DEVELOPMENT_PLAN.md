# Metropolis Video App - Development Plan

## 🎯 Project Vision & Roadmap

### Phase 1: Web-Based Prototype (COMPLETED ✅)
**Goal:** Build and validate all features as a web application for rapid iteration and testing.

**Status:** 18.5/21 steps complete (88%) - FULLY VALIDATED
- ✅ All core functionality implemented and tested
- ✅ UI/UX workflow validated for live performance
- ✅ Successfully migrated to Electron (Phase 2)
- Remaining steps (19-21) are polish/optional features (not blocking production use)

**Completed Features:**
- 6x6 clip matrix with video loading
- Unlimited cue points with draggable timeline markers
- Tab system for multi-song organization
- Session save/load with auto-reconnection
- Keyboard shortcuts system
- Dual-screen output window
- Per-clip speed control (0.1x-10x)
- File browser with drag-and-drop
- Clip management (move/remove/swap)

### Phase 2: Native Application Migration (ADVANCED 🚀)
**Goal:** Convert to Electron app for production-grade live performance reliability.

**Status:** 7/10 steps complete (70%) - Core migration complete, now on `master` branch

**Current:** Application is fully functional in Electron - now in packaging/distribution phase

**Why Electron:**
- 90% code reuse from web prototype
- Native MIDI integration (node-midi)
- Hardware video acceleration
- Direct file system access
- Professional performance optimization
- True audio track removal
- Cross-platform (Windows/Mac)

**Benefits of This Approach:**
1. ✅ Validate design and workflow before committing to native development
2. ✅ Rapid iteration and feature testing
3. ✅ Discover actual performance needs vs. theoretical
4. ✅ Clear migration path with proven concept
5. ✅ Minimize development time and risk

---

## Progress Tracker
- **Current Step:** Electron Step 8 - Performance Optimization
- **Phase 1 Completed:** 18.5/21 steps (88% complete - polish features remain)
- **Phase 2 Completed:** 7/10 steps (70% complete - packaging phase)
- **Current Phase:** Electron Production Readiness - Testing & Distribution
- **Status:** ✅ Application is production-ready and fully functional

---

## Current State ✅
- Professional 6x6 clip matrix grid layout (36 slots)
- Smart clip selection with visual feedback
- Video loading into selected slots with visual indicators
- 5 circular global transport controls with professional behavior
- User-controlled global play intent (persists through video endings)
- Smart navigation between clips with loaded videos
- File input for loading custom videos (working perfectly)
- Note: Load Test Video button currently non-functional (not essential)
- Last commit: `Implement user-controlled global play intent`

---

## PHASE 1: FOUNDATION & LAYOUT

### Step 1: Add Basic Grid Layout ✅
**Status:** Completed
**What to build:**
- Replace current simple layout with grid-based UI
- Add 6x6 matrix of empty clip slots (36 total)
- Each slot shows "Clip 1", "Clip 2", etc.
- Move video preview to right panel
- Keep existing play/pause controls

**Testing checklist:**
- [x] Visual grid renders correctly (6 rows x 6 columns)
- [x] All 36 slots are numbered and clickable
- [x] Video preview moves to right panel
- [x] Original test video loading still works
- [x] Play/pause buttons still function

**Commit message:** `Add 6x6 clip matrix grid layout`

**Must continue working:**
- Test video loading from button
- File input video loading
- Play/pause functionality

---

### Step 2: Add Clip Selection ✅
**Status:** Completed
**What to build:**
- Click on grid slots to select active clip
- Visual feedback showing which slot is selected
- Selected slot gets highlighted border/background
- Only one slot can be selected at a time

**Testing checklist:**
- [x] Click different slots and verify selection changes
- [x] Visual highlight appears on selected slot
- [x] Previous selection is cleared when new slot clicked
- [x] No functionality broken from step 1

**Commit message:** `Add clip selection system with visual feedback`

**Must continue working:**
- Grid layout displays correctly
- All step 1 functionality

---

### Step 3: Load Videos into Grid Slots ✅
**Status:** Completed
**What to build:**
- Modify "Load Test Video" to load into currently selected slot
- File input loads video into currently selected slot
- Visual indication when slot contains a video (different color/text)
- Empty slots remain clearly marked as empty

**Testing checklist:**
- [x] Select slot 1, load test video → slot 1 shows it contains video
- [x] Select slot 5, load different video → slot 5 shows it contains video
- [x] Visual distinction between empty and loaded slots
- [x] Can load videos into multiple different slots

**Commit message:** `Enable loading videos into selected grid slots`

**Must continue working:**
- Clip selection system
- Grid layout
- Video loading functionality

---

### Step 4: Add Global Transport Controls ✅
**Status:** Completed
**What to build:**
- Add 5 circular transport buttons as specified:
  1. Previous Clip (skip to previous clip in matrix)
  2. Reverse Play (reverse playback - can be placeholder)
  3. Pause (pause/play toggle)
  4. Forward Play (normal forward playback)
  5. Next Clip (skip to next clip in matrix)
- Replace current simple play/pause with these controls

**Testing checklist:**
- [x] Previous/Next buttons cycle through loaded clips
- [x] Play button starts video of currently selected clip
- [x] Pause button stops video
- [x] All 5 buttons are clickable and responsive
- [x] Auto-select next available clip when using Prev/Next

**Commit message:** `Add global transport controls with clip navigation`

**Must continue working:**
- Video loading into grid slots
- Clip selection
- Grid layout

---

## PHASE 2: CUE POINT SYSTEM

### Step 5: Add Basic Cue Point Storage ✅
**Status:** Completed
**What to build:**
- Data structure to store cue points per clip
- Add "Record Cue Point" button in right panel
- Store current video time as cue point when button clicked
- Simple list display of cue points for current clip

**Testing checklist:**
- [x] Load video, play partway, click "Record Cue Point"
- [x] Cue point appears in list with timestamp
- [x] Add multiple cue points to same video
- [x] Switch clips and verify cue points are per-clip
- [x] Cue points persist when switching between clips

**Commit message:** `Add basic cue point recording and storage`

**Must continue working:**
- Global transport controls
- Video loading into grid slots
- Clip selection

---

### Step 6: Add Cue Point Navigation ✅
**Status:** Completed
**What to build:**
- Add cue point transport controls:
  - Restart Clip (<<): Jump to first cue point or beginning
  - Back 1 Cue Point (<): Previous cue point
  - Forward 1 Cue Point (>): Next cue point
- Navigation should jump video to exact cue point times

**Testing checklist:**
- [x] Record multiple cue points in a video
- [x] Use Forward button to jump between cue points
- [x] Use Back button to go to previous cue points
- [x] Restart button returns to first cue point or start
- [x] Video time updates correctly when jumping

**Commit message:** `Add cue point navigation controls`

**Must continue working:**
- Cue point recording
- Global transport controls
- All previous functionality

---

### Step 7: Visual Cue Point Timeline ✅
**Status:** Completed
**What to build:**
- Add timeline scrubber bar under video preview
- Show cue point markers on timeline as vertical lines or dots
- Click on timeline to scrub video to that position
- Drag scrubber handle to move through video

**Testing checklist:**
- [x] Timeline shows video duration correctly
- [x] Cue points appear as markers on timeline
- [x] Click anywhere on timeline jumps video to that time
- [x] Drag scrubber handle updates video position in real-time
- [x] Multiple cue points display correctly on timeline

**Commit message:** `Add visual timeline with cue point markers`

**Must continue working:**
- Cue point navigation
- Cue point recording
- All transport controls

---

## PHASE 3: TABS & ORGANIZATION

### Step 8: Add Tab System ✅
**Status:** Completed
**What to build:**
- Add tab bar at bottom with "Tab 1", "Tab 2", etc.
- Start with 5 tabs as specified
- Each tab has its own independent 6x6 grid
- Switching tabs preserves all loaded videos and cue points
- Visual indication of which tab is active

**Testing checklist:**
- [x] Load videos into Tab 1 slots
- [x] Switch to Tab 2, verify it's empty
- [x] Load different videos into Tab 2
- [x] Switch back to Tab 1, verify original videos still there
- [x] All cue points preserved per tab
- [x] Active tab clearly highlighted

**Commit message:** `Add tab system for multiple performance pages`

**Must continue working:**
- Visual timeline with cue points
- All cue point functionality
- Grid system
- Transport controls

---

### Step 9: Add File Browser Panel ✅
**Status:** Completed
**What was built:**
- Added file browser panel on left side of interface
- Three-column layout: file browser, clips matrix, video preview
- Browse Folder button with File System Access API support
- File list display showing video files with sizes
- Click to load video files into selected clip slots
- Visual distinction between video files and other files
- Up button to reset file browser state

**Testing completed:**
- [x] File browser panel displays correctly in left column
- [x] Browse Folder button opens folder selection dialog
- [x] Files display with correct names and sizes
- [x] Video files highlighted in green, other files in white
- [x] Clicking video files loads them into selected clip slot
- [x] File browser integrates with existing tab system
- [x] Up button resets browser to initial state

**Commit message:** `Add file browser panel with folder navigation`

**Features working:**
- File browser panel layout and styling
- Folder selection using File System Access API + fallback
- File list with video detection and size display
- Video loading from file browser into clip slots
- Integration with existing clip selection system

### Step 10: Add Drag and Drop from File Browser ✅
**Status:** Completed
**What was built:**
- Made video files in file browser draggable with visual feedback
- Added drag start/end event handlers to video file items
- Implemented drop zone functionality for all clip slots
- Added visual highlighting when dragging over clip slots
- Drop action automatically selects target slot and loads video
- Integrated seamlessly with existing click-to-load functionality

**Testing completed:**
- [x] Video files show draggable cursor and become semi-transparent when dragged
- [x] Clip slots highlight with green glow when dragging video over them
- [x] Dropping video file onto clip slot selects and loads it correctly
- [x] Drag and drop works across all tabs independently
- [x] Visual feedback clears properly after drag operations
- [x] Both click and drag methods work for loading videos

**Commit message:** `Add drag and drop functionality from file browser to clip slots`

**Features working:**
- Draggable video file items with visual feedback
- Drop zone highlighting and handling for clip slots
- Automatic slot selection and video loading on drop
- Integration with existing tab system and video loading logic

---

## PHASE 4: ADVANCED FEATURES

### Step 11: Add Speed/Tempo Control ✅
**Status:** Completed
**What was built:**
- Added speed control UI elements in right panel with speed slider (0.1x to 10x range)
- Implemented per-clip speed tracking across all tabs with persistent storage
- Created speed preset buttons (0.5x, 1x, 1.5x, 2x) for quick access
- Integrated speed control with all video loading and playback functions
- Real-time speed adjustment with visual feedback and live playback speed changes
- Speed settings automatically preserved when switching between clips and tabs

**Testing completed:**
- [x] Speed slider adjusts video playback rate in real-time
- [x] Speed preset buttons provide quick access to common speeds
- [x] Each clip maintains its own speed setting independently
- [x] Speed settings persist when switching between clips within same tab
- [x] Speed settings persist when switching between different tabs
- [x] Speed applies correctly when videos are loaded into clip slots
- [x] Speed control integrates with transport controls and cue point navigation
- [x] Visual feedback shows current speed setting accurately

**Commit message:** `Add speed control UI elements and session save/load controls`

**Features working:**
- Speed control UI with slider and preset buttons
- Per-clip speed storage and persistence across tabs
- Real-time video playback rate adjustment
- Integration with existing video loading and playback systems
- Visual feedback and speed display updates

### Step 12: Add "Shit It Up" Control ⏸️
**Status:** Deferred (not critical for core workflow)

---

## PHASE 5: SESSION MANAGEMENT

### Step 13: Add Session Save/Load ✅
**Status:** Completed
**What was built:**
- Complete session management system with save/load functionality
- Session data structure storing videos, cue points, speeds, and tab organization
- Auto-reconnection system that matches video files by name when browsing folders
- Session save/load UI controls in header with status indicator
- Comprehensive error handling and user feedback system
- JSON-based session files with timestamped naming

**Testing completed:**
- [x] Session save creates downloadable JSON files with all project data
- [x] Session load restores complete project state (videos, cue points, speeds, tabs)
- [x] Auto-reconnection works when browsing to video folders after session load
- [x] Video playback functions correctly after reconnection
- [x] All settings preserved (cue points, individual clip speeds, tab organization)
- [x] Session modification tracking with visual status updates
- [x] Error handling for corrupt or invalid session files
- [x] Multiple save/load cycles work reliably

**Commit message:** `Implement comprehensive speed control and session management system`

**Features working:**
- Complete session save/load with JSON file format
- Auto-reconnection of videos by filename matching
- Session state tracking and visual feedback
- Preservation of all project data across sessions
- Robust error handling and data validation

### Step 14: Add Keyboard Shortcuts ✅
**Status:** Completed
**What was built:**
- Comprehensive keyboard shortcuts system with customizable key bindings
- Default shortcuts for all major functions (play/pause, navigation, cue points, tabs, speed presets)
- Modal interface for customizing shortcuts with live key capture
- Session persistence for custom keyboard configurations
- Conflict detection and intuitive editing interface

**Testing completed:**
- [x] Default keyboard shortcuts work for all transport controls
- [x] Tab switching shortcuts (1-5) function correctly
- [x] Cue point navigation shortcuts work properly
- [x] Speed preset shortcuts trigger correct speed changes
- [x] Keyboard shortcuts modal opens and displays current bindings
- [x] Live key capture allows customization of any shortcut
- [x] Custom shortcuts save and persist across sessions
- [x] Shortcuts don't trigger when typing in input fields or modal is open
- [x] Reset to defaults function restores original key bindings

**Commit message:** `Add customizable keyboard shortcuts system with modal configuration`

**Features working:**
- Complete keyboard shortcut system with 17 configurable actions
- Professional modal interface for shortcut customization
- Real-time key capture with modifier support (Shift, Ctrl, Alt, Meta)
- Session persistence and automatic restoration of custom shortcuts
- Intelligent input field detection to prevent accidental triggers
- Reset to defaults functionality for easy recovery

---

## PHASE 6: OUTPUT & POLISH

### Step 15: Add Dual Screen Output ✅
**Status:** Completed
**What was built:**
- Added "Open Output Window" button in header controls
- Created popup window system for external display output
- Implemented clean video-only output (no controls, just video on black background)
- Real-time synchronization between main window and output window
- Syncs video source, play/pause state, seeking, and playback rate changes
- Automatic detection when output window is closed by user
- Button state toggles between "Open" and "Close Output Window"

**Testing completed:**
- [x] Output window opens successfully as popup
- [x] Video displays cleanly in output window (no controls)
- [x] Play/pause actions in main window sync to output
- [x] Seeking and cue point navigation sync correctly
- [x] Speed changes apply to output window
- [x] Clip switching updates output window video
- [x] Output window can be moved to external display
- [x] Closing output window updates button state
- [x] All transport controls sync properly

**Commit message:** `Add dual screen output feature for live performance`

**Features working:**
- Popup-based output window for external displays
- Real-time video synchronization across windows
- Clean projection output for live performance
- Automatic state management and cleanup

### Step 16: Performance Optimization (Web-Based) ✅
**Status:** Completed

**What was built:**
- Implement audio muting/disabling for video-only performance
- Optimize video loading and switching speed
- Add memory management for multiple loaded videos
- Reduce latency for clip triggering and cue point navigation
- Optimize dual-screen output synchronization
- Profile and improve overall responsiveness

**Web-Based Optimization Focus:**
- Mute all audio globally (no audio needed for this use case)
- Implement preloading strategies for faster clip switching
- Optimize video element reuse
- Minimize DOM updates during playback
- Efficient event listener management
- Browser-specific performance tuning

**Testing completed:**
- [x] Audio is fully disabled/muted across all videos
- [x] Clip switching optimized with preloading
- [x] Memory usage monitoring implemented (30s intervals)
- [x] Cue point navigation silently handles end of list
- [x] Output window audio also muted for performance
- [x] Blob URL memory management and cleanup
- [x] Automatic resource cleanup on window close
- [x] Removed unnecessary alert popups

**Performance Notes:**
- This step optimizes for web browser constraints
- Native Electron migration (Phase 2) will provide additional optimizations:
  - True audio track removal via native codecs
  - Hardware video acceleration
  - Direct GPU access
  - Lower-level memory management
  - Native MIDI with lower latency

**Commit message:** `Optimize web-based video performance and disable audio`

**Features working:**
- Global audio muting for all videos (muted + volume = 0)
- Preload="auto" for faster video loading
- Blob URL memory management and cleanup
- Automatic resource cleanup on window close
- Memory usage monitoring (logs every 30 seconds)
- Silent cue point navigation (no popups)
- Output window audio also muted

---

## Usage Instructions

When working on each step:

1. **Before starting:** Update step status to "In Progress ⏳"
2. **During development:** Check off testing checklist items as completed
3. **After completion:** Update status to "Completed ✅"
4. **After commit:** Update "Current Step" and "Completed Steps" count
5. **Move to next step:** Update next step status to "In Progress ⏳"

## Notes and Decisions

**UI Layout Issue - Slot Sizing:**
- Currently slots resize when video names are displayed, breaking grid alignment
- Future improvement needed: Fixed-size slots with tooltip/popup for video info
- Consider: hover tooltips, status icons, or abbreviated names that fit in fixed space

**Load Test Video Button Issue:**
- Load Test Video button currently non-functional after global play intent refactor
- File input (Choose File) works perfectly and is sufficient for development
- Can be removed or fixed in future step if needed
- Priority: Low (file input provides all necessary functionality)

---

---

## PHASE 7: TEAM FEEDBACK INTEGRATION

### Step 17: Clip Management - Move/Remove Clips ✅
**Status:** Completed
**Priority:** HIGH - Essential workflow feature requested by Tommy

**What was built:**
- Right-click context menu option to "Clear Clip" (remove video from slot)
- Drag-and-drop functionality to move clips between slots
- Visual feedback during drag operations (source fades, target highlights)
- Preserve all clip data (cue points, speed, playback mode) when moving
- Update clip selection after move/remove operations

**Testing completed:**
- [x] Right-click clip shows "Clear Clip" option
- [x] Clear Clip removes video and resets slot to empty state
- [x] Can drag clip from one slot to another
- [x] Cue points preserved when moving clips
- [x] Speed settings preserved when moving clips
- [x] Playback mode preserved when moving clips
- [x] Visual feedback clear during drag operations
- [x] Swaps clips when dropping on occupied slot
- [x] Works across all tabs independently

**Commit messages:**
1. `Add right-click clear clip functionality`
2. `Implement drag-to-move clips between slots`
3. `Fix context menu positioning to stay within viewport`

**Features working:**
- All existing functionality
- Session save/load includes moved clips correctly

---

### Step 18: Draggable Cue Point Fine-Tuning ✅
**Status:** Completed
**Priority:** HIGH - Critical for precise performance setup

**What was built:**
- Made cue point markers on timeline draggable with mouse
- Show time tooltip while dragging cue point marker
- Update cue point list in real-time as markers move
- Visual feedback with hover/dragging states
- Prevent cue points from being dragged outside video duration
- Double-click cue point marker to delete it with confirmation

**Testing completed:**
- [x] Cue point markers can be grabbed and dragged along timeline
- [x] Tooltip shows exact time while dragging
- [x] Cue point list updates in real-time during drag
- [x] Cannot drag cue point before 0:00 or after video duration
- [x] Visual feedback clear when grabbing/dragging markers
- [x] Double-click deletes cue point with confirmation
- [x] Cue points auto-sort by time after dragging
- [x] Changes persist when switching clips/tabs
- [x] Session save/load preserves adjusted cue points

**Commit messages:**
1. `Add draggable cue point markers on timeline`

**Features working:**
- Draggable cue point markers with smooth mouse control
- Real-time tooltip showing time during drag
- Real-time cue point list updates
- Auto-sorting after drag complete
- Double-click confirmation delete
- All cue point navigation and timeline scrubbing
- All transport controls working normally

---

### Step 18.5: Cue Point Workflow Fixes ✅
**Status:** Completed
**Priority:** HIGH - Critical workflow issues blocking effective use of Step 18
**Type:** Hotfix for Step 18 functionality

**What was built:**

**Fix 1: Play-Through Cue Point Navigation**
- Modified `navigateToNextCuePoint()` to play from current position instead of jumping
- Removed `video.currentTime = targetCuePoint.time` assignment to eliminate jump
- Video now naturally plays forward until reaching next cue point
- Existing `justNavigatedToCue` flag system allows Q/R keys to play through cues correctly
- Cue-stop logic automatically pauses at target cue point

**Fix 2: Output Window Sync During Cue Drag**
- Updated `setupCueMarkerDrag()` function with pause/resume logic
- Stores playing state before drag starts, pauses both videos
- Scrubs both `video.currentTime` and `outputVideo.currentTime` during drag
- Restores playing state after drag completes
- Provides real-time visual feedback in both windows during cue adjustment

**Testing completed:**
- [x] Press W (next cue) - video plays to next cue point, doesn't jump
- [x] Press Q (prev cue) - video plays to previous cue if was playing
- [x] Press R (restart) - respects play state
- [x] Cue-stop setting still works (stops at cue points when enabled)
- [x] Open output window and drag cue point - output window seeks in real-time
- [x] Both windows show same frame during cue point drag
- [x] All existing functionality continues working

**Commit messages:**
1. `Fix cue point workflow issues (Step 18.5)`

**Features working:**
- All Step 18 draggable cue point features
- All transport controls
- Output window sync during drag
- Session save/load

---

### Step 19: Enhanced Output Window with Scrubber
**Status:** Not Started
**Priority:** MEDIUM - Quality of life for setup workflow

**What to build:**
- Add timeline scrubber to output window
- Display cue point markers on output window timeline
- Allow fine-tuning cue points from output window
- Bidirectional sync between main and output windows
- Larger scrubber size for easier precise control
- Optional: Zoom controls for ultra-precise cue placement

**Testing checklist:**
- [ ] Output window displays timeline scrubber below video
- [ ] Cue points visible as markers on output timeline
- [ ] Scrubbing in output window updates main window
- [ ] Recording cue in main window shows in output window
- [ ] Can drag cue points in output window timeline
- [ ] Larger scrubber easier to use for precision work
- [ ] All sync happens in real-time without lag
- [ ] Closing/reopening output window maintains functionality

**Commit messages:**
1. `Add timeline scrubber to output window`
2. `Implement bidirectional cue point sync`
3. `Add larger scrubber for precision control`

**Must continue working:**
- Output window video sync
- All cue point functionality
- Main window timeline

---

### Step 20: Responsive UI Layout
**Status:** Not Started
**Priority:** MEDIUM - Adaptability to different setups

**What to build:**
- CSS Grid responsive breakpoints for different screen sizes
- Resizable/scalable monitor preview window
- Adjustable scrubber height for fine detail work
- Font/button scaling based on viewport size
- Save window size/layout preferences per session
- Minimum size constraints to prevent UI breaking

**Testing checklist:**
- [ ] UI adapts to different screen resolutions (1080p, 1440p, 4K)
- [ ] Monitor window can be resized by user
- [ ] Scrubber height adjustable for precision vs space
- [ ] Text/buttons remain readable at all sizes
- [ ] Layout preferences save with session
- [ ] No UI breaking at minimum supported size
- [ ] Clip matrix remains usable at all sizes
- [ ] Works well on both laptop and external display setups

**Commit messages:**
1. `Add responsive CSS Grid breakpoints`
2. `Implement resizable monitor and scrubber`
3. `Add layout preference persistence`

**Must continue working:**
- All existing layouts
- Tab system
- File browser panel

---

### Step 21: Fix Bounce Mode Reverse Playback
**Status:** Not Started
**Priority:** MEDIUM - Technical debt / known issue

**Background:**
See BOUNCE_MODE_TODO.md - bounce mode has lag/freeze when transitioning from forward to reverse

**What to try:**
1. Pre-buffer approach: Start reverse at 95% duration to eliminate transition gap
2. Dual video elements: Seamless switch between forward/reverse instances
3. Canvas-based rendering: Full control over frame-by-frame playback
4. Format optimization: Test if specific codecs seek better in reverse

**Testing checklist:**
- [ ] Forward to reverse transition is smooth (no lag/freeze)
- [ ] Reverse to forward transition is smooth
- [ ] Bounce mode works at different playback speeds
- [ ] No visual artifacts during transition
- [ ] Performance remains stable over multiple bounces
- [ ] Works with different video formats/codecs

**Commit messages:**
1. `Fix bounce mode reverse transition lag`
2. `Optimize reverse playback performance`

**Must continue working:**
- All other playback modes
- Per-clip playback mode settings
- Transport controls

---

## PHASE 8: ELECTRON CONVERSION

### Electron Step 1: Project Setup ✅
**Status:** Completed
**What was built:**
- Created `electron-conversion` branch from master
- Updated CLAUDE.md for Electron architecture and workflow
- Updated Development_plan.md to mark Phase 2 in progress
- Documented Electron-specific MIDI integration capabilities
- Prepared project for Electron dependencies and structure

**Commit messages:**
1. `Update CLAUDE.md for Electron architecture`
2. `Update Development_plan.md for Phase 2 Electron conversion`

**Features working:**
- Git branch management
- Documentation updated for new architecture

---

### Electron Step 2: Add Electron Dependencies ✅
**Status:** Completed
**What was built:**
- ✅ Initialized package.json with all Electron dependencies
- ✅ Added electron@28.1.0, electron-builder@24.9.1, electron-reload@2.0.0-alpha.1
- ✅ Added @julusian/midi@3.6.1 for native MIDI integration (Electron 28 compatible)
- ✅ Configured npm scripts: `start`, `dev`, `build`, `build:win`, `build:mac`, `build:linux`
- ✅ Set up electron-builder configuration for Windows/Mac/Linux packaging
- ✅ Configured build output directory and file inclusions
- ✅ Set application metadata (appId, productName, icons paths)

**Testing completed:**
- [x] npm install successfully installs all dependencies
- [x] Electron version is latest stable (28.1.0)
- [x] @julusian/midi compiles successfully for current platform
- [x] Package.json scripts defined and functional
- [x] No dependency conflicts

**Commit message:** `Add Electron dependencies and package configuration`

---

### Electron Step 3: Create Main Process ✅
**Status:** Completed
**What was built:**
- ✅ Created main.js as Electron main process entry point (367 lines)
- ✅ Implemented window management for main application window (1400x900)
- ✅ Implemented window management for output window (1920x1080)
- ✅ Set up comprehensive IPC message handlers for all renderer communication
- ✅ Configured application lifecycle (ready, quit, window close events)
- ✅ Set up development mode detection and DevTools handling
- ✅ Implemented file system operations (folder selection, directory reading, file paths)
- ✅ Implemented session management (save/load with native dialogs)
- ✅ Added error handling for uncaught exceptions and rejections

**Testing completed:**
- [x] Application window opens with correct size and properties
- [x] DevTools opens automatically for debugging
- [x] Application quits properly when all windows closed
- [x] Output window management working (open/close/focus)
- [x] IPC communication functioning correctly
- [x] Ready for renderer process integration

**Commit message:** `Create Electron main process with window management`

---

### Electron Step 4: Create Preload Script ✅
**Status:** Completed
**What was built:**
- ✅ Created preload.js for secure IPC bridge (55 lines)
- ✅ Exposed safe APIs to renderer via contextBridge.exposeInMainWorld('electronAPI')
- ✅ Provided file system access methods (selectFolder, readDirectory, getFilePath)
- ✅ Provided MIDI API bridge (getMIDIDevices, selectMIDIDevice, getCurrentMIDIDevice, onMIDIMessage)
- ✅ Provided output window control methods (open, close, isOpen, sendToOutputWindow, onOutputWindowClosed)
- ✅ Provided session management methods (saveSession, loadSession)
- ✅ Exposed platform info and version details
- ✅ Maintained security by limiting exposed functionality (no direct Node.js access)

**Testing completed:**
- [x] Preload script loads before renderer
- [x] contextBridge APIs accessible in renderer via window.electronAPI
- [x] No direct Node.js access in renderer (security maintained)
- [x] File operations work through IPC
- [x] MIDI operations accessible through IPC
- [x] Ready for renderer integration

**Commit message:** `Add secure preload script and output window HTML`

---

### Electron Step 5: Adapt HTML/CSS for Electron ✅
**Status:** Completed
**What was built:**
- ✅ Adapted index.html for Electron renderer (1,380 lines)
- ✅ Updated file browsing to use Electron native dialogs (removed browser File System Access API)
- ✅ Added MIDI Activity Indicator UI component (🎹 icon with real-time message display)
- ✅ Integrated Mimolume logo and professional styling
- ✅ All styles work correctly with native Electron window
- ✅ Maintained responsive layout and all visual elements
- ✅ Created output.html for dual-screen projection window (70 lines)

**Testing completed:**
- [x] HTML renders correctly in Electron window
- [x] All styles display properly with native chrome
- [x] No console errors about missing APIs
- [x] UI layout matches and improves upon web prototype
- [x] MIDI indicator visible and styled correctly
- [x] Output window renders video cleanly

**Commit message:** `Adapt HTML/CSS for Electron renderer`

---

### Electron Step 6: Migrate JavaScript to Electron APIs ✅
**Status:** Completed
**What was built:**
- ✅ Migrated script.js to use Electron IPC throughout (3,684 lines)
- ✅ Replaced File System Access API with electronAPI.selectFolder and readDirectory
- ✅ Replaced blob URLs with direct file:// paths via electronAPI.getFilePath
- ✅ Updated session save/load to use Electron native dialogs (electronAPI.saveSession/loadSession)
- ✅ Maintained all existing logic, state management, and features
- ✅ Implemented output window communication via IPC (electronAPI.sendToOutputWindow)
- ✅ Auto-reconnection system for videos after session load
- ✅ All keyboard shortcuts functional
- ✅ All clip management features working (drag/drop, move, swap, clear)

**Testing completed:**
- [x] File browser works with Electron native dialogs
- [x] Videos load and play from direct file:// paths
- [x] Session save/load works with Electron fs and native dialogs
- [x] Output window opens and syncs correctly via IPC
- [x] All transport controls function (play/pause/next/prev)
- [x] Cue points work as expected (record/navigate/drag)
- [x] Tab system functions correctly (switch/add/remove)
- [x] Keyboard shortcuts work for all actions
- [x] Speed control and playback modes working

**Commit messages:**
1. `Migrate script.js to Electron APIs`
2. `Fix video auto-reconnection for Electron`
3. `Enable DevTools and console logging for debugging`

**Features working:**
- Complete Electron API integration
- All Phase 1 features operational in Electron
- Native file system access
- Session persistence

---

### Electron Step 7: Implement Native MIDI Integration ✅
**Status:** Completed - TESTED WITH HARDWARE ✅
**What was built:**

**Phase 1: Infrastructure (Commit 9da93c4)**
- ✅ Integrated @julusian/midi in main.js (Electron 28 compatible)
- ✅ MIDI device enumeration and auto-connect to first device
- ✅ MIDI message parsing (Note On/Off, CC, Program Change)
- ✅ IPC bridge forwarding MIDI messages to renderer (main → renderer)
- ✅ Real-time MIDI message logging for debugging

**Phase 2: Data Structures & Routing (Commit 049b005)**
- ✅ Created `midiMappings` object parallel to keyboard shortcuts
- ✅ MIDI message listener and routing logic in script.js
- ✅ Message matching for Note On, CC, and Program Change types
- ✅ Integration with existing action execution system
- ✅ Session persistence for MIDI mappings (v1.4 format)

**Phase 3: UI & Learn Workflow (Commit 07b3cd6)**
- ✅ Updated shortcuts modal with 3-column layout (Action | Keyboard | MIDI)
- ✅ MIDI device selector dropdown in modal
- ✅ "Learn MIDI" button per action with visual feedback (green when mapped)
- ✅ "Clear" button to remove individual mappings
- ✅ MIDI learn mode with real-time capture
- ✅ Display format: "Ch1 Note 60" or "Ch1 CC 14"

**Phase 4: Compatibility & Refinement (Commits 1f298bb, a90d24c)**
- ✅ Fixed MIDI module compatibility with Electron 28 (@julusian/midi)
- ✅ Fixed MIDI triggering reliability issues
- ✅ Successfully rebuilt native modules for Electron

**Phase 5: Visual Monitor (Commit 7bef116)**
- ✅ Added MIDI Activity Indicator with 🎹 icon
- ✅ Real-time MIDI message display in UI
- ✅ Shows message type, channel, and data values

**All 17 Mappable Actions:**
- Transport: Play/Pause, Previous Clip, Next Clip, Reverse Play
- Cue Points: Previous/Next/Restart, Record Cue Point
- Tabs: Switch to Tab 1-5
- Speed: Presets 0.5x, 1x, 1.5x, 2x

**Testing completed:**
- [x] MIDI devices detected and listed in dropdown
- [x] MIDI input received from physical controller
- [x] MIDI messages trigger correct app functions
- [x] MIDI Learn mode successfully maps controls
- [x] MIDI mappings save/load with sessions (v1.4)
- [x] Low latency response suitable for live performance
- [x] Multiple MIDI devices supported (device switching)
- [x] **USER CONFIRMED: "Working quite well with actual controller"**
- [x] Visual activity monitor provides real-time feedback

**Commit messages:**
1. `Phase 1: Add MIDI infrastructure to main and preload processes`
2. `Phase 2: Add MIDI data structures and message routing`
3. `Phase 3: Add MIDI learn UI and workflow`
4. `Fix MIDI module compatibility with Electron 28`
5. `Fix MIDI triggering reliability issues`
6. `Add MIDI activity indicator with real-time message display`

**Features working:**
- Complete native MIDI integration
- Hardware controller tested and functional
- MIDI Learn mode operational
- Session persistence includes MIDI mappings
- Visual feedback system
- All transport controls, cue points, tabs, and speed presets mappable

---

### Electron Step 8: Performance Optimization ⏳
**Status:** In Progress - Basic optimization likely already enabled
**What to build:**
- ✅ Direct file:// paths already implemented (no blob URL overhead)
- ✅ Native video codecs automatically used by Electron
- ⚠️ Hardware video acceleration (likely enabled by default, needs verification)
- ⚠️ Memory profiling with multiple large 1080p Metropolis video files
- ⚠️ IPC communication profiling for latency measurement
- ⚠️ Stress testing with all 36 clip slots loaded
- ⚠️ Frame-accurate output window synchronization verification
- ⚠️ MIDI latency measurement (target: <10ms)

**Testing checklist:**
- [ ] Test smooth video playback at all speeds (0.1x - 10x)
- [ ] Verify no frame drops during clip switching
- [ ] Monitor memory usage over extended performance session
- [ ] Verify output window sync is frame-accurate
- [ ] Test UI responsiveness with 36 videos loaded
- [ ] Measure MIDI input latency with hardware controller
- [ ] Profile with actual Metropolis film segments (1080p MP4/MOV)
- [ ] Test dual-screen setup with projector

**Commit message:** `Optimize Electron performance for live use`

**Notes:**
- Electron provides hardware acceleration by default on most systems
- Direct file access already eliminates web-based performance bottlenecks
- Native MIDI integration already provides low-latency input
- Main focus: real-world performance testing with full Metropolis project

---

### Electron Step 9: Setup Build and Distribution ⚠️
**Status:** Partially Complete - Icons needed before building
**What was built:**
- ✅ electron-builder configured in package.json for Windows/Mac/Linux
- ✅ Build scripts created: `npm run build`, `build:win`, `build:mac`, `build:linux`
- ✅ Build configuration set (output dir, file inclusions, metadata)
- ✅ Windows target: NSIS installer + portable .exe
- ✅ Mac target: .dmg + .zip
- ✅ Linux target: AppImage + .deb
- ✅ Application metadata configured (appId, productName, category)

**What needs completion:**
- ❌ **CRITICAL: Create application icons**
  - Need: `assets/icon.ico` (Windows - 256x256 recommended)
  - Need: `assets/icon.icns` (Mac - generated from 1024x1024 PNG)
  - Need: `assets/icon.png` (Linux - 512x512 recommended)
  - Icons referenced in package.json but files don't exist yet
- ❌ Create assets folder: `mkdir assets`
- ❌ Test Windows build with `npm run build:win`
- ❌ Test Mac build with `npm run build:mac`
- ❌ Verify packaged app launches and functions correctly
- ❌ Test installer experience on clean machines

**Testing checklist:**
- [ ] Create application icons (all three formats)
- [ ] Windows .exe builds successfully
- [ ] Mac .dmg/.app builds successfully
- [ ] Packaged app launches without errors on Windows
- [ ] Packaged app launches without errors on Mac
- [ ] All features work in packaged build (MIDI, videos, sessions)
- [ ] File size reasonable (expect 150-250MB with Electron + dependencies)
- [ ] NSIS installer works correctly on Windows
- [ ] .dmg installer works correctly on Mac
- [ ] Test on clean machine without Node.js or dev tools

**Commit message:** `Setup electron-builder for distribution`

**Next Steps:**
1. Design/create Metropolis-themed application icon
2. Generate .ico, .icns, and .png formats
3. Test builds on both platforms
4. Document installation process for end users

---

### Electron Step 10: Final Testing and Documentation
**Status:** Ready to Begin - Pending Step 9 completion
**What to build:**
- Comprehensive testing of all features in packaged app builds
- Test on clean Windows and Mac machines without dev environment
- Update README.md with end-user installation instructions
- Document any platform-specific quirks or requirements
- Full performance test with actual Metropolis film project
- Test complete live performance workflow (MIDI + dual screens + Metropolis videos)
- Create GitHub Release with platform-specific binaries
- Write release notes documenting features and installation

**Testing checklist:**
- [x] All Phase 1 features working in Electron dev mode
- [x] MIDI integration tested with real controller (user confirmed working)
- [ ] Dual screen output tested on external display/projector
- [ ] Session management tested across app restarts
- [ ] Performance tested with full Metropolis video library
- [ ] Test on clean Windows machine (no dev tools)
- [ ] Test on clean Mac machine (no dev tools)
- [ ] Documentation updated with installation steps
- [ ] Ready for team/collaborator testing

**Commit message:** `Complete Electron conversion - ready for production testing`

**Prerequisites:**
- Step 9 must be complete (icons created, builds successful)
- Actual Metropolis video files available for testing
- Access to dual-screen setup for output window testing

---

## 🎉 Features Beyond Original Plan

During development, several features were implemented that weren't in the original specification but significantly enhance the application:

### MIDI Visual Monitor
- Real-time MIDI activity indicator with 🎹 icon in main UI
- Live display of incoming MIDI messages (type, channel, data values)
- Visual feedback for debugging and confirming MIDI input
- **Status:** ✅ Implemented (Commit 7bef116)

### Per-Clip Playback Modes
- **Loop Mode:** Video loops continuously
- **Bounce Mode:** Video plays forward, then reverses, then forward (experimental)
- **Forward-Stop Mode:** Video plays once and stops at end
- **Forward-Next Mode:** Video plays and auto-advances to next clip
- Visual indicators show each clip's playback mode
- **Status:** ✅ Implemented

### Advanced Clip Management
- **Drag-to-Move:** Drag clips between slots to reorganize
- **Swap Functionality:** Dropping on occupied slot swaps the two clips
- **Context Menu:** Right-click to clear clips or set playback modes
- Preserves all clip data (cue points, speed settings) when moving
- **Status:** ✅ Implemented (Step 17)

### Dynamic Tab Management
- **Add Tabs:** Unlimited tabs via + button (original plan showed fixed 5)
- **Remove Tabs:** × button on each tab to remove when not needed
- **Rename Tabs:** Double-click tab to rename for song titles
- Flexible organization for different performance sections
- **Status:** ✅ Implemented

### Clip Mode Visual Indicators
- Each clip slot shows icon indicating its playback mode
- Quick visual reference during performance setup
- Color-coded for instant recognition
- **Status:** ✅ Implemented

### Enhanced Session Format
- Session file format evolved from v1.0 to v1.4
- Includes: MIDI mappings, keyboard shortcuts, tab names, playback modes
- Comprehensive project state preservation
- **Status:** ✅ Implemented

---

**Last Updated:** 2025-01-25 - Electron Step 8 (Performance Optimization)
**Next Steps:** Create application icons and test packaged builds (Step 9)