\# Video Performance Application - Metropolis Live Remix

## 🚨 CRITICAL: Project Structure

**TWO SEPARATE IMPLEMENTATIONS EXIST:**

1. **HTML/JavaScript Version (ACTIVE DEVELOPMENT)**
   - Files: `index.html` + `script.js`
   - Current development target following the step-by-step plan
   - Serve with: `npx serve . --listen 3000` then open http://localhost:3000
   - Status: Step 4 completed (Global Transport Controls)
   - Next: Step 5 (Add Basic Cue Point Storage)

2. **React/TypeScript Version (ADVANCED PROTOTYPE)**
   - Files: `src/` directory with React components
   - Contains pre-built advanced features from Steps 5-12
   - Run with: `npm start` (serves on port 3000)
   - Status: Prototype with all components but not following development plan
   - DO NOT USE for step-by-step development

**IMPORTANT:** Always work on the HTML version unless specifically switching to React implementation.

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

\- Everything except individual cue points must be MIDI mappable

\- Comprehensive keyboard shortcuts for all functions

\- Real-time responsiveness for live performance



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



\### Session Management

\- \*\*End-of-session reminder\*\*: At the end of each working session, ask the user if they would like to push any changes to GitHub to keep the repository updated



\## Current Development Status

\- Initial planning and requirements gathering phase  

\- Need to create detailed UI mockup with numbered annotations

\- Core architecture planning for MIDI integration optimized for drummer control

\- Video playback engine selection and testing for 1927 film footage

\- \*\*Source material\*\*: Working with 1927 Metropolis film segments

\- \*\*Performance testing\*\*: Ensure smooth playback of vintage film formats and frame rates



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

\- Cross-platform compatibility (Windows/Mac for live performance setups)

\- Plugin architecture for future effects/features

\- Modular design for easy maintenance and updates

\- Efficient video decoding and rendering pipeline

\- Real-time video preview rendering for output window



\## Future Considerations

\- Plugin system for video effects

\- Audio-reactive features

\- Show/setlist management

\- Configuration import/export for different performance setups

