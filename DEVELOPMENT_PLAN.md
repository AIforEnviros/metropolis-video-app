# Metropolis Video App - Development Plan

## 🎯 Project Vision & Roadmap

### Phase 1: Web-Based Prototype (CURRENT)
**Goal:** Build and validate all features as a web application for rapid iteration and testing.

**Status:** 14/16 steps complete (87.5%)
- Testing core functionality with real-world use cases
- Validating UI/UX workflow for live performance
- Documenting requirements for native migration

### Phase 2: Native Application Migration (FUTURE)
**Goal:** Rebuild as Electron app for production-grade live performance reliability.

**When:** After web prototype is complete and validated through rehearsals/shows

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
- **Current Step:** Ready for Step 12 - "Shit It Up" Control (Final Feature)
- **Completed Steps:** 15/16 (94% complete)
- **Current Phase:** Final Feature & Polish

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
**Status:** Not Started

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

**Last Updated:** Step 4 completion - Ready for Step 5
**Next Step:** Step 5 - Add Basic Cue Point Storage (beginning Cue Point System phase)