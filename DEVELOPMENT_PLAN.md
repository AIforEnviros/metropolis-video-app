# Metropolis Video App - Development Plan

## Progress Tracker
- **Current Step:** Ready for Step 3 - Load Videos into Grid Slots
- **Completed Steps:** 2/16
- **Current Phase:** Foundation & Layout

---

## Current State ✅
- Basic video player with HTML interface
- JavaScript for video loading and playback
- Test video file (test-videos/test-video.mp4)
- Working play/pause buttons
- File input for custom videos
- Last commit: `Add basic working video player implementation`

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

### Step 3: Load Videos into Grid Slots ⏳
**Status:** Ready to Start
**What to build:**
- Modify "Load Test Video" to load into currently selected slot
- File input loads video into currently selected slot
- Visual indication when slot contains a video (different color/text)
- Empty slots remain clearly marked as empty

**Testing checklist:**
- [ ] Select slot 1, load test video → slot 1 shows it contains video
- [ ] Select slot 5, load different video → slot 5 shows it contains video
- [ ] Visual distinction between empty and loaded slots
- [ ] Can load videos into multiple different slots

**Commit message:** `Enable loading videos into selected grid slots`

**Must continue working:**
- Clip selection system
- Grid layout
- Video loading functionality

---

### Step 4: Add Global Transport Controls ⏸️
**Status:** Not Started
**What to build:**
- Add 5 circular transport buttons as specified:
  1. Previous Clip (skip to previous clip in matrix)
  2. Reverse Play (reverse playback - can be placeholder)
  3. Pause (pause/play toggle)
  4. Forward Play (normal forward playback)
  5. Next Clip (skip to next clip in matrix)
- Replace current simple play/pause with these controls

**Testing checklist:**
- [ ] Previous/Next buttons cycle through loaded clips
- [ ] Play button starts video of currently selected clip
- [ ] Pause button stops video
- [ ] All 5 buttons are clickable and responsive
- [ ] Auto-select next available clip when using Prev/Next

**Commit message:** `Add global transport controls with clip navigation`

**Must continue working:**
- Video loading into grid slots
- Clip selection
- Grid layout

---

## PHASE 2: CUE POINT SYSTEM

### Step 5: Add Basic Cue Point Storage ⏸️
**Status:** Not Started
**What to build:**
- Data structure to store cue points per clip
- Add "Record Cue Point" button in right panel
- Store current video time as cue point when button clicked
- Simple list display of cue points for current clip

**Testing checklist:**
- [ ] Load video, play partway, click "Record Cue Point"
- [ ] Cue point appears in list with timestamp
- [ ] Add multiple cue points to same video
- [ ] Switch clips and verify cue points are per-clip
- [ ] Cue points persist when switching between clips

**Commit message:** `Add basic cue point recording and storage`

**Must continue working:**
- Global transport controls
- Video loading into grid slots
- Clip selection

---

### Step 6: Add Cue Point Navigation ⏸️
**Status:** Not Started
**What to build:**
- Add cue point transport controls:
  - Restart Clip (<<): Jump to first cue point or beginning
  - Back 1 Cue Point (<): Previous cue point
  - Forward 1 Cue Point (>): Next cue point
- Navigation should jump video to exact cue point times

**Testing checklist:**
- [ ] Record multiple cue points in a video
- [ ] Use Forward button to jump between cue points
- [ ] Use Back button to go to previous cue points
- [ ] Restart button returns to first cue point or start
- [ ] Video time updates correctly when jumping

**Commit message:** `Add cue point navigation controls`

**Must continue working:**
- Cue point recording
- Global transport controls
- All previous functionality

---

### Step 7: Visual Cue Point Timeline ⏸️
**Status:** Not Started
**What to build:**
- Add timeline scrubber bar under video preview
- Show cue point markers on timeline as vertical lines or dots
- Click on timeline to scrub video to that position
- Drag scrubber handle to move through video

**Testing checklist:**
- [ ] Timeline shows video duration correctly
- [ ] Cue points appear as markers on timeline
- [ ] Click anywhere on timeline jumps video to that time
- [ ] Drag scrubber handle updates video position in real-time
- [ ] Multiple cue points display correctly on timeline

**Commit message:** `Add visual timeline with cue point markers`

**Must continue working:**
- Cue point navigation
- Cue point recording
- All transport controls

---

## PHASE 3: TABS & ORGANIZATION

### Step 8: Add Tab System ⏸️
**Status:** Not Started
**What to build:**
- Add tab bar at bottom with "Tab 1", "Tab 2", etc.
- Start with 5 tabs as specified
- Each tab has its own independent 6x6 grid
- Switching tabs preserves all loaded videos and cue points
- Visual indication of which tab is active

**Testing checklist:**
- [ ] Load videos into Tab 1 slots
- [ ] Switch to Tab 2, verify it's empty
- [ ] Load different videos into Tab 2
- [ ] Switch back to Tab 1, verify original videos still there
- [ ] All cue points preserved per tab
- [ ] Active tab clearly highlighted

**Commit message:** `Add tab system for multiple performance pages`

**Must continue working:**
- Visual timeline with cue points
- All cue point functionality
- Grid system
- Transport controls

---

### Step 9: Add File Browser Panel ⏸️
**Status:** Not Started

### Step 10: Add Drag and Drop from File Browser ⏸️
**Status:** Not Started

---

## PHASE 4: ADVANCED FEATURES

### Step 11: Add Speed/Tempo Control ⏸️
**Status:** Not Started

### Step 12: Add "Shit It Up" Control ⏸️
**Status:** Not Started

---

## PHASE 5: SESSION MANAGEMENT

### Step 13: Add Session Save/Load ⏸️
**Status:** Not Started

### Step 14: Add Keyboard Shortcuts ⏸️
**Status:** Not Started

---

## PHASE 6: OUTPUT & POLISH

### Step 15: Add Dual Screen Output ⏸️
**Status:** Not Started

### Step 16: Performance Optimization ⏸️
**Status:** Not Started

---

## Usage Instructions

When working on each step:

1. **Before starting:** Update step status to "In Progress ⏳"
2. **During development:** Check off testing checklist items as completed
3. **After completion:** Update status to "Completed ✅"
4. **After commit:** Update "Current Step" and "Completed Steps" count
5. **Move to next step:** Update next step status to "In Progress ⏳"

## Notes and Decisions

*Add any architectural decisions, gotchas, or notes discovered during development here*

---

**Last Updated:** Initial creation
**Next Step:** Start Step 1 - Add Basic Grid Layout