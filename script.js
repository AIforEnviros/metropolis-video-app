document.addEventListener('DOMContentLoaded', function() {
    // CRITICAL: Check if Electron API is available
    if (!window.electronAPI) {
        console.error('FATAL ERROR: electronAPI is not available!');
        console.error('This means the preload script did not load correctly.');
        console.error('Check that main.js is loading preload.js correctly.');
        alert('Fatal Error: Electron API not available. Please check the console for details.');
        return; // Stop execution
    }
    console.log('✓ Electron API is available');
    console.log('Available methods:', Object.keys(window.electronAPI));

    const video = document.getElementById('videoPlayer');
    const videoReverse = document.getElementById('videoPlayerReverse'); // Reverse video for bounce mode
    const prevClipBtn = document.getElementById('prevClipBtn');
    const nextClipBtn = document.getElementById('nextClipBtn');

    const clipsMatrix = document.getElementById('clipsMatrix');
    const recordCuePointBtn = document.getElementById('recordCuePointBtn');
    // const cuePointsList = document.getElementById('cuePointsList'); // REMOVED - list UI removed, cue points visible on timeline
    const restartClipBtn = document.getElementById('restartClipBtn');
    const prevCuePointBtn = document.getElementById('prevCuePointBtn');
    const nextCuePointBtn = document.getElementById('nextCuePointBtn');
    const setInPointBtn = document.getElementById('setInPointBtn');
    const setOutPointBtn = document.getElementById('setOutPointBtn');
    const clearInOutBtn = document.getElementById('clearInOutBtn');
    const timelineTrack = document.getElementById('timelineTrack');
    const timelineProgress = document.getElementById('timelineProgress');
    const timelineHandle = document.getElementById('timelineHandle');
    const cueMarkers = document.getElementById('cueMarkers');
    const inOutMarkers = document.getElementById('inOutMarkers');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalDurationDisplay = document.getElementById('totalDuration');
    const tabBar = document.getElementById('tabBar');
    // File browser elements removed - drag videos from OS file explorer instead
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const speedPresetBtns = document.querySelectorAll('.speed-preset-btn');
    const saveSessionBtn = document.getElementById('saveSessionBtn');
    const loadSessionBtn = document.getElementById('loadSessionBtn');
    const sessionStatus = document.getElementById('sessionStatus');
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const closeShortcutsModal = document.getElementById('closeShortcutsModal');
    const shortcutsGrid = document.getElementById('shortcutsGrid');
    const resetShortcutsBtn = document.getElementById('resetShortcutsBtn');
    const saveShortcutsBtn = document.getElementById('saveShortcutsBtn');
    const outputWindowBtn = document.getElementById('outputWindowBtn');
    const addTabBtn = document.getElementById('addTabBtn');
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    const clipContextMenu = document.getElementById('clipContextMenu');

    // Output window reference - state tracked by outputWindowOpen variable below

    // Performance optimizations - disable audio globally
    video.muted = true;
    video.volume = 0;
    videoReverse.muted = true;
    videoReverse.volume = 0;

    // Preload hint for faster loading
    video.preload = 'auto';
    videoReverse.preload = 'auto';

    // Track global play intent (user's desired state)
    let globalPlayIntent = false; // true = user wants playing, false = user wants paused

    // Track current video playing state (actual video state)
    let currentVideoPlaying = false;

    // Global auto-play enabled (affects all clips)
    let globalAutoPlayEnabled = true; // true = clips auto-play, false = clips stay paused

    // Track the currently selected clip
    let selectedClipSlot = null;

    // Timeline zoom level (1x, 2x, 4x, 8x)
    let timelineZoomLevel = 1;

    // Timeline smooth animation frame ID for 60fps updates
    let timelineAnimationFrame = null;

    // Track which tab is currently active
    let currentTab = 0;

    // Track all tabs (array of tab indices)
    let allTabs = [0, 1, 2, 3, 4];
    let nextTabIndex = 5; // Next available tab index

    // Track videos loaded into each slot for each tab (tabIndex -> { clipNumber -> video data })
    const tabClipVideos = {};

    // Track reversed video paths for bounce mode (tabIndex -> { clipNumber -> reversed video path })
    const tabClipReversedVideos = {};

    // Track cue points for each clip for each tab (tabIndex -> { clipNumber -> array of cue point objects })
    const tabClipCuePoints = {};

    // Track speed settings for each clip for each tab (tabIndex -> { clipNumber -> speed value })
    const tabClipSpeeds = {};

    // Track custom clip names for each tab (tabIndex -> { clipNumber -> custom name })
    const tabClipNames = {};

    // Track custom tab names (tabIndex -> custom tab name)
    const tabCustomNames = {};

    // Track playback modes for each clip (tabIndex -> { clipNumber -> mode })
    // Modes: 'forward', 'loop', 'forward-stop', 'forward-next', 'bounce'
    const tabClipModes = {};

    // Track current cue index for sequential navigation (tabIndex -> { clipNumber -> index })
    const tabClipCurrentCueIndex = {};

    // Track In/Out points for each clip (tabIndex -> { clipNumber -> { inPoint: time, outPoint: time } })
    const tabClipInOutPoints = {};

    // Initialize tab data structures for default 5 tabs
    for (let i = 0; i < 5; i++) {
        tabClipVideos[i] = {};
        tabClipReversedVideos[i] = {};
        tabClipCuePoints[i] = {};
        tabClipSpeeds[i] = {};
        tabClipNames[i] = {};
        tabClipModes[i] = {};
        tabClipCurrentCueIndex[i] = {};
        tabClipInOutPoints[i] = {};
    }

    // Legacy references for current tab's data (for compatibility)
    let clipVideos = tabClipVideos[currentTab];
    let clipReversedVideos = tabClipReversedVideos[currentTab];
    let clipCuePoints = tabClipCuePoints[currentTab];
    let clipSpeeds = tabClipSpeeds[currentTab];
    let clipNames = tabClipNames[currentTab];
    let clipModes = tabClipModes[currentTab];
    let clipCurrentCueIndex = tabClipCurrentCueIndex[currentTab];
    let clipInOutPoints = tabClipInOutPoints[currentTab];

    // File browser state
    let currentFolderPath = '';
    let currentFolderFiles = [];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];

    // Session management state
    let currentSessionName = null;
    let sessionModified = false;

    // Keyboard shortcuts configuration
    let keyboardShortcuts = {
        'previousClip': 'ArrowLeft',
        'nextClip': 'ArrowRight',
        'previousCuePoint': 'q',
        'nextCuePoint': 'w',
        'restartClip': 'r',
        'recordCuePoint': 'c',
        'setInPoint': 'i',
        'setOutPoint': 'o',
        'clearInOut': 'Shift+x',
        'zoomIn': '=',
        'zoomOut': '-',
        'pausePlay': 'Space',
        'tab1': '1',
        'tab2': '2',
        'tab3': '3',
        'tab4': '4',
        'tab5': '5',
        'speedPreset0.5': 'Shift+1',
        'speedPreset1': 'Shift+2',
        'speedPreset1.5': 'Shift+3',
        'speedPreset2': 'Shift+4'
    };

    // MIDI mappings configuration (parallel to keyboard shortcuts)
    let midiMappings = {
        'previousClip': null,
        'nextClip': null,
        'previousCuePoint': null,
        'nextCuePoint': null,
        'restartClip': null,
        'recordCuePoint': null,
        'setInPoint': null,
        'setOutPoint': null,
        'clearInOut': null,
        'pausePlay': null,
        'tab1': null,
        'tab2': null,
        'tab3': null,
        'tab4': null,
        'tab5': null,
        'speedPreset0.5': null,
        'speedPreset1': null,
        'speedPreset1.5': null,
        'speedPreset2': null
    };

    // MIDI learn state
    let midiLearnActive = false;
    let midiLearnAction = null;
    let midiDevices = [];
    let currentMIDIDevice = null;

    // Track if shortcuts modal is open
    let shortcutsModalOpen = false;

    // Track which clip the context menu is open for
    let contextMenuClipNumber = null;

    // Track which clip is currently playing (for visual indicator)
    let currentlyPlayingClipNumber = null;

    // Session management functions
    function createSessionData() {
        // Create a clean copy of video data with thumbnails and file paths
        const cleanVideos = {};
        Object.keys(tabClipVideos).forEach(tabIndex => {
            cleanVideos[tabIndex] = {};
            Object.keys(tabClipVideos[tabIndex]).forEach(clipNumber => {
                const video = tabClipVideos[tabIndex][clipNumber];
                cleanVideos[tabIndex][clipNumber] = {
                    name: video.name,
                    filePath: video.filePath || null,  // Save file path for automatic reconnection
                    // Store thumbnail if available
                    thumbnail: video.thumbnail || null
                };
            });
        });

        // Create a clean copy of reversed video paths (for bounce mode)
        const cleanReversedVideos = {};
        Object.keys(tabClipReversedVideos).forEach(tabIndex => {
            cleanReversedVideos[tabIndex] = {};
            Object.keys(tabClipReversedVideos[tabIndex]).forEach(clipNumber => {
                const reversedVideo = tabClipReversedVideos[tabIndex][clipNumber];
                if (reversedVideo) {
                    cleanReversedVideos[tabIndex][clipNumber] = {
                        path: reversedVideo.path || null
                    };
                }
            });
        });

        return {
            version: '1.5', // Updated version for reversed videos support
            timestamp: new Date().toISOString(),
            sessionName: currentSessionName,
            currentTab: currentTab,
            selectedClipSlot: selectedClipSlot ? selectedClipSlot.dataset.clipNumber : null,
            currentFolderPath: currentFolderPath,
            globalPlayIntent: globalPlayIntent,
            globalAutoPlayEnabled: globalAutoPlayEnabled,
            keyboardShortcuts: keyboardShortcuts,
            midiMappings: midiMappings,
            allTabs: allTabs,
            nextTabIndex: nextTabIndex,
            tabCustomNames: tabCustomNames,
            tabs: {
                videos: cleanVideos,
                reversedVideos: cleanReversedVideos,
                cuePoints: tabClipCuePoints,
                speeds: tabClipSpeeds,
                clipNames: tabClipNames,
                clipModes: tabClipModes,
                currentCueIndex: tabClipCurrentCueIndex,
                inOutPoints: tabClipInOutPoints
            }
        };
    }

    async function saveSession() {
        try {
            const sessionData = createSessionData();

            console.log('=== SAVING SESSION ===');
            console.log('Current folder path being saved:', currentFolderPath);
            console.log('Current tab data:', tabClipVideos);
            console.log('Session data being saved:', sessionData);

            // Create a default session name if none exists
            if (!currentSessionName) {
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                currentSessionName = `metropolis-session-${timestamp}`;
            }

            // Save using Electron API
            const result = await window.electronAPI.saveSession(sessionData);

            if (result.canceled) {
                console.log('Session save cancelled by user');
                return;
            }

            if (result.success) {
                sessionModified = false;
                updateSessionStatus(`Saved: ${currentSessionName}`);
                console.log('Session saved successfully to:', result.filePath);
            } else {
                throw new Error(result.error || 'Failed to save session');
            }

        } catch (error) {
            console.error('Error saving session:', error);
            alert('Error saving session: ' + error.message);
        }
    }

    function loadSessionFromFile(file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const sessionData = JSON.parse(e.target.result);
                await loadSessionData(sessionData);
            } catch (error) {
                console.error('Error parsing session file:', error);
                alert('Error loading session: Invalid file format');
            }
        };
        reader.readAsText(file);
    }

    async function loadSessionData(sessionData) {
        try {
            // Validate session data
            if (!sessionData.version || !sessionData.tabs) {
                throw new Error('Invalid session file format');
            }

            console.log('=== LOADING SESSION ===');
            console.log('Session data from file:', sessionData);
            console.log('Before loading - current tab data:', tabClipVideos);

            // Clear current state
            clearAllTabs();
            console.log('After clearing - tab data:', tabClipVideos);

            // Restore tab data
            if (sessionData.tabs.videos) {
                console.log('Restoring videos:', sessionData.tabs.videos);
                // Deep copy to preserve thumbnail data
                Object.keys(sessionData.tabs.videos).forEach(tabIndex => {
                    tabClipVideos[tabIndex] = {};
                    Object.keys(sessionData.tabs.videos[tabIndex]).forEach(clipNumber => {
                        tabClipVideos[tabIndex][clipNumber] = {
                            ...sessionData.tabs.videos[tabIndex][clipNumber]
                        };
                    });
                });
            }
            if (sessionData.tabs.reversedVideos) {
                console.log('Restoring reversed videos:', sessionData.tabs.reversedVideos);
                // Restore reversed video paths for bounce mode
                Object.keys(sessionData.tabs.reversedVideos).forEach(tabIndex => {
                    if (!tabClipReversedVideos[tabIndex]) {
                        tabClipReversedVideos[tabIndex] = {};
                    }
                    Object.keys(sessionData.tabs.reversedVideos[tabIndex]).forEach(clipNumber => {
                        const reversedData = sessionData.tabs.reversedVideos[tabIndex][clipNumber];
                        if (reversedData && reversedData.path) {
                            const reversedUrl = `file:///${reversedData.path.replace(/\\/g, '/')}`;
                            tabClipReversedVideos[tabIndex][clipNumber] = {
                                path: reversedData.path,
                                url: reversedUrl
                            };
                        }
                    });
                });
            }
            if (sessionData.tabs.cuePoints) {
                console.log('Restoring cue points:', sessionData.tabs.cuePoints);
                Object.assign(tabClipCuePoints, sessionData.tabs.cuePoints);
            }
            if (sessionData.tabs.speeds) {
                console.log('Restoring speeds:', sessionData.tabs.speeds);
                Object.assign(tabClipSpeeds, sessionData.tabs.speeds);
            }
            if (sessionData.tabs.clipNames) {
                console.log('Restoring clip names:', sessionData.tabs.clipNames);
                Object.assign(tabClipNames, sessionData.tabs.clipNames);
            }
            if (sessionData.tabs.clipModes) {
                console.log('Restoring clip modes:', sessionData.tabs.clipModes);
                Object.assign(tabClipModes, sessionData.tabs.clipModes);
            }
            if (sessionData.tabs.currentCueIndex) {
                console.log('Restoring current cue indices:', sessionData.tabs.currentCueIndex);
                Object.assign(tabClipCurrentCueIndex, sessionData.tabs.currentCueIndex);
            }
            if (sessionData.tabs.inOutPoints) {
                console.log('Restoring In/Out points:', sessionData.tabs.inOutPoints);
                Object.assign(tabClipInOutPoints, sessionData.tabs.inOutPoints);
            }

            console.log('After restoring - tab data:', tabClipVideos);

            // Restore current tab
            if (sessionData.currentTab !== undefined) {
                console.log('Switching to tab:', sessionData.currentTab);
                switchTab(sessionData.currentTab);
            }

            // Update current tab references
            clipVideos = tabClipVideos[currentTab];
            clipReversedVideos = tabClipReversedVideos[currentTab];
            clipCuePoints = tabClipCuePoints[currentTab];
            clipSpeeds = tabClipSpeeds[currentTab];
            clipNames = tabClipNames[currentTab];
            clipModes = tabClipModes[currentTab];
            clipCurrentCueIndex = tabClipCurrentCueIndex[currentTab];
            clipInOutPoints = tabClipInOutPoints[currentTab];
            console.log('Current tab video data:', clipVideos);
            console.log('Current tab reversed video data:', clipReversedVideos);

            // Restore folder path (keep for backward compatibility)
            if (sessionData.currentFolderPath) {
                currentFolderPath = sessionData.currentFolderPath;
            }

            // Auto-reconnect videos using saved file paths
            await reconnectVideosFromPaths();

            // Restore global play intent
            if (sessionData.globalPlayIntent !== undefined) {
                globalPlayIntent = sessionData.globalPlayIntent;
                // updatePlayButtonState() removed - no global play/pause button
            }

            // Restore global auto-play setting
            if (sessionData.globalAutoPlayEnabled !== undefined) {
                globalAutoPlayEnabled = sessionData.globalAutoPlayEnabled;
                autoPlayToggle.checked = globalAutoPlayEnabled;
                console.log('Restored auto-play setting:', globalAutoPlayEnabled);
            }

            // Restore keyboard shortcuts
            if (sessionData.keyboardShortcuts) {
                // Migrate old toggleAutoPlay to pausePlay
                if (sessionData.keyboardShortcuts.toggleAutoPlay !== undefined) {
                    if (!sessionData.keyboardShortcuts.pausePlay) {
                        sessionData.keyboardShortcuts.pausePlay = sessionData.keyboardShortcuts.toggleAutoPlay;
                        console.log('Migrated toggleAutoPlay shortcut to pausePlay');
                    }
                    delete sessionData.keyboardShortcuts.toggleAutoPlay;
                }
                // Ensure pausePlay has default spacebar mapping if missing
                if (sessionData.keyboardShortcuts.pausePlay === undefined) {
                    sessionData.keyboardShortcuts.pausePlay = 'Space';
                    console.log('Set default spacebar mapping for pausePlay');
                }
                // Also migrate old ' ' (space char) format to 'Space' (string)
                if (sessionData.keyboardShortcuts.pausePlay === ' ') {
                    sessionData.keyboardShortcuts.pausePlay = 'Space';
                    console.log('Migrated space character to Space string for pausePlay');
                }
                keyboardShortcuts = { ...keyboardShortcuts, ...sessionData.keyboardShortcuts };
            }

            // Restore MIDI mappings
            if (sessionData.midiMappings) {
                // Migrate old toggleAutoPlay to pausePlay
                if (sessionData.midiMappings.toggleAutoPlay !== undefined) {
                    if (!sessionData.midiMappings.pausePlay) {
                        sessionData.midiMappings.pausePlay = sessionData.midiMappings.toggleAutoPlay;
                        console.log('Migrated toggleAutoPlay MIDI mapping to pausePlay');
                    }
                    delete sessionData.midiMappings.toggleAutoPlay;
                }
                // Ensure pausePlay is initialized (null by default for MIDI)
                if (sessionData.midiMappings.pausePlay === undefined) {
                    sessionData.midiMappings.pausePlay = null;
                }
                midiMappings = { ...midiMappings, ...sessionData.midiMappings };
                console.log('Restored MIDI mappings:', midiMappings);
            }

            // Restore tab configuration if available (v1.2+)
            if (sessionData.allTabs && sessionData.nextTabIndex) {
                allTabs = [...sessionData.allTabs];
                nextTabIndex = sessionData.nextTabIndex;
                if (sessionData.tabCustomNames) {
                    Object.assign(tabCustomNames, sessionData.tabCustomNames);
                }

                // Rebuild tab UI
                rebuildTabBar();
            }

            // Restore session name
            currentSessionName = sessionData.sessionName;
            sessionModified = false;
            updateSessionStatus(`Loaded: ${currentSessionName || 'Unnamed session'}`);

            // Refresh UI to show restored slots
            refreshClipMatrix();

            // Attempt to auto-reconnect videos using stored file handles
            attemptAutoReconnect();

            console.log('Session loaded successfully');
            console.log('Final state - current tab videos:', clipVideos);

        } catch (error) {
            console.error('Error loading session:', error);
            alert('Error loading session: ' + error.message);
        }
    }

    function clearAllTabs() {
        // Memory management: Revoke all blob URLs before clearing
        for (let i = 0; i < 5; i++) {
            const tabVideos = tabClipVideos[i];
            Object.keys(tabVideos).forEach(clipNumber => {
                if (tabVideos[clipNumber] && tabVideos[clipNumber].url) {
                    URL.revokeObjectURL(tabVideos[clipNumber].url);
                }
            });
        }
        console.log('Revoked all blob URLs during tab clearing');

        // Clear all tab data
        for (let i = 0; i < 5; i++) {
            tabClipVideos[i] = {};
            tabClipReversedVideos[i] = {};
            tabClipCuePoints[i] = {};
            tabClipSpeeds[i] = {};
            tabClipNames[i] = {};
            tabClipModes[i] = {};
            tabClipCurrentCueIndex[i] = {};
        }

        // Update current references
        clipVideos = tabClipVideos[currentTab];
        clipReversedVideos = tabClipReversedVideos[currentTab];
        clipCuePoints = tabClipCuePoints[currentTab];
        clipSpeeds = tabClipSpeeds[currentTab];
        clipNames = tabClipNames[currentTab];
        clipModes = tabClipModes[currentTab];
        clipCurrentCueIndex = tabClipCurrentCueIndex[currentTab];

        // Clear UI
        refreshClipMatrix();
        // updateCuePointsList(); // REMOVED - cue points visible on timeline
        updateCueMarkersOnTimeline();
        updateInOutMarkersOnTimeline();
        updateSpeedControls();

        // Clear video player
        video.src = '';
        video.load();

        // Clear selection
        if (selectedClipSlot) {
            selectedClipSlot.classList.remove('selected');
            selectedClipSlot = null;
        }
    }

    function updateSessionStatus(status) {
        sessionStatus.textContent = status;
        sessionStatus.style.color = sessionModified ? '#ffaa00' : '#90ee90';
    }

    function markSessionModified() {
        if (!sessionModified) {
            sessionModified = true;
            updateSessionStatus(`Modified: ${currentSessionName || 'Unnamed session'}`);
        }
    }

    // Check if videos need reconnection after loading a session
    function attemptAutoReconnect() {
        let totalVideos = 0;
        let connectedVideos = 0;
        let disconnectedVideos = 0;

        // Count total videos and check connection status
        for (let tabIndex = 0; tabIndex < 5; tabIndex++) {
            const tabVideos = tabClipVideos[tabIndex];
            Object.keys(tabVideos).forEach(clipNumber => {
                const videoData = tabVideos[clipNumber];
                if (videoData && videoData.name) {
                    totalVideos++;
                    // Check if video is connected (has valid URL and file reference)
                    if (videoData.url && videoData.file && videoData.filePath) {
                        connectedVideos++;
                    } else {
                        disconnectedVideos++;
                    }
                }
            });
        }

        // Only show alert if there are disconnected videos
        if (disconnectedVideos > 0) {
            if (connectedVideos > 0) {
                // Some connected, some not
                alert(`Session loaded!\n\n${connectedVideos} of ${totalVideos} video(s) auto-connected.\n\n${disconnectedVideos} video(s) need reconnection - drag and drop video files from your file explorer to reconnect.`);
            } else {
                // None connected
                alert(`Session loaded!\n\n${totalVideos} video slot(s) restored with thumbnails.\n\nDrag and drop video files from your file explorer to reconnect - files with matching names will auto-connect.`);
            }
        }
        // If all videos are connected, don't show any alert (silent success)
        console.log(`Session reconnection status: ${connectedVideos}/${totalVideos} videos connected`);
    }

    // Reconnect videos using saved file paths
    async function reconnectVideosFromPaths() {
        console.log('=== AUTO-RECONNECTING VIDEOS FROM SAVED PATHS ===');

        let totalVideos = 0;
        let reconnectedVideos = 0;

        // Loop through all tabs
        for (let tabIndex = 0; tabIndex < 5; tabIndex++) {
            const tabVideos = tabClipVideos[tabIndex];

            for (const clipNumber in tabVideos) {
                const videoData = tabVideos[clipNumber];

                // Check if this slot has a video with a saved filePath but no url
                if (videoData && videoData.name && videoData.filePath && !videoData.url) {
                    totalVideos++;
                    console.log(`Attempting to reconnect: ${videoData.name} from ${videoData.filePath}`);

                    try {
                        // Create file URL for Electron
                        const url = `file:///${videoData.filePath.replace(/\\/g, '/')}`;

                        // Update the video data with URL
                        videoData.url = url;
                        videoData.file = {
                            name: videoData.name,
                            path: videoData.filePath
                        };

                        console.log(`✓ Reconnected: ${videoData.name}`);
                        reconnectedVideos++;

                    } catch (error) {
                        console.warn(`✗ Failed to reconnect ${videoData.name}:`, error.message);
                    }
                }
            }
        }

        console.log(`Reconnection complete: ${reconnectedVideos}/${totalVideos} videos reconnected`);

        // Refresh UI
        refreshClipMatrix();

        // Show status if there are disconnected videos
        attemptAutoReconnect();
    }

    // Auto-connect loaded session videos when files are found
    function autoConnectSessionVideo(file) {
        console.log(`=== AUTO-CONNECTING FILE: ${file.name} ===`);
        console.log('File object:', file);

        let connectionsMade = 0;

        // Check all tabs for video slots that match this filename but don't have working URLs
        for (let tabIndex = 0; tabIndex < 5; tabIndex++) {
            const tabVideos = tabClipVideos[tabIndex];
            console.log(`Checking tab ${tabIndex} videos:`, tabVideos);

            Object.keys(tabVideos).forEach(clipNumber => {
                const videoData = tabVideos[clipNumber];
                console.log(`Checking clip ${clipNumber}:`, videoData);

                // If this slot has a video with matching name but no valid URL or file
                if (videoData && videoData.name === file.name && (!videoData.url || !videoData.file)) {
                    console.log(`MATCH FOUND! Auto-connecting ${file.name} to tab ${tabIndex}, clip ${clipNumber}`);

                    // Create file URL for Electron
                    const filePath = file.path || file.name;
                    const url = `file:///${filePath.replace(/\\/g, '/')}`;
                    console.log(`Created file:// URL: ${url}`);

                    // Update the video data with new file reference
                    videoData.url = url;
                    videoData.file = file;
                    videoData.filePath = filePath;
                    videoData.type = 'file'; // Update type since it's now properly loaded

                    // Generate thumbnail for reconnected video
                    generateThumbnail(file, function(thumbnailUrl) {
                        if (thumbnailUrl && videoData) {
                            videoData.thumbnail = thumbnailUrl;
                            // Update UI if this is the current tab
                            if (tabIndex === currentTab) {
                                const slot = document.querySelector(`[data-clip-number="${clipNumber}"]`);
                                if (slot) {
                                    updateSlotAppearance(slot, true);
                                }
                            }
                        }
                    });

                    connectionsMade++;
                    console.log(`Updated video data:`, videoData);

                    // If this is the current tab, update the UI
                    if (tabIndex === currentTab) {
                        console.log(`This is current tab (${currentTab}), updating UI`);
                        const slot = document.querySelector(`[data-clip-number="${clipNumber}"]`);
                        console.log(`Found slot element:`, slot);

                        if (slot) {
                            updateSlotAppearance(slot, true);
                            console.log(`Updated slot appearance for clip ${clipNumber}`);

                            // If this slot is currently selected, load it in the video player immediately
                            if (selectedClipSlot && selectedClipSlot.dataset.clipNumber === clipNumber) {
                                console.log(`This slot is currently selected! Loading video into player: ${file.name}`);
                                video.src = url;
                                video.load();

                                // Apply speed and other settings when video loads
                                video.addEventListener('loadeddata', function() {
                                    const clipSpeed = tabClipSpeeds[tabIndex][clipNumber] || 1.0;
                                    setVideoSpeed(clipSpeed);
                                    console.log(`Applied speed ${clipSpeed}x to reconnected video`);
                                }, { once: true });

                                video.addEventListener('error', function(e) {
                                    console.error(`Error loading reconnected video ${file.name}:`, e);
                                }, { once: true });
                            }
                        } else {
                            console.warn(`Could not find slot element for clip ${clipNumber}`);
                        }
                    } else {
                        console.log(`Tab ${tabIndex} is not current tab (${currentTab}), skipping UI update`);
                    }
                } else {
                    if (videoData) {
                        console.log(`Clip ${clipNumber} has video "${videoData.name}" but doesn't match "${file.name}" or already has URL/file`);
                    }
                }
            });
        }

        console.log(`=== COMPLETED AUTO-CONNECT FOR ${file.name} - Made ${connectionsMade} connections ===`);
        return connectionsMade;
    }

    // Drag and drop functions
    function setupClipSlotDropZone(clipSlot) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            clipSlot.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            clipSlot.addEventListener(eventName, function(e) {
                // Check if dragging file from browser OR external file explorer OR another clip
                if (window.draggedFile || window.draggedClip !== undefined || (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files'))) {
                    clipSlot.classList.add('drag-over');
                }
            });
        });

        // Remove highlight when item is dragged away
        clipSlot.addEventListener('dragleave', function(e) {
            // Only remove if we're actually leaving the element (not just moving to a child)
            if (!clipSlot.contains(e.relatedTarget)) {
                clipSlot.classList.remove('drag-over');
            }
        });

        // Handle dropped files
        clipSlot.addEventListener('drop', function(e) {
            clipSlot.classList.remove('drag-over');

            // Check if moving a clip from another slot
            if (window.draggedClip !== undefined) {
                const sourceClipNumber = window.draggedClip;
                const targetClipNumber = parseInt(clipSlot.dataset.clipNumber);

                // Don't do anything if dropping on same slot
                if (sourceClipNumber !== targetClipNumber) {
                    moveClip(sourceClipNumber, targetClipNumber);
                }

                window.draggedClip = undefined;
                return;
            }

            // Check for files from browser file list
            if (window.draggedFile) {
                const clipNumber = clipSlot.dataset.clipNumber;

                // Select this slot and load the video
                selectClipSlot(clipSlot);
                loadVideoFromFile(window.draggedFile);
                // Also try to auto-connect to any session slots waiting for this file
                autoConnectSessionVideo(window.draggedFile);

                console.log(`Dropped ${window.draggedFile.name} into clip slot ${clipNumber}`);
                return;
            }

            // Check for files from external file explorer
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                const videoFiles = files.filter(file => isVideoFile(file.name));

                if (videoFiles.length > 0) {
                    const file = videoFiles[0]; // Use the first video file
                    const clipNumber = clipSlot.dataset.clipNumber;

                    // Select this slot and load the video
                    selectClipSlot(clipSlot);
                    loadVideoFromFile(file);
                    // Also try to auto-connect to any session slots waiting for this file
                    autoConnectSessionVideo(file);

                    console.log(`Dropped external file ${file.name} into clip slot ${clipNumber}`);
                } else {
                    alert('Please drop a video file (MP4, MOV, AVI, MKV, WMV, FLV, WEBM, M4V, 3GP)');
                }
            }
        });
    }

    // Generate 6x6 grid of clip slots
    function createClipMatrix() {
        clipsMatrix.innerHTML = '';
        for (let i = 1; i <= 36; i++) {
            const clipSlot = document.createElement('div');
            clipSlot.className = 'clip-slot';
            clipSlot.textContent = `Clip ${i}`;
            clipSlot.dataset.clipNumber = i;

            // Add click handler for selection
            clipSlot.addEventListener('click', function() {
                selectClipSlot(clipSlot);
            });

            // Add right-click handler for context menu
            clipSlot.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showClipContextMenu(e, i);
            });

            // Add drag and drop handlers
            setupClipSlotDropZone(clipSlot);
            setupClipSlotDrag(clipSlot, i);

            clipsMatrix.appendChild(clipSlot);
        }
        console.log('Created 6x6 clip matrix with 36 slots');
    }

    // Setup drag handlers for clip slot (for moving clips between slots)
    function setupClipSlotDrag(clipSlot, clipNumber) {
        clipSlot.addEventListener('dragstart', function(e) {
            // Only allow dragging if this slot has a video
            if (clipVideos[clipNumber]) {
                window.draggedClip = clipNumber;
                clipSlot.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', clipNumber); // For compatibility
                console.log(`Started dragging clip ${clipNumber}`);
            } else {
                e.preventDefault();
            }
        });

        clipSlot.addEventListener('dragend', function(e) {
            clipSlot.style.opacity = '1';
            window.draggedClip = undefined;
            // Remove any lingering drag-over styles
            document.querySelectorAll('.clip-slot.drag-over').forEach(slot => {
                slot.classList.remove('drag-over');
            });
            console.log(`Finished dragging clip ${clipNumber}`);
        });
    }

    // Show context menu for clip playback mode selection
    function showClipContextMenu(event, clipNumber) {
        contextMenuClipNumber = clipNumber;

        // Show menu first (invisible) to get dimensions
        clipContextMenu.style.display = 'block';

        // Get menu dimensions
        const menuWidth = clipContextMenu.offsetWidth;
        const menuHeight = clipContextMenu.offsetHeight;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate position, ensuring menu stays within viewport
        let left = event.pageX;
        let top = event.pageY;

        // Adjust horizontal position if menu would go off right edge
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 10; // 10px margin from edge
        }

        // Adjust vertical position if menu would go off bottom edge
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10; // 10px margin from edge
        }

        // Ensure menu doesn't go off left or top edges
        if (left < 10) left = 10;
        if (top < 10) top = 10;

        // Position the menu
        clipContextMenu.style.left = left + 'px';
        clipContextMenu.style.top = top + 'px';

        // Get current mode for this clip (default is 'forward-stop')
        const currentMode = clipModes[clipNumber] || 'loop';

        // Update active state for menu items
        const menuItems = clipContextMenu.querySelectorAll('.context-menu-item');
        menuItems.forEach(item => {
            const mode = item.dataset.mode;
            if (mode === currentMode) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Hide the context menu
    function hideClipContextMenu() {
        clipContextMenu.style.display = 'none';
        contextMenuClipNumber = null;
    }

    // Set playback mode for a clip
    function setClipMode(clipNumber, mode) {
        clipModes[clipNumber] = mode;
        markSessionModified();
        console.log(`Set clip ${clipNumber} to mode: ${mode}`);

        // If bounce mode is selected and video is loaded, generate/load reversed video
        if (mode === 'bounce' && clipVideos[clipNumber]) {
            const filePath = clipVideos[clipNumber].filePath;
            if (filePath) {
                loadReversedVideoForBounceMode(clipNumber, filePath);
            }
        }

        // Update visual indicator
        const slot = document.querySelector(`[data-clip-number="${clipNumber}"]`);
        if (slot) {
            updateSlotAppearance(slot, clipVideos[clipNumber]);
        }
    }

    // Move/swap clip between slots
    function moveClip(sourceClipNumber, targetClipNumber) {
        console.log(`Moving clip from ${sourceClipNumber} to ${targetClipNumber}`);

        // Save source clip data
        const sourceVideo = clipVideos[sourceClipNumber];
        const sourceCuePoints = clipCuePoints[sourceClipNumber] || [];
        const sourceSpeed = clipSpeeds[sourceClipNumber] || 1.0;
        const sourceName = clipNames[sourceClipNumber];
        const sourceMode = clipModes[sourceClipNumber] || 'loop';

        // Save target clip data (for swap)
        const targetVideo = clipVideos[targetClipNumber];
        const targetCuePoints = clipCuePoints[targetClipNumber] || [];
        const targetSpeed = clipSpeeds[targetClipNumber] || 1.0;
        const targetName = clipNames[targetClipNumber];
        const targetMode = clipModes[targetClipNumber] || 'loop';

        // Move source to target
        if (sourceVideo) {
            clipVideos[targetClipNumber] = sourceVideo;
            clipCuePoints[targetClipNumber] = sourceCuePoints;
            clipSpeeds[targetClipNumber] = sourceSpeed;
            if (sourceName) clipNames[targetClipNumber] = sourceName;
            clipModes[targetClipNumber] = sourceMode;
        } else {
            delete clipVideos[targetClipNumber];
            delete clipCuePoints[targetClipNumber];
            delete clipSpeeds[targetClipNumber];
            delete clipNames[targetClipNumber];
            delete clipModes[targetClipNumber];
        }

        // Move target to source (swap)
        if (targetVideo) {
            clipVideos[sourceClipNumber] = targetVideo;
            clipCuePoints[sourceClipNumber] = targetCuePoints;
            clipSpeeds[sourceClipNumber] = targetSpeed;
            if (targetName) clipNames[sourceClipNumber] = targetName;
            clipModes[sourceClipNumber] = targetMode;
        } else {
            delete clipVideos[sourceClipNumber];
            delete clipCuePoints[sourceClipNumber];
            delete clipSpeeds[sourceClipNumber];
            delete clipNames[sourceClipNumber];
            delete clipModes[sourceClipNumber];
        }

        // Update UI for both slots
        const sourceSlot = document.querySelector(`[data-clip-number="${sourceClipNumber}"]`);
        const targetSlot = document.querySelector(`[data-clip-number="${targetClipNumber}"]`);

        if (sourceSlot) {
            updateSlotAppearance(sourceSlot, clipVideos[sourceClipNumber]);
        }

        if (targetSlot) {
            updateSlotAppearance(targetSlot, clipVideos[targetClipNumber]);
        }

        // If the currently selected slot was involved, update the video player
        if (selectedClipSlot) {
            const selectedClipNumber = parseInt(selectedClipSlot.dataset.clipNumber);
            if (selectedClipNumber === sourceClipNumber || selectedClipNumber === targetClipNumber) {
                loadClipIntoPlayer(selectedClipNumber);
                // updateCuePointsList(); // REMOVED - cue points visible on timeline
                updateCueMarkersOnTimeline();
                updateSpeedControls();
            }
        }

        markSessionModified();
        console.log(`Moved/swapped clips ${sourceClipNumber} ↔ ${targetClipNumber}`);
    }

    // Clear all data for a clip
    function clearClip(clipNumber) {
        // Remove video data
        if (clipVideos[clipNumber]) {
            // Revoke blob URL if it exists to free memory
            if (clipVideos[clipNumber].url && clipVideos[clipNumber].url.startsWith('blob:')) {
                URL.revokeObjectURL(clipVideos[clipNumber].url);
            }
            delete clipVideos[clipNumber];
        }

        // Remove cue points
        delete clipCuePoints[clipNumber];

        // Remove speed setting
        delete clipSpeeds[clipNumber];

        // Remove custom name
        delete clipNames[clipNumber];

        // Remove playback mode
        delete clipModes[clipNumber];

        // Update the clip slot UI
        const slot = document.querySelector(`[data-clip-number="${clipNumber}"]`);
        if (slot) {
            slot.classList.remove('has-video', 'selected');

            // Remove thumbnail
            const thumbnailContainer = slot.querySelector('.clip-thumbnail-container');
            if (thumbnailContainer) {
                const thumbnail = thumbnailContainer.querySelector('.clip-thumbnail');
                if (thumbnail) {
                    thumbnail.remove();
                }
            }

            // Reset content
            const content = slot.querySelector('.clip-slot-content');
            if (content) {
                const label = content.querySelector('.clip-slot-label');
                const filename = content.querySelector('.clip-slot-filename');

                if (label) {
                    label.textContent = `Clip ${clipNumber + 1}`;
                    label.classList.remove('editing');
                    label.contentEditable = false;
                }

                if (filename) {
                    filename.textContent = '';
                }
            }

            // Remove mode indicator
            const modeIndicator = slot.querySelector('.clip-mode-indicator');
            if (modeIndicator) {
                modeIndicator.remove();
            }

        }

        // If this was the selected slot and it was playing, pause the video
        if (selectedClipSlot && parseInt(selectedClipSlot.dataset.clipNumber) === clipNumber) {
            video.pause();
            globalPlayIntent = false;
            updateTransportButtonStates();

            // Clear cue points display
            // updateCuePointsList(); // REMOVED - cue points visible on timeline
        }

        markSessionModified();
        console.log(`Cleared clip ${clipNumber}`);
    }

    // Handle clip selection
    function selectClipSlot(clipSlot) {
        console.log('=== SELECTING CLIP SLOT ===');
        console.log('Slot element:', clipSlot);
        console.log('Current tab:', currentTab);

        // Remove selected class from previously selected slot
        if (selectedClipSlot) {
            console.log('Removing selection from previous slot:', selectedClipSlot.dataset.clipNumber);
            selectedClipSlot.classList.remove('selected');
        }

        // Add selected class to new slot
        clipSlot.classList.add('selected');
        selectedClipSlot = clipSlot;

        const clipNumber = clipSlot.dataset.clipNumber;
        console.log(`Selected clip slot ${clipNumber}`);
        console.log('Current clipVideos object:', clipVideos);
        console.log(`Video data for slot ${clipNumber}:`, clipVideos[clipNumber]);

        // If this slot has a video, load it in the preview
        if (clipVideos[clipNumber]) {
            const wasPlaying = globalPlayIntent;
            const videoData = clipVideos[clipNumber];

            // Check if we have a valid URL
            if (videoData.url && videoData.file) {
                video.src = videoData.url;

                // Performance: Ensure audio is disabled
                video.muted = true;
                video.volume = 0;

                // Set loop mode based on clip mode
                const clipMode = clipModes[clipNumber] || 'loop';
                video.loop = (clipMode === 'loop');

                video.load();
                console.log('Loaded video for selected slot:', videoData.name, 'Mode:', clipMode);

                // If bounce mode, also load reversed video
                if (clipMode === 'bounce' && clipReversedVideos[clipNumber]) {
                    videoReverse.src = clipReversedVideos[clipNumber].url;
                    videoReverse.muted = true;
                    videoReverse.volume = 0;
                    videoReverse.loop = false; // Never loop reversed video
                    videoReverse.load();
                    console.log('Loaded reversed video for bounce mode');
                }
            } else {
                // Video data exists but no valid URL - this is from a loaded session
                console.warn(`Video slot ${clipNumber} has data but no valid URL:`, videoData);
                console.log('Video needs to be reconnected - drag and drop file');

                // Clear the video player
                video.src = '';
                video.load();

                // Show user-friendly message
                if (videoData.name) {
                    alert(`Video "${videoData.name}" needs to be reconnected. Drag and drop the video file onto this clip slot to reconnect.`);
                }
            }

            // Apply speed when video is loaded
            video.addEventListener('loadeddata', function() {
                // Apply the correct speed for this clip
                const clipSpeed = clipSpeeds[clipNumber] || 1.0;
                setVideoSpeed(clipSpeed);

                // ALWAYS start at In Point (or 0:00 if not set)
                const inOut = clipInOutPoints[clipNumber];
                const startTime = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null) ? inOut.inPoint : 0;
                video.currentTime = startTime;
                // Update timeline immediately to show position
                updateTimeline();
                console.log(`Starting from ${startTime > 0 ? 'In point' : 'beginning'}: ${formatTime(startTime)}`);

                // Auto-play when clip is selected - only if global auto-play is enabled
                if (globalAutoPlayEnabled) {
                    globalPlayIntent = true;
                    video.play().then(() => {
                        console.log('Auto-playing clip on selection');
                    }).catch(e => {
                        console.error('Error auto-playing video:', e);
                    });
                } else {
                    globalPlayIntent = false;
                    console.log('Clip loaded but not playing (auto-play disabled)');
                }
            }, { once: true });
        } else {
            // No video in this slot
            // globalPlayIntent unchanged - keep user's intent
        }

        // Update cue points list for the newly selected clip
        // updateCuePointsList(); // REMOVED - cue points visible on timeline
        updateCueMarkersOnTimeline();
        updateInOutMarkersOnTimeline();
        updateSpeedControls();
    }

    // Generate thumbnail from video file
    function generateThumbnail(file, callback) {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.muted = true;

        video.onloadedmetadata = function() {
            // Seek to 1 second or 10% of duration, whichever is smaller
            const seekTime = Math.min(1, video.duration * 0.1);
            video.currentTime = seekTime;
        };

        video.onseeked = function() {
            // Set canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw the current frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to data URL
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

            // Clean up (only revoke blob URLs, not file:// URLs)
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }

            callback(thumbnailUrl);
        };

        video.onerror = function() {
            console.error('Error generating thumbnail');
            // Only revoke if it's a blob URL
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            callback(null);
        };

        // Handle both Electron file paths and browser File objects
        if (file.path) {
            // Electron: use file:// protocol
            video.src = `file:///${file.path.replace(/\\/g, '/')}`;
            console.log('Generating thumbnail from Electron path:', video.src);
        } else {
            // Browser: use blob URL
            video.src = URL.createObjectURL(file);
            console.log('Generating thumbnail from blob URL');
        }
    }

    // Update visual appearance of slot based on whether it has video
    function updateSlotAppearance(slot, hasVideo) {
        const clipNumber = slot.dataset.clipNumber;
        const customName = clipNames[clipNumber] || `Clip ${clipNumber}`;

        // Get mode setting
        const clipMode = clipModes[clipNumber] || 'loop';

        // Mode icon mapping
        const modeIcons = {
            'forward': '▶',
            'loop': '🔁',
            'forward-stop': '⏸',
            'forward-next': '⏭',
            'bounce': '⇆'
        };

        const modeIcon = modeIcons[clipMode] || '⏸';

        if (hasVideo) {
            slot.classList.add('has-video');
            slot.setAttribute('draggable', 'true'); // Make slot draggable when it has video
            const videoData = clipVideos[clipNumber];

            // Build slot content with thumbnail support
            let thumbnailHtml = '';
            if (videoData.thumbnail) {
                thumbnailHtml = `
                    <div class="clip-thumbnail-container">
                        <img src="${videoData.thumbnail}" class="clip-thumbnail" alt="Thumbnail">
                    </div>
                `;
            } else {
                thumbnailHtml = `<div class="clip-thumbnail-container"></div>`;
            }

            slot.innerHTML = `
                ${thumbnailHtml}
                <div class="clip-mode-indicator" title="Playback Mode: ${clipMode}">${modeIcon}</div>
                <div class="clip-slot-content">
                    <div class="clip-slot-label" data-clip-number="${clipNumber}">${customName}</div>
                    <div class="clip-slot-filename">${videoData.name}</div>
                </div>
            `;
        } else {
            slot.classList.remove('has-video');
            slot.setAttribute('draggable', 'false'); // Not draggable when empty
            slot.innerHTML = `
                <div class="clip-thumbnail-container"></div>
                <div class="clip-slot-content">
                    <div class="clip-slot-label" data-clip-number="${clipNumber}">${customName}</div>
                </div>
            `;
        }

        // Add double-click handler for renaming
        const label = slot.querySelector('.clip-slot-label');
        if (label) {
            label.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                startEditingClipName(clipNumber, label);
            });
        }
    }

    // Start editing a clip name
    function startEditingClipName(clipNumber, labelElement) {
        const currentName = clipNames[clipNumber] || `Clip ${clipNumber}`;

        labelElement.contentEditable = true;
        labelElement.classList.add('editing');
        labelElement.textContent = currentName;
        labelElement.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(labelElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Save on blur or Enter key
        function finishEditing() {
            labelElement.contentEditable = false;
            labelElement.classList.remove('editing');

            const newName = labelElement.textContent.trim();
            if (newName && newName !== `Clip ${clipNumber}`) {
                clipNames[clipNumber] = newName;
                markSessionModified();
                console.log(`Renamed clip ${clipNumber} to "${newName}"`);
            } else {
                // Reset to default if empty
                delete clipNames[clipNumber];
                labelElement.textContent = `Clip ${clipNumber}`;
            }

            labelElement.removeEventListener('blur', finishEditing);
            labelElement.removeEventListener('keydown', handleKeydown);
        }

        function handleKeydown(e) {
            // Stop ALL keyboard events from bubbling to prevent global shortcuts
            e.stopPropagation();

            if (e.key === 'Enter') {
                e.preventDefault();
                labelElement.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                labelElement.textContent = currentName;
                labelElement.blur();
            }
        }

        labelElement.addEventListener('blur', finishEditing);
        labelElement.addEventListener('keydown', handleKeydown);
    }

    // Navigate between clips with video content
    function navigateToClip(direction) {
        console.log('=== NAVIGATE TO CLIP ===');
        console.log('Direction:', direction);
        console.log('Current tab:', currentTab);
        console.log('clipVideos object:', clipVideos);

        const allSlots = Array.from(document.querySelectorAll('.clip-slot'));
        console.log('Total slots found:', allSlots.length);

        const loadedSlots = allSlots.filter(slot => {
            const clipNumber = slot.dataset.clipNumber;
            const hasVideo = clipVideos[clipNumber];
            console.log(`Slot ${clipNumber} has video:`, !!hasVideo);
            return hasVideo;
        });

        console.log('Loaded slots count:', loadedSlots.length);
        console.log('Loaded slot numbers:', loadedSlots.map(s => s.dataset.clipNumber));

        if (loadedSlots.length === 0) {
            alert('No clips with videos loaded');
            return;
        }

        let currentIndex = -1;
        if (selectedClipSlot) {
            currentIndex = loadedSlots.findIndex(slot => slot === selectedClipSlot);
            console.log('Current selected slot:', selectedClipSlot.dataset.clipNumber);
            console.log('Current index in loaded slots:', currentIndex);
        }

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % loadedSlots.length;
        } else if (direction === 'previous') {
            nextIndex = (currentIndex - 1 + loadedSlots.length) % loadedSlots.length;
        } else {
            console.error('Invalid navigation direction:', direction);
            return;
        }

        console.log('Next index:', nextIndex);
        const targetSlot = loadedSlots[nextIndex];
        console.log('Target slot:', targetSlot.dataset.clipNumber);

        selectClipSlot(targetSlot);
        console.log(`Navigated ${direction} to clip ${targetSlot.dataset.clipNumber}`);
    }

    // Note: updatePlayButtonState() removed - no global play/pause button anymore

    // Format time for display (convert seconds to MM:SS.ss)
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
    }

    // Add a cue point for the current clip at the current video time
    function recordCuePoint() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src) {
            alert('No video is currently loaded');
            return;
        }

        const currentTime = video.currentTime;

        // Initialize cue points array for this clip if it doesn't exist
        if (!clipCuePoints[clipNumber]) {
            clipCuePoints[clipNumber] = [];
        }

        // Create cue point object
        const cuePoint = {
            time: currentTime,
            timestamp: Date.now(),
            id: `cue_${clipNumber}_${Date.now()}`
        };

        // Add to the clip's cue points array
        clipCuePoints[clipNumber].push(cuePoint);

        // Sort cue points by time
        clipCuePoints[clipNumber].sort((a, b) => a.time - b.time);

        console.log(`Recorded cue point at ${formatTime(currentTime)} for clip ${clipNumber}`);

        // Mark session as modified
        markSessionModified();

        // Update the display
        // updateCuePointsList(); // REMOVED - cue points visible on timeline
        updateCueMarkersOnTimeline();
        updateInOutMarkersOnTimeline();
    }

    // In/Out point functions
    function setInPoint() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src || videoDuration === 0) {
            alert('No video is currently loaded');
            return;
        }

        const currentTime = video.currentTime;

        // Initialize In/Out points for this clip if it doesn't exist
        if (!clipInOutPoints[clipNumber]) {
            clipInOutPoints[clipNumber] = {};
        }

        // Set the In point
        clipInOutPoints[clipNumber].inPoint = currentTime;

        console.log(`Set In Point at ${formatTime(currentTime)} for clip ${clipNumber}`);

        // Mark session as modified
        markSessionModified();

        // Update the display
        updateInOutMarkersOnTimeline();
    }

    function setOutPoint() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src || videoDuration === 0) {
            alert('No video is currently loaded');
            return;
        }

        const currentTime = video.currentTime;

        // Initialize In/Out points for this clip if it doesn't exist
        if (!clipInOutPoints[clipNumber]) {
            clipInOutPoints[clipNumber] = {};
        }

        // Set the Out point
        clipInOutPoints[clipNumber].outPoint = currentTime;

        console.log(`Set Out Point at ${formatTime(currentTime)} for clip ${clipNumber}`);

        // Mark session as modified
        markSessionModified();

        // Update the display
        updateInOutMarkersOnTimeline();
    }

    function clearInOutPoints() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        // Clear the In/Out points for this clip
        if (clipInOutPoints[clipNumber]) {
            delete clipInOutPoints[clipNumber];
            console.log(`Cleared In/Out points for clip ${clipNumber}`);

            // Mark session as modified
            markSessionModified();

            // Update the display
            updateInOutMarkersOnTimeline();
        }
    }

    // Update In/Out point markers on timeline
    function updateInOutMarkersOnTimeline() {
        // Clear existing markers
        inOutMarkers.innerHTML = '';

        if (!selectedClipSlot || videoDuration === 0) {
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const inOut = clipInOutPoints[clipNumber];

        if (!inOut) {
            return;
        }

        // Create In Point marker
        if (inOut.inPoint !== undefined && inOut.inPoint !== null) {
            const inMarker = document.createElement('div');
            inMarker.className = 'in-marker';
            const position = (inOut.inPoint / videoDuration) * 100;
            inMarker.style.left = `${position}%`;
            inMarker.title = `In Point: ${formatTime(inOut.inPoint)}`;
            inMarker.dataset.markerType = 'in';

            // Make marker draggable
            setupInOutMarkerDrag(inMarker, clipNumber, 'in');

            inOutMarkers.appendChild(inMarker);
        }

        // Create Out Point marker
        if (inOut.outPoint !== undefined && inOut.outPoint !== null) {
            const outMarker = document.createElement('div');
            outMarker.className = 'out-marker';
            const position = (inOut.outPoint / videoDuration) * 100;
            outMarker.style.left = `${position}%`;
            outMarker.title = `Out Point: ${formatTime(inOut.outPoint)}`;
            outMarker.dataset.markerType = 'out';

            // Make marker draggable
            setupInOutMarkerDrag(outMarker, clipNumber, 'out');

            inOutMarkers.appendChild(outMarker);
        }
    }

    // Setup In/Out marker drag functionality
    function setupInOutMarkerDrag(marker, clipNumber, markerType) {
        let isDragging = false;
        let dragStarted = false;
        let dragTooltip = null;
        let wasPlayingBeforeDrag = false;

        marker.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            dragStarted = false;

            const rect = timelineTrack.getBoundingClientRect();

            function onMouseMove(moveEvent) {
                if (!dragStarted) {
                    dragStarted = true;
                    isDragging = true;
                    marker.classList.add('dragging');

                    wasPlayingBeforeDrag = !video.paused;
                    if (wasPlayingBeforeDrag) {
                        video.pause();
                        if (outputVideo) outputVideo.pause();
                    }

                    dragTooltip = document.createElement('div');
                    dragTooltip.className = 'cue-drag-tooltip';
                    document.body.appendChild(dragTooltip);
                }

                if (!isDragging) return;

                const moveX = moveEvent.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, moveX / rect.width));
                const newTime = percentage * videoDuration;

                marker.style.left = `${percentage * 100}%`;

                dragTooltip.style.left = `${moveEvent.clientX + 15}px`;
                dragTooltip.style.top = `${moveEvent.clientY - 10}px`;
                dragTooltip.textContent = `${markerType === 'in' ? 'In' : 'Out'}: ${formatTime(newTime)}`;

                // Update the In/Out point time
                if (!clipInOutPoints[clipNumber]) {
                    clipInOutPoints[clipNumber] = {};
                }

                if (markerType === 'in') {
                    clipInOutPoints[clipNumber].inPoint = newTime;
                } else {
                    clipInOutPoints[clipNumber].outPoint = newTime;
                }

                // Scrub video
                if (video && video.duration > 0) {
                    try {
                        video.currentTime = newTime;
                        if (outputVideo && outputVideo.duration > 0) {
                            outputVideo.currentTime = newTime;
                        }
                    } catch (e) {
                        console.error('Error scrubbing video:', e);
                    }
                }
            }

            function onMouseUp() {
                if (dragStarted && isDragging) {
                    isDragging = false;
                    marker.classList.remove('dragging');

                    if (dragTooltip) {
                        dragTooltip.remove();
                        dragTooltip = null;
                    }

                    if (wasPlayingBeforeDrag) {
                        video.play().catch(e => console.error('Error resuming playback:', e));
                        if (outputVideo) {
                            outputVideo.play().catch(e => console.error('Error resuming output playback:', e));
                        }
                    }

                    markSessionModified();
                }

                dragStarted = false;
                isDragging = false;

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Double-click to delete (same as cue points)
        marker.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const confirmMsg = `Delete ${markerType === 'in' ? 'In' : 'Out'} Point?`;

            if (confirm(confirmMsg)) {
                if (clipInOutPoints[clipNumber]) {
                    if (markerType === 'in') {
                        delete clipInOutPoints[clipNumber].inPoint;
                    } else {
                        delete clipInOutPoints[clipNumber].outPoint;
                    }

                    // If both are deleted, remove the object
                    if (!clipInOutPoints[clipNumber].inPoint && !clipInOutPoints[clipNumber].outPoint) {
                        delete clipInOutPoints[clipNumber];
                    }

                    markSessionModified();
                    updateInOutMarkersOnTimeline();

                    console.log(`Deleted ${markerType === 'in' ? 'In' : 'Out'} Point`);
                }
            }
        });
    }

    // Speed control functions
    function setVideoSpeed(speed) {
        if (video.src) {
            try {
                video.playbackRate = speed;

                // Also set speed for reversed video if it exists
                if (videoReverse.src) {
                    videoReverse.playbackRate = speed;
                }

                // Warn about potential instability at high speeds
                if (speed > 4.0) {
                    console.warn(`⚠️ High playback speed (${speed}x) may cause instability with some video codecs. Recommended maximum is 4x for stable playback.`);
                } else {
                    console.log(`Set video speed to ${speed}x`);
                }
            } catch (e) {
                console.error(`Error setting playback speed to ${speed}x:`, e);
                // Fallback to 1x if speed setting fails
                video.playbackRate = 1.0;
                if (videoReverse.src) {
                    videoReverse.playbackRate = 1.0;
                }
                speedSlider.value = 1.0;
                speedValue.textContent = '1.0x';
                alert(`Unable to set playback speed to ${speed}x. Reset to 1x.\n\nHigh speeds (>4x) may not be supported by this video format.`);
            }
        }
    }

    function updateSpeedControls() {
        if (!selectedClipSlot) {
            // No clip selected - reset to default
            speedSlider.value = 1.0;
            speedValue.textContent = '1.0x';
            updateSpeedPresetButtons(1.0);
            setVideoSpeed(1.0);
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const currentSpeed = clipSpeeds[clipNumber] || 1.0;

        speedSlider.value = currentSpeed;
        speedValue.textContent = `${currentSpeed}x`;
        updateSpeedPresetButtons(currentSpeed);
        setVideoSpeed(currentSpeed);
    }

    function updateSpeedPresetButtons(currentSpeed) {
        speedPresetBtns.forEach(btn => {
            const btnSpeed = parseFloat(btn.dataset.speed);
            if (Math.abs(btnSpeed - currentSpeed) < 0.01) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function changeSpeed(newSpeed) {
        if (!selectedClipSlot) {
            console.log('No clip selected for speed change');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        // Store speed for this clip
        clipSpeeds[clipNumber] = newSpeed;

        // Mark session as modified
        markSessionModified();

        // Update UI
        speedSlider.value = newSpeed;
        speedValue.textContent = `${newSpeed}x`;
        updateSpeedPresetButtons(newSpeed);

        // Apply to video if loaded
        setVideoSpeed(newSpeed);

        console.log(`Changed speed for clip ${clipNumber} to ${newSpeed}x`);
    }

    // REMOVED: updateCuePointsList() function - cue points list UI removed, cue points visible on timeline instead
    // function updateCuePointsList() { ... }

    // Jump to the first cue point of the current clip, or beginning if no cue points
    function restartClip() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src) {
            alert('No video is currently loaded');
            return;
        }

        const cuePoints = clipCuePoints[clipNumber] || [];
        const inOut = clipInOutPoints[clipNumber];

        // Get In Point (default to 0 if not set)
        const inPoint = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null) ? inOut.inPoint : 0;

        // Jump to In Point
        video.currentTime = inPoint;
        updateTimeline();

        // Find the cue index at or after In Point
        let cueIndex = -1;
        if (cuePoints.length > 0) {
            for (let i = 0; i < cuePoints.length; i++) {
                if (cuePoints[i].time >= inPoint - 0.1) { // 0.1s tolerance
                    cueIndex = i;
                    break;
                }
            }
        }
        clipCurrentCueIndex[clipNumber] = cueIndex;

        // Set flag to allow playing through cue points
        justNavigatedToCue = true;
        lastNavigatedCueTime = inPoint;
        lastNavigatedCueIndex = cueIndex; // Allow playing through first cue at In Point

        // Restart - only auto-play if global auto-play is enabled
        if (globalAutoPlayEnabled) {
            globalPlayIntent = true;
            video.play().then(() => {
                // updatePlayButtonState() removed
                if (inPoint > 0) {
                    console.log(`R key: Restarted at In Point: ${formatTime(inPoint)}`);
                } else {
                    console.log('R key: Restarted at beginning (no In Point set)');
                }
            }).catch(e => {
                console.error('Error playing from In Point:', e);
            });
        } else {
            globalPlayIntent = false;
            console.log(`R key: Jumped to In Point but not playing (auto-play disabled)`);
        }
    }

    // Navigate to the previous cue point
    function navigateToPreviousCuePoint() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src) {
            alert('No video is currently loaded');
            return;
        }

        const cuePoints = clipCuePoints[clipNumber] || [];

        if (cuePoints.length === 0) {
            alert('No cue points to navigate to');
            return;
        }

        // Get current cue index (default to 0 if not set)
        const currentIndex = clipCurrentCueIndex[clipNumber] !== undefined ? clipCurrentCueIndex[clipNumber] : 0;

        // Calculate previous index
        const prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
            // Go to beginning if we're before first cue
            video.currentTime = 0;
            // Update timeline immediately to move scrubber
            updateTimeline();
            clipCurrentCueIndex[clipNumber] = -1;

            // Set flag to allow playing through first cue
            justNavigatedToCue = true;
            lastNavigatedCueTime = 0;
            lastNavigatedCueIndex = -1;

            // Auto-play only if enabled
            if (globalAutoPlayEnabled) {
                globalPlayIntent = true;
                video.play().then(() => {
                    // updatePlayButtonState() removed
                    console.log('Q key: Jumped to beginning before first cue');
                }).catch(e => {
                    console.error('Error playing from beginning:', e);
                });
            } else {
                globalPlayIntent = false;
                console.log('Q key: Jumped to beginning but not playing (auto-play disabled)');
            }
            return;
        }

        const targetCuePoint = cuePoints[prevIndex];

        // Update current cue index to the target
        clipCurrentCueIndex[clipNumber] = prevIndex;

        // Jump backwards to the previous cue point
        video.currentTime = targetCuePoint.time;
        // Update timeline immediately to move scrubber
        updateTimeline();

        // Set flag to allow playing through this cue point
        justNavigatedToCue = true;
        lastNavigatedCueTime = targetCuePoint.time;
        lastNavigatedCueIndex = prevIndex;

        // Pressing Q means "go back and play from previous cue" - only if auto-play enabled
        if (globalAutoPlayEnabled) {
            globalPlayIntent = true;
            video.play().then(() => {
                // updatePlayButtonState() removed
                console.log(`Q key: Sequential navigation to cue ${prevIndex + 1}/${cuePoints.length} at ${formatTime(targetCuePoint.time)}`);
            }).catch(e => {
                console.error('Error playing from previous cue:', e);
            });
        } else {
            globalPlayIntent = false;
            console.log(`Q key: Navigated to cue ${prevIndex + 1} but not playing (auto-play disabled)`);
        }
    }

    // Navigate to the next cue point (mode-aware)
    function navigateToNextCuePoint() {
        if (!selectedClipSlot) {
            alert('Please select a clip first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        if (!clipVideos[clipNumber]) {
            alert('Please load a video into the selected clip first');
            return;
        }

        if (!video.src) {
            alert('No video is currently loaded');
            return;
        }

        const clipMode = clipModes[clipNumber] || 'loop';
        const cuePoints = clipCuePoints[clipNumber] || [];
        const inOut = clipInOutPoints[clipNumber];
        const currentTime = video.currentTime;

        // Get In/Out points (default to video bounds)
        const inPoint = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null) ? inOut.inPoint : 0;
        const outPoint = (inOut && inOut.outPoint !== undefined && inOut.outPoint !== null) ? inOut.outPoint : (video.duration || 0);

        // Special handling for modes with no cue points
        if (cuePoints.length === 0) {
            if (clipMode === 'forward-stop') {
                // No cue points: loop back to In Point
                video.currentTime = inPoint;
                updateTimeline();
                console.log(`[forward-stop] No cue points, looping to In Point: ${formatTime(inPoint)}`);

                if (globalAutoPlayEnabled) {
                    globalPlayIntent = true;
                    video.play().catch(e => console.error('Error playing:', e));
                }
                return;
            } else if (clipMode === 'forward-next') {
                // No cue points: go to next clip
                goToNextClip();
                return;
            } else {
                // Other modes without cue points
                console.log('No cue points to navigate to');
                return;
            }
        }

        // Check if we're currently AT any cue point (within tolerance)
        // If auto-play is enabled: play from current position (maintains linear progression)
        // If auto-play is disabled: skip to next cue (navigation still works)
        let currentCueIndex = -1;
        for (let i = 0; i < cuePoints.length; i++) {
            if (Math.abs(currentTime - cuePoints[i].time) <= 0.1) {
                currentCueIndex = i;
                break;
            }
        }

        if (currentCueIndex !== -1 && globalAutoPlayEnabled) {
            // We're AT a cue point AND auto-play is enabled
            // Check if this is the LAST cue point - if so, handle mode-specific behavior
            const isLastCuePoint = (currentCueIndex === cuePoints.length - 1);

            if (isLastCuePoint) {
                // At last cue point - handle based on mode
                if (clipMode === 'forward-next') {
                    // Advance to next clip's In Point
                    goToNextClip();
                    return;
                } else if (clipMode === 'forward-stop' || clipMode === 'loop') {
                    // Loop back to In Point
                    video.currentTime = inPoint;
                    updateTimeline();
                    clipCurrentCueIndex[clipNumber] = -1;
                    console.log(`W key: At last cue, looping to In Point: ${formatTime(inPoint)}`);

                    globalPlayIntent = true;
                    video.play().catch(e => console.error('Error playing:', e));
                    return;
                }
            }

            // Not at last cue - JUMP to next cue immediately (for instant progression)
            const nextCueIndex = currentCueIndex + 1;
            const nextCuePoint = cuePoints[nextCueIndex];

            // Jump to next cue point
            video.currentTime = nextCuePoint.time;
            updateTimeline();

            clipCurrentCueIndex[clipNumber] = nextCueIndex;
            justNavigatedToCue = true;
            lastNavigatedCueTime = nextCuePoint.time;
            lastNavigatedCueIndex = nextCueIndex;

            console.log(`W key: Jumped to next cue ${nextCueIndex + 1}/${cuePoints.length} at ${formatTime(nextCuePoint.time)}`);

            globalPlayIntent = true;
            video.play().then(() => {
                // Video will play forward and stop at next cue (forward-stop mode)
            }).catch(e => {
                console.error('Error playing from next cue:', e);
            });
            return;
        }
        // If at cue point but auto-play disabled: continue below to find next cue and jump to it

        // Find next cue point after current time
        let targetCuePoint = null;
        let targetIndex = -1;

        for (let i = 0; i < cuePoints.length; i++) {
            if (cuePoints[i].time > currentTime + 0.1) { // 0.1 second tolerance
                targetCuePoint = cuePoints[i];
                targetIndex = i;
                break;
            }
        }

        // Mode-specific behavior when no cue ahead (but cue points exist)
        if (!targetCuePoint) {
            if (clipMode === 'forward-stop') {
                // At or past last cue/Out Point: loop back to In Point
                if (currentTime >= outPoint - 0.1) {
                    video.currentTime = inPoint;
                    updateTimeline();
                    clipCurrentCueIndex[clipNumber] = -1;
                    console.log(`[forward-stop] At Out Point, looping to In Point: ${formatTime(inPoint)}`);

                    if (globalAutoPlayEnabled) {
                        globalPlayIntent = true;
                        video.play().catch(e => console.error('Error playing:', e));
                    }
                    return;
                } else {
                    console.log('No more cue points ahead');
                    return;
                }
            } else if (clipMode === 'forward-next') {
                // No more cue points: go to next clip
                goToNextClip();
                return;
            } else if (clipMode === 'loop') {
                // Loop mode: loop back to In Point when no cue ahead
                video.currentTime = inPoint;
                updateTimeline();
                clipCurrentCueIndex[clipNumber] = -1;
                console.log(`[loop] At last cue, looping to In Point: ${formatTime(inPoint)}`);

                if (globalAutoPlayEnabled) {
                    globalPlayIntent = true;
                    video.play().catch(e => console.error('Error playing:', e));
                }
                return;
            } else {
                console.log('No more cue points ahead');
                return;
            }
        }

        // Check if we're already AT this cue point (within tolerance)
        const distanceToCue = Math.abs(currentTime - targetCuePoint.time);

        if (distanceToCue > 0.1) {
            // NOT at the cue - JUMP to it
            video.currentTime = targetCuePoint.time;
            updateTimeline();
            console.log(`W key: Jumped to cue ${targetIndex + 1}/${cuePoints.length} at ${formatTime(targetCuePoint.time)}`);
        } else {
            // Already AT the cue - just play from here
            console.log(`W key: Playing from current cue ${targetIndex + 1}/${cuePoints.length} at ${formatTime(targetCuePoint.time)}`);
        }

        // Update current cue index for state tracking
        clipCurrentCueIndex[clipNumber] = targetIndex;

        // Set flag to allow playing through this cue point
        justNavigatedToCue = true;
        lastNavigatedCueTime = targetCuePoint.time;
        lastNavigatedCueIndex = targetIndex;

        // Start playing - only if global auto-play is enabled
        if (globalAutoPlayEnabled) {
            globalPlayIntent = true;
            video.play().then(() => {
                // updatePlayButtonState() removed
            }).catch(e => {
                console.error('Error playing to next cue:', e);
            });
        } else {
            globalPlayIntent = false;
            console.log('Navigated to cue point but not playing (auto-play disabled)');
        }
    }

    // Navigate to next clip (for forward-next mode)
    function goToNextClip() {
        if (!selectedClipSlot) return;

        const currentClipNumber = parseInt(selectedClipSlot.dataset.clipNumber);

        // Find next clip with video in current tab
        let nextClipNumber = null;
        for (let i = currentClipNumber + 1; i < 36; i++) {
            if (clipVideos[i]) {
                nextClipNumber = i;
                break;
            }
        }

        // If no clip ahead, loop to first clip with video
        if (nextClipNumber === null) {
            for (let i = 0; i <= currentClipNumber; i++) {
                if (clipVideos[i]) {
                    nextClipNumber = i;
                    break;
                }
            }
        }

        if (nextClipNumber !== null) {
            const nextSlot = document.querySelector(`[data-clip-number="${nextClipNumber}"]`);
            if (nextSlot) {
                selectClipSlot(nextSlot);
                console.log(`[forward-next] Advanced to next clip: ${nextClipNumber}`);
            }
        } else {
            console.log('[forward-next] No other clips with video to advance to');
        }
    }

    // Timeline functionality
    let isDragging = false;
    let videoDuration = 0;

    // Track when we just navigated to a cue point (to allow playing through it)
    let justNavigatedToCue = false;
    let lastNavigatedCueTime = 0;
    let lastNavigatedCueIndex = -1; // Track which cue point we just navigated to

    // Format time for timeline display (MM:SS)
    function formatTimeShort(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Update timeline progress and handle position
    function updateTimeline() {
        if (!video.src || videoDuration === 0) {
            timelineProgress.style.width = '0%';
            timelineHandle.style.left = '0%';
            currentTimeDisplay.textContent = '00:00';
            totalDurationDisplay.textContent = '00:00';
            return;
        }

        // Check which video is currently playing (forward or reverse for bounce mode)
        const isReversePlaying = videoReverse.style.display === 'block' && !videoReverse.paused;
        const currentTime = isReversePlaying ? videoReverse.currentTime : video.currentTime;

        // Calculate progress (reverse video plays 0→end, but timeline should show end→0)
        let progress;
        if (isReversePlaying) {
            // Reverse video plays from 0 to end, so invert the progress for timeline
            progress = 100 - ((currentTime / videoDuration) * 100);
        } else {
            progress = (currentTime / videoDuration) * 100;
        }

        if (!isDragging) {
            timelineProgress.style.width = `${progress}%`;
            timelineHandle.style.left = `${progress}%`;

            // Auto-scroll zoomed timeline to follow playback (works for both directions)
            if (timelineZoomLevel > 1 && (isReversePlaying || !video.paused)) {
                const container = timelineTrack.parentElement;
                const scrollPosition = (container.scrollWidth * progress / 100) - (container.clientWidth / 2);
                container.scrollLeft = Math.max(0, scrollPosition);
            }
        }

        // Display time (shows the actual position in the original video timeline)
        const displayTime = isReversePlaying ? (videoDuration - currentTime) : currentTime;
        currentTimeDisplay.textContent = formatTimeShort(displayTime);
        totalDurationDisplay.textContent = formatTimeShort(videoDuration);
    }

    // Smooth timeline update using requestAnimationFrame for 60fps updates
    function smoothUpdateTimeline() {
        updateTimeline();

        // Continue updating at 60fps while EITHER video is playing (forward or reverse for bounce mode)
        const isForwardPlaying = !video.paused && !video.ended;
        const isReversePlaying = videoReverse.style.display === 'block' && !videoReverse.paused && !videoReverse.ended;

        if (isForwardPlaying || isReversePlaying) {
            timelineAnimationFrame = requestAnimationFrame(smoothUpdateTimeline);
        }
    }

    // Start smooth timeline updates
    function startSmoothTimelineUpdates() {
        if (timelineAnimationFrame) {
            cancelAnimationFrame(timelineAnimationFrame);
        }
        timelineAnimationFrame = requestAnimationFrame(smoothUpdateTimeline);
    }

    // Stop smooth timeline updates
    function stopSmoothTimelineUpdates() {
        if (timelineAnimationFrame) {
            cancelAnimationFrame(timelineAnimationFrame);
            timelineAnimationFrame = null;
        }
    }

    // Set timeline zoom level
    function setTimelineZoom(zoomLevel) {
        timelineZoomLevel = zoomLevel;

        // Apply zoom to timeline track width
        timelineTrack.style.width = `${100 * zoomLevel}%`;

        // Update active button state
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            if (parseInt(btn.dataset.zoom) === zoomLevel) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Scroll to keep current playback position in view
        const container = timelineTrack.parentElement;
        const progress = video.currentTime / videoDuration;
        const scrollPosition = (container.scrollWidth * progress) - (container.clientWidth / 2);
        container.scrollLeft = Math.max(0, scrollPosition);

        console.log(`Timeline zoom set to ${zoomLevel}x`);
    }

    // Toggle global auto-play
    function toggleGlobalAutoPlay() {
        globalAutoPlayEnabled = !globalAutoPlayEnabled;
        autoPlayToggle.checked = globalAutoPlayEnabled;
        markSessionModified();
        console.log(`Global auto-play ${globalAutoPlayEnabled ? 'enabled' : 'disabled'}`);
    }

    // Pause/Play video toggle
    function pausePlayVideo() {
        if (!video.src) {
            console.log('No video loaded, cannot pause/play');
            return;
        }

        if (video.paused) {
            // Video is paused, play it
            globalPlayIntent = true;
            video.play().then(() => {
                console.log('Video playing (spacebar)');
                if (outputVideo) {
                    outputVideo.play().catch(e => console.error('Error playing output video:', e));
                }
            }).catch(e => {
                console.error('Error playing video:', e);
            });
        } else {
            // Video is playing, pause it
            globalPlayIntent = false;
            video.pause();
            console.log('Video paused (spacebar)');
            if (outputVideo) {
                outputVideo.pause();
            }
        }
    }

    // Cue marker drag tooltip element
    let cueMarkerDragTooltip = null;

    // Setup cue marker drag functionality
    function setupCueMarkerDrag(marker, clipNumber, cueIndex) {
        let isDraggingCue = false;
        let dragTooltip = null;
        let wasPlayingBeforeDrag = false;
        let dragStarted = false;

        marker.addEventListener('mousedown', function(e) {
            // Only left click for dragging
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation(); // Prevent timeline click

            // Don't set isDraggingCue yet - wait for actual mouse movement
            dragStarted = false;
            // marker.classList.add('dragging'); // Don't add class until actual drag

            const rect = timelineTrack.getBoundingClientRect();

            function onMouseMove(moveEvent) {
                // Start dragging only after actual mouse movement
                if (!dragStarted) {
                    dragStarted = true;
                    isDraggingCue = true;
                    marker.classList.add('dragging');

                    // Store play state and pause video for scrubbing
                    wasPlayingBeforeDrag = !video.paused;
                    if (wasPlayingBeforeDrag) {
                        video.pause();
                        if (outputVideo) outputVideo.pause();
                    }

                    // Create tooltip
                    dragTooltip = document.createElement('div');
                    dragTooltip.className = 'cue-drag-tooltip';
                    document.body.appendChild(dragTooltip);
                }

                if (!isDraggingCue) return;

                // Calculate new position
                const moveX = moveEvent.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, moveX / rect.width));
                const newTime = percentage * videoDuration;

                // Update marker position visually
                marker.style.left = `${percentage * 100}%`;

                // Update tooltip
                dragTooltip.style.left = `${moveEvent.clientX + 15}px`;
                dragTooltip.style.top = `${moveEvent.clientY - 10}px`;
                dragTooltip.textContent = `Cue ${cueIndex + 1}: ${formatTime(newTime)}`;

                // Update the actual cue point time in the data
                clipCuePoints[clipNumber][cueIndex].time = newTime;

                // Scrub video to show the cue point position during drag
                if (video && video.duration > 0) {
                    try {
                        video.currentTime = newTime;
                        // Also update output window if open
                        if (outputVideo && outputVideo.duration > 0) {
                            outputVideo.currentTime = newTime;
                        }
                        console.log(`Scrubbing to: ${formatTime(newTime)}`);
                    } catch (e) {
                        console.error('Error scrubbing video:', e);
                    }
                }

                // Update cue points list in real-time
                // updateCuePointsList(); // REMOVED - cue points visible on timeline
            }

            function onMouseUp() {
                // Only do cleanup if a drag actually occurred
                if (dragStarted && isDraggingCue) {
                    isDraggingCue = false;
                    marker.classList.remove('dragging');

                    // Remove tooltip
                    if (dragTooltip) {
                        dragTooltip.remove();
                        dragTooltip = null;
                    }

                    // Restore playing state if it was playing before drag
                    if (wasPlayingBeforeDrag) {
                        video.play().catch(e => console.error('Error resuming playback:', e));
                        if (outputVideo) {
                            outputVideo.play().catch(e => console.error('Error resuming output playback:', e));
                        }
                    }

                    // Sort cue points by time after dragging
                    clipCuePoints[clipNumber].sort((a, b) => a.time - b.time);

                    // Refresh markers to show correct order
                    updateCueMarkersOnTimeline();

                    // Update list with sorted order
                    // updateCuePointsList(); // REMOVED - cue points visible on timeline

                    // Mark session as modified
                    markSessionModified();
                }

                // Reset drag state
                dragStarted = false;
                isDraggingCue = false;

                // Clean up event listeners
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                console.log(`Moved cue point ${cueIndex + 1} to ${formatTime(clipCuePoints[clipNumber][cueIndex].time)}`);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // Setup cue marker double-click delete functionality
    function setupCueMarkerDelete(marker, clipNumber, cueIndex) {
        marker.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const cuePoint = clipCuePoints[clipNumber][cueIndex];
            const confirmMsg = `Delete cue point ${cueIndex + 1} at ${formatTime(cuePoint.time)}?`;

            if (confirm(confirmMsg)) {
                // Remove the cue point from the array
                clipCuePoints[clipNumber].splice(cueIndex, 1);

                // Mark session as modified
                markSessionModified();

                // Refresh markers and list
                updateCueMarkersOnTimeline();
                // updateCuePointsList(); // REMOVED - cue points visible on timeline

                console.log(`Deleted cue point ${cueIndex + 1}`);
            }
        });
    }

    // Update cue point markers on timeline
    function updateCueMarkersOnTimeline() {
        if (!selectedClipSlot) {
            cueMarkers.innerHTML = '';
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const cuePoints = clipCuePoints[clipNumber] || [];

        // Clear existing markers
        cueMarkers.innerHTML = '';

        if (videoDuration === 0 || cuePoints.length === 0) {
            return;
        }

        // Create markers for each cue point
        cuePoints.forEach((cuePoint, index) => {
            const marker = document.createElement('div');
            marker.className = 'cue-marker';
            const position = (cuePoint.time / videoDuration) * 100;
            marker.style.left = `${position}%`;
            marker.title = `Cue ${index + 1}: ${formatTime(cuePoint.time)}`;
            marker.dataset.cueIndex = index;
            marker.dataset.clipNumber = clipNumber;

            // Make marker draggable
            setupCueMarkerDrag(marker, clipNumber, index);

            // Make marker deletable with double-click
            setupCueMarkerDelete(marker, clipNumber, index);

            cueMarkers.appendChild(marker);
        });
    }

    // Handle timeline click to scrub
    function handleTimelineClick(event) {
        if (!video.src || videoDuration === 0) {
            return;
        }

        const rect = timelineTrack.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = Math.max(0, Math.min(videoDuration, percentage * videoDuration));

        video.currentTime = newTime;
        updateTimeline();
    }

    // Handle timeline drag functionality
    function handleTimelineDrag(event) {
        event.preventDefault();
        isDragging = true;

        const container = timelineTrack.parentElement;

        function onMouseMove(e) {
            if (!isDragging || videoDuration === 0) return;

            // Auto-scroll when dragging near container edges (when zoomed)
            if (timelineZoomLevel > 1) {
                const containerRect = container.getBoundingClientRect();
                const edgeThreshold = 50; // pixels from edge to trigger scroll
                const scrollSpeed = 15; // pixels to scroll per frame

                if (e.clientX < containerRect.left + edgeThreshold) {
                    // Near left edge - scroll left
                    container.scrollLeft = Math.max(0, container.scrollLeft - scrollSpeed);
                } else if (e.clientX > containerRect.right - edgeThreshold) {
                    // Near right edge - scroll right
                    const maxScroll = container.scrollWidth - container.clientWidth;
                    container.scrollLeft = Math.min(maxScroll, container.scrollLeft + scrollSpeed);
                }
            }

            // Recalculate rect after potential scroll
            const rect = timelineTrack.getBoundingClientRect();

            const moveX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, moveX / rect.width));
            const newTime = percentage * videoDuration;

            video.currentTime = newTime;

            // Update visual feedback immediately
            timelineProgress.style.width = `${percentage * 100}%`;
            timelineHandle.style.left = `${percentage * 100}%`;
            currentTimeDisplay.textContent = formatTimeShort(newTime);
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            updateTimeline(); // Final update
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // Switch to a different tab
    function switchTab(tabIndex) {
        if (tabIndex === currentTab) {
            return; // Already on this tab
        }

        console.log(`Switching from tab ${currentTab} to tab ${tabIndex}`);

        // Update tab button appearance
        const allTabButtons = document.querySelectorAll('.tab-btn');
        allTabButtons.forEach((btn) => {
            const btnTabIndex = parseInt(btn.dataset.tab);
            if (btnTabIndex === tabIndex) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Save current tab state and switch to new tab
        currentTab = tabIndex;

        // Update legacy references to point to new tab's data
        clipVideos = tabClipVideos[currentTab];
        clipReversedVideos = tabClipReversedVideos[currentTab];
        clipCuePoints = tabClipCuePoints[currentTab];
        clipSpeeds = tabClipSpeeds[currentTab];
        clipNames = tabClipNames[currentTab];
        clipModes = tabClipModes[currentTab];
        clipCurrentCueIndex = tabClipCurrentCueIndex[currentTab];
        clipInOutPoints = tabClipInOutPoints[currentTab];

        // Clear current selection (each tab has its own selection)
        if (selectedClipSlot) {
            selectedClipSlot.classList.remove('selected');
            selectedClipSlot = null;
        }

        // Refresh the matrix to show the new tab's videos
        refreshClipMatrix();

        // Clear video player if no clip is selected in new tab
        video.src = '';
        video.load();

        // Update UI for new tab
        // updateCuePointsList(); // REMOVED - cue points visible on timeline
        updateCueMarkersOnTimeline();
        updateInOutMarkersOnTimeline();
        updateSpeedControls();
        // updatePlayButtonState() removed
    }

    // Add a new tab
    function addNewTab() {
        const newTabIndex = nextTabIndex++;
        allTabs.push(newTabIndex);

        // Initialize data structures for new tab
        tabClipVideos[newTabIndex] = {};
        tabClipReversedVideos[newTabIndex] = {};
        tabClipCuePoints[newTabIndex] = {};
        tabClipSpeeds[newTabIndex] = {};
        tabClipNames[newTabIndex] = {};
        tabClipModes[newTabIndex] = {};
        tabClipCurrentCueIndex[newTabIndex] = {};
        tabClipInOutPoints[newTabIndex] = {};

        // Create tab button
        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-btn';
        tabBtn.dataset.tab = newTabIndex;

        const tabName = `Tab ${allTabs.length}`;
        tabBtn.innerHTML = `<span class="tab-btn-text">${tabName}</span><button class="remove-tab-btn" title="Remove tab">×</button>`;

        // Add event handlers
        setupTabEventHandlers(tabBtn, newTabIndex);

        // Insert before the add button
        const addTabBtn = document.getElementById('addTabBtn');
        tabBar.insertBefore(tabBtn, addTabBtn);

        // Mark session as modified
        markSessionModified();

        console.log(`Added new tab ${newTabIndex}`);
    }

    // Setup event handlers for a tab button
    function setupTabEventHandlers(tabBtn, tabIndex) {
        // Click handler for tab switching
        tabBtn.addEventListener('click', function(e) {
            // Don't switch tab if clicking remove button or editing text
            if (!e.target.classList.contains('remove-tab-btn') &&
                !e.target.classList.contains('tab-btn-text')) {
                switchTab(tabIndex);
            }
        });

        // Double-click handler for renaming
        const textSpan = tabBtn.querySelector('.tab-btn-text');
        if (textSpan) {
            textSpan.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                startEditingTabName(tabIndex, textSpan);
            });

            // Single click on text should switch tabs
            textSpan.addEventListener('click', function(e) {
                e.stopPropagation();
                switchTab(tabIndex);
            });
        }

        // Remove button handler
        const removeBtn = tabBtn.querySelector('.remove-tab-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                removeTab(tabIndex);
            });
        }
    }

    // Start editing a tab name
    function startEditingTabName(tabIndex, textElement) {
        const arrayIndex = allTabs.indexOf(tabIndex);
        const currentName = tabCustomNames[tabIndex] || `Tab ${arrayIndex + 1}`;

        textElement.contentEditable = true;
        textElement.classList.add('editing');
        textElement.textContent = currentName;
        textElement.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(textElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Save on blur or Enter key
        function finishEditing() {
            textElement.contentEditable = false;
            textElement.classList.remove('editing');

            const newName = textElement.textContent.trim();
            const defaultName = `Tab ${arrayIndex + 1}`;

            if (newName && newName !== defaultName) {
                tabCustomNames[tabIndex] = newName;
                markSessionModified();
                console.log(`Renamed tab ${tabIndex} to "${newName}"`);
            } else {
                // Reset to default if empty
                delete tabCustomNames[tabIndex];
                textElement.textContent = defaultName;
            }

            textElement.removeEventListener('blur', finishEditing);
            textElement.removeEventListener('keydown', handleKeydown);
        }

        function handleKeydown(e) {
            // Stop ALL keyboard events from bubbling to prevent global shortcuts
            e.stopPropagation();

            if (e.key === 'Enter') {
                e.preventDefault();
                textElement.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                textElement.textContent = currentName;
                textElement.blur();
            }
        }

        textElement.addEventListener('blur', finishEditing);
        textElement.addEventListener('keydown', handleKeydown);
    }

    // Rebuild the entire tab bar from allTabs array
    function rebuildTabBar() {
        // Remove all tab buttons except the add button
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => btn.remove());

        // Recreate tab buttons
        const addTabButton = document.getElementById('addTabBtn');
        allTabs.forEach((tabIndex, arrayIndex) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-btn';
            if (tabIndex === currentTab) {
                tabBtn.classList.add('active');
            }
            tabBtn.dataset.tab = tabIndex;

            // Use custom name if available, otherwise use position
            const tabName = tabCustomNames[tabIndex] || `Tab ${arrayIndex + 1}`;
            tabBtn.innerHTML = `<span class="tab-btn-text">${tabName}</span><button class="remove-tab-btn" title="Remove tab">×</button>`;

            // Add event handlers
            setupTabEventHandlers(tabBtn, tabIndex);

            // Insert before the add button
            tabBar.insertBefore(tabBtn, addTabButton);
        });
    }

    // Remove a tab
    function removeTab(tabIndex) {
        // Don't allow removing the last tab
        if (allTabs.length <= 1) {
            alert('Cannot remove the last tab');
            return;
        }

        // Confirm deletion
        const tabName = tabCustomNames[tabIndex] || `Tab ${allTabs.indexOf(tabIndex) + 1}`;
        if (!confirm(`Remove "${tabName}"? All clips and data in this tab will be lost.`)) {
            return;
        }

        // Remove from allTabs array
        const tabArrayIndex = allTabs.indexOf(tabIndex);
        allTabs.splice(tabArrayIndex, 1);

        // Clean up data
        if (tabClipVideos[tabIndex]) {
            Object.keys(tabClipVideos[tabIndex]).forEach(clipNumber => {
                if (tabClipVideos[tabIndex][clipNumber]?.url) {
                    URL.revokeObjectURL(tabClipVideos[tabIndex][clipNumber].url);
                }
            });
        }
        delete tabClipVideos[tabIndex];
        delete tabClipCuePoints[tabIndex];
        delete tabClipSpeeds[tabIndex];
        delete tabClipNames[tabIndex];
        delete tabClipModes[tabIndex];
        delete tabCustomNames[tabIndex];

        // Remove tab button from UI
        const tabBtn = document.querySelector(`[data-tab="${tabIndex}"]`);
        if (tabBtn) {
            tabBtn.remove();
        }

        // If we're on the removed tab, switch to the first available tab
        if (currentTab === tabIndex) {
            switchTab(allTabs[0]);
        }

        // Mark session as modified
        markSessionModified();

        console.log(`Removed tab ${tabIndex}`);
    }

    // Refresh the clip matrix to show current tab's video states
    function refreshClipMatrix() {
        console.log('=== REFRESHING CLIP MATRIX ===');
        console.log('Current tab:', currentTab);
        console.log('Current clipVideos:', clipVideos);

        const allSlots = document.querySelectorAll('.clip-slot');
        console.log(`Found ${allSlots.length} clip slots`);

        allSlots.forEach(slot => {
            const clipNumber = slot.dataset.clipNumber;
            const hasVideo = clipVideos[clipNumber];
            console.log(`Slot ${clipNumber}: hasVideo =`, hasVideo);

            if (hasVideo) {
                console.log(`Updating slot ${clipNumber} with video: ${hasVideo.name}`);
                updateSlotAppearance(slot, hasVideo);
            } else {
                console.log(`Slot ${clipNumber} has no video, showing empty`);
                updateSlotAppearance(slot, false);
            }
        });
        console.log('=== CLIP MATRIX REFRESH COMPLETE ===');
    }

    // File Browser Functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileExtension(filename) {
        return filename.toLowerCase().substring(filename.lastIndexOf('.'));
    }

    function isVideoFile(filename) {
        const ext = getFileExtension(filename);
        return videoExtensions.includes(ext);
    }

    function displayFiles(files) {
        fileList.innerHTML = '';

        if (!files || files.length === 0) {
            const noFilesItem = document.createElement('div');
            noFilesItem.className = 'file-item other-file';
            noFilesItem.innerHTML = `
                <span class="file-name">No files found</span>
                <span class="file-size"></span>
            `;
            fileList.appendChild(noFilesItem);
            return;
        }

        files.forEach(file => {
            const fileItem = document.createElement('div');
            const isVideo = isVideoFile(file.name);
            const fileSize = file.size ? formatFileSize(file.size) : '';

            fileItem.className = `file-item ${isVideo ? 'video-file' : 'other-file'}`;
            fileItem.innerHTML = `
                <span class="file-name" title="${file.name}">${file.name}</span>
                <span class="file-size">${fileSize}</span>
            `;

            // Add click handler and drag functionality for video files
            if (isVideo) {
                // Make video files draggable
                fileItem.draggable = true;
                fileItem.classList.add('draggable');

                // Click to load handler
                fileItem.addEventListener('click', function() {
                    loadVideoFromFile(file);
                    // Also try to auto-connect to any session slots waiting for this file
                    autoConnectSessionVideo(file);
                });

                // Drag start handler
                fileItem.addEventListener('dragstart', function(e) {
                    fileItem.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: 'video'
                    }));
                    // Store file reference for drop handler
                    window.draggedFile = file;
                    console.log('Started dragging:', file.name);
                });

                // Drag end handler
                fileItem.addEventListener('dragend', function(e) {
                    fileItem.classList.remove('dragging');
                    window.draggedFile = null;
                    console.log('Finished dragging:', file.name);
                });

                fileItem.style.cursor = 'pointer';
                fileItem.title = `Click to load ${file.name} into selected clip slot, or drag to any clip slot`;
            }

            fileList.appendChild(fileItem);
        });

        console.log('=== PROCESSING FILES FOR AUTO-CONNECTION ===');
        console.log(`Found ${files.length} files in folder`);

        // After displaying all files, try to auto-connect session videos
        let totalConnections = 0;
        files.forEach(file => {
            if (isVideoFile(file.name)) {
                console.log(`Processing video file: ${file.name}`);
                const connections = autoConnectSessionVideo(file);
                totalConnections += connections;
            } else {
                console.log(`Skipping non-video file: ${file.name}`);
            }
        });

        console.log(`=== TOTAL AUTO-CONNECTIONS MADE: ${totalConnections} ===`);

        // Refresh the current tab's UI to show any newly connected videos
        console.log('Refreshing clip matrix...');
        refreshClipMatrix();
        console.log('Clip matrix refreshed');
    }

    function loadVideoFromFile(file) {
        if (!selectedClipSlot) {
            alert('Please select a clip slot first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;

        // DEBUG: Log file object properties
        console.log('=== LOADING FILE ===');
        console.log('File object:', file);
        console.log('file.name:', file.name);
        console.log('file.path:', file.path);
        console.log('file.type:', file.type);

        // In Electron, use file:// protocol path instead of blob URLs
        const filePath = file.path || file.name; // file.path from Electron directory reading
        const url = `file:///${filePath.replace(/\\/g, '/')}`;

        console.log(`Loading video from Electron file path: ${url}`);

        // Auto-update folder path if we have a full path and folder isn't set yet
        if (file.path && file.path.includes('\\')) {
            const folderPath = file.path.substring(0, file.path.lastIndexOf('\\'));
            if (!currentFolderPath || currentFolderPath === '' || !currentFolderPath.includes('\\')) {
                currentFolderPath = folderPath;
                // currentPathDisplay.textContent = currentFolderPath; // REMOVED - file browser removed
                console.log('Auto-detected folder path from video file:', currentFolderPath);
            }
        }

        // Store video information
        clipVideos[clipNumber] = {
            name: file.name,
            url: url,
            file: file,
            filePath: filePath,
            thumbnail: null // Will be set after generation
        };

        // Mark session as modified
        markSessionModified();

        // Update slot appearance (without thumbnail initially)
        updateSlotAppearance(selectedClipSlot, clipVideos[clipNumber]);

        // Generate thumbnail asynchronously
        generateThumbnail(file, function(thumbnailUrl) {
            if (thumbnailUrl && clipVideos[clipNumber]) {
                clipVideos[clipNumber].thumbnail = thumbnailUrl;
                // Update slot appearance with thumbnail
                updateSlotAppearance(selectedClipSlot, clipVideos[clipNumber]);
                console.log(`Generated thumbnail for clip ${clipNumber}`);
            }
        });

        // Load video in player
        video.src = url;

        // Performance: Ensure audio is disabled
        video.muted = true;
        video.volume = 0;

        video.load();

        // Apply speed when video loads
        video.addEventListener('loadeddata', function() {
            const clipSpeed = clipSpeeds[clipNumber] || 1.0;
            setVideoSpeed(clipSpeed);

            // Ensure audio stays disabled after load
            video.muted = true;
            video.volume = 0;
        }, { once: true });

        console.log(`Loaded video ${file.name} into clip slot ${clipNumber}`);

        // Initialize empty cue points array for this clip if it doesn't exist
        if (!clipCuePoints[clipNumber]) {
            clipCuePoints[clipNumber] = [];
        }

        // updateCuePointsList(); // REMOVED - cue points visible on timeline
        updateCueMarkersOnTimeline();
        updateInOutMarkersOnTimeline();

        // Check if this clip is set to bounce mode - if so, generate/load reversed video
        const clipMode = clipModes[clipNumber] || 'loop';
        if (clipMode === 'bounce') {
            loadReversedVideoForBounceMode(clipNumber, filePath);
        }
    }

    // Generate/load reversed video for bounce mode
    async function loadReversedVideoForBounceMode(clipNumber, filePath) {
        try {
            console.log(`Checking for reversed video for clip ${clipNumber}...`);

            // Check if reversed video already exists
            const checkResult = await window.electronAPI.checkReversedVideo(filePath);

            if (checkResult.exists) {
                // Load existing reversed video
                console.log(`Reversed video exists: ${checkResult.path}`);
                const reversedUrl = `file:///${checkResult.path.replace(/\\/g, '/')}`;
                clipReversedVideos[clipNumber] = {
                    path: checkResult.path,
                    url: reversedUrl
                };

                // If this is the currently selected clip, load reversed video into element
                if (selectedClipSlot && selectedClipSlot.dataset.clipNumber == clipNumber) {
                    videoReverse.src = reversedUrl;
                    videoReverse.load();
                    console.log(`Loaded reversed video into player for clip ${clipNumber}`);
                }
            } else {
                // Generate reversed video
                console.log(`Generating reversed video for clip ${clipNumber}...`);
                showReversalProgress(clipNumber, 'Starting...');

                const result = await window.electronAPI.generateReversedVideo(filePath);

                if (result.success) {
                    const reversedUrl = `file:///${result.path.replace(/\\/g, '/')}`;
                    clipReversedVideos[clipNumber] = {
                        path: result.path,
                        url: reversedUrl
                    };

                    // If this is the currently selected clip, load reversed video into element
                    if (selectedClipSlot && selectedClipSlot.dataset.clipNumber == clipNumber) {
                        videoReverse.src = reversedUrl;
                        videoReverse.load();
                        console.log(`Loaded newly generated reversed video into player for clip ${clipNumber}`);
                    }

                    showReversalProgress(clipNumber, 'Complete!');
                    setTimeout(() => hideReversalProgress(clipNumber), 2000);
                } else {
                    console.error(`Failed to generate reversed video: ${result.error}`);
                    alert(`Failed to generate reversed video: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Error loading reversed video:', error);
            alert(`Error loading reversed video: ${error.message}`);
        }
    }

    // Show reversal progress indicator
    function showReversalProgress(clipNumber, message) {
        console.log(`Clip ${clipNumber}: ${message}`);
        // TODO: Add UI progress indicator in clip slot or status bar
    }

    // Hide reversal progress indicator
    function hideReversalProgress(clipNumber) {
        console.log(`Clip ${clipNumber}: Progress hidden`);
        // TODO: Hide UI progress indicator
    }

    // Listen for reversal progress updates from main process
    if (window.electronAPI.onReverseVideoProgress) {
        window.electronAPI.onReverseVideoProgress((data) => {
            console.log(`Reversal progress: ${data.percent.toFixed(1)}% - ${data.timemark}`);
            // TODO: Update UI progress indicator
        });
    }

    // File browser removed - drag videos from OS file explorer directly onto clip slots

    // Keyboard shortcuts functions
    function parseKeyboardShortcut(shortcut) {
        const parts = shortcut.split('+');
        const key = parts[parts.length - 1];
        const modifiers = parts.slice(0, -1);

        return {
            key: key,
            shift: modifiers.includes('Shift'),
            ctrl: modifiers.includes('Ctrl'),
            alt: modifiers.includes('Alt'),
            meta: modifiers.includes('Meta')
        };
    }

    function matchesShortcut(event, shortcut) {
        if (shortcutsModalOpen) return false; // Don't trigger shortcuts when modal is open

        const parsed = parseKeyboardShortcut(shortcut);

        // Handle special keys
        let eventKey = event.key;
        if (eventKey === ' ') eventKey = 'Space';

        return (
            eventKey === parsed.key &&
            event.shiftKey === parsed.shift &&
            event.ctrlKey === parsed.ctrl &&
            event.altKey === parsed.alt &&
            event.metaKey === parsed.meta
        );
    }

    function handleKeyboardShortcuts(event) {
        // Don't trigger shortcuts if typing in an input field or editing content
        if (event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA' ||
            event.target.isContentEditable === true ||
            event.target.getAttribute('contenteditable') === 'true') {
            return;
        }

        // Check each shortcut
        for (const [action, shortcut] of Object.entries(keyboardShortcuts)) {
            if (matchesShortcut(event, shortcut)) {
                event.preventDefault();
                event.stopPropagation();

                switch (action) {
                    case 'previousClip':
                        prevClipBtn.click();
                        break;
                    case 'nextClip':
                        nextClipBtn.click();
                        break;
                    case 'previousCuePoint':
                        prevCuePointBtn.click();
                        break;
                    case 'nextCuePoint':
                        nextCuePointBtn.click();
                        break;
                    case 'restartClip':
                        restartClipBtn.click();
                        break;
                    case 'recordCuePoint':
                        recordCuePointBtn.click();
                        break;
                    case 'setInPoint':
                        setInPointBtn.click();
                        break;
                    case 'setOutPoint':
                        setOutPointBtn.click();
                        break;
                    case 'clearInOut':
                        clearInOutBtn.click();
                        break;
                    case 'zoomIn':
                        // Cycle through zoom levels: 1 -> 2 -> 4 -> 8
                        if (timelineZoomLevel < 8) {
                            setTimelineZoom(timelineZoomLevel * 2);
                        }
                        break;
                    case 'zoomOut':
                        // Cycle through zoom levels: 8 -> 4 -> 2 -> 1
                        if (timelineZoomLevel > 1) {
                            setTimelineZoom(timelineZoomLevel / 2);
                        }
                        break;
                    case 'pausePlay':
                        pausePlayVideo();
                        break;
                    case 'tab1':
                        switchTab(0);
                        break;
                    case 'tab2':
                        switchTab(1);
                        break;
                    case 'tab3':
                        switchTab(2);
                        break;
                    case 'tab4':
                        switchTab(3);
                        break;
                    case 'tab5':
                        switchTab(4);
                        break;
                    case 'speedPreset0.5':
                        changeSpeed(0.5);
                        break;
                    case 'speedPreset1':
                        changeSpeed(1.0);
                        break;
                    case 'speedPreset1.5':
                        changeSpeed(1.5);
                        break;
                    case 'speedPreset2':
                        changeSpeed(2.0);
                        break;
                }
                return;
            }
        }
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // ==============================================================
    // MIDI MESSAGE HANDLING
    // ==============================================================

    // Debounce configuration for MIDI triggers (prevents double-triggers from controller noise)
    const MIDI_DEBOUNCE_MS = 15; // 15ms debounce - allows rapid drumming while preventing noise
    const midiLastTriggerTime = {}; // Track last trigger time per action

    // MIDI Activity Indicator elements
    const midiActivityIndicator = document.getElementById('midiActivityIndicator');
    const midiActivityText = document.getElementById('midiActivityText');

    // Display MIDI activity in the indicator box
    function displayMIDIActivity(message) {
        if (!midiActivityIndicator || !midiActivityText) return;

        // Skip Note Off messages - only show Note On
        if (message.type === 'noteoff' || (message.type === 'noteon' && message.velocity === 0)) {
            return;
        }

        // Format the message text based on type
        let displayText = '';

        if (message.type === 'noteon') {
            displayText = `Ch${message.channel} Note ${message.note}`;
        } else if (message.type === 'cc') {
            displayText = `Ch${message.channel} CC ${message.controller} (${message.value})`;
        } else if (message.type === 'program') {
            displayText = `Ch${message.channel} Prog ${message.program}`;
        } else {
            // For any other message types, show generic format
            displayText = `Ch${message.channel} ${message.type.toUpperCase()}`;
        }

        // Update text
        midiActivityText.textContent = displayText;
    }

    // Initialize MIDI message listener
    if (window.electronAPI && window.electronAPI.onMIDIMessage) {
        window.electronAPI.onMIDIMessage((message) => {
            handleMIDIMessage(message);
        });
        console.log('MIDI message listener initialized');
    }

    // Handle incoming MIDI messages
    function handleMIDIMessage(message) {
        // Display MIDI activity (always show, even during learn mode)
        displayMIDIActivity(message);

        // Ignore messages if we're in MIDI learn mode
        if (midiLearnActive) {
            captureMIDILearn(message);
            return;
        }

        // Try to match message against mapped actions
        for (const [action, mapping] of Object.entries(midiMappings)) {
            if (mapping && matchesMIDIMapping(message, mapping)) {
                // Check debounce timing
                const now = Date.now();
                const lastTrigger = midiLastTriggerTime[action] || 0;
                const timeSinceLastTrigger = now - lastTrigger;

                if (timeSinceLastTrigger < MIDI_DEBOUNCE_MS) {
                    console.log(`MIDI: Debounced ${action} (${timeSinceLastTrigger}ms since last trigger)`);
                    return;
                }

                // Update last trigger time and execute action
                midiLastTriggerTime[action] = now;
                console.log(`MIDI triggered action: ${action}`, message);
                executeMappedAction(action);
                return;
            }
        }
    }

    // Check if a MIDI message matches a stored mapping
    function matchesMIDIMapping(message, mapping) {
        // Must match type and channel
        if (message.type !== mapping.type || message.channel !== mapping.channel) {
            return false;
        }

        // For note messages, match note number
        if (message.type === 'noteon' || message.type === 'noteoff') {
            // For note-on messages, require velocity > 0 (ignore note-off disguised as velocity 0)
            if (message.type === 'noteon' && message.velocity === 0) {
                console.log('MIDI: Ignoring Note On with velocity 0 (key release)');
                return false;
            }
            return message.note === mapping.note;
        }

        // For CC messages, match controller number
        if (message.type === 'cc') {
            return message.controller === mapping.controller;
        }

        // For program change, match program number
        if (message.type === 'program') {
            return message.program === mapping.program;
        }

        return false;
    }

    // Execute the action associated with a MIDI mapping
    function executeMappedAction(action) {
        // Use the same action execution logic as keyboard shortcuts
        switch (action) {
            case 'previousClip':
                prevClipBtn.click();
                break;
            case 'nextClip':
                nextClipBtn.click();
                break;
            case 'previousCuePoint':
                prevCuePointBtn.click();
                break;
            case 'nextCuePoint':
                nextCuePointBtn.click();
                break;
            case 'restartClip':
                restartClipBtn.click();
                break;
            case 'recordCuePoint':
                recordCuePointBtn.click();
                break;
            case 'setInPoint':
                setInPointBtn.click();
                break;
            case 'setOutPoint':
                setOutPointBtn.click();
                break;
            case 'clearInOut':
                clearInOutBtn.click();
                break;
            case 'zoomIn':
                if (timelineZoomLevel < 8) {
                    setTimelineZoom(timelineZoomLevel * 2);
                }
                break;
            case 'zoomOut':
                if (timelineZoomLevel > 1) {
                    setTimelineZoom(timelineZoomLevel / 2);
                }
                break;
            case 'pausePlay':
                pausePlayVideo();
                break;
            case 'tab1':
                switchTab(0);
                break;
            case 'tab2':
                switchTab(1);
                break;
            case 'tab3':
                switchTab(2);
                break;
            case 'tab4':
                switchTab(3);
                break;
            case 'tab5':
                switchTab(4);
                break;
            case 'speedPreset0.5':
                changeSpeed(0.5);
                break;
            case 'speedPreset1':
                changeSpeed(1.0);
                break;
            case 'speedPreset1.5':
                changeSpeed(1.5);
                break;
            case 'speedPreset2':
                changeSpeed(2.0);
                break;
        }
    }

    // Format MIDI mapping for display
    function formatMIDIMapping(mapping) {
        if (!mapping) return 'Not Mapped';

        let result = `Ch${mapping.channel} `;

        if (mapping.type === 'noteon') {
            result += `Note ${mapping.note}`;
        } else if (mapping.type === 'cc') {
            result += `CC ${mapping.controller}`;
        } else if (mapping.type === 'program') {
            result += `Prog ${mapping.program}`;
        } else {
            result += mapping.type;
        }

        return result;
    }

    // Capture MIDI message for learning
    function captureMIDILearn(message) {
        // Only learn from note-on and CC messages for now
        if (message.type !== 'noteon' && message.type !== 'cc') {
            return;
        }

        // For note-on, require velocity > 0 (ignore note-off)
        if (message.type === 'noteon' && message.velocity === 0) {
            return;
        }

        console.log('MIDI Learn captured:', message);

        // Store the mapping
        const mapping = {
            type: message.type,
            channel: message.channel
        };

        if (message.type === 'noteon') {
            mapping.note = message.note;
        } else if (message.type === 'cc') {
            mapping.controller = message.controller;
        }

        // Save to the action we're learning
        midiMappings[midiLearnAction] = mapping;
        console.log(`Learned MIDI mapping for ${midiLearnAction}:`, mapping);

        // Exit learn mode
        midiLearnActive = false;
        midiLearnAction = null;

        // Update the UI if the shortcuts modal is open
        if (shortcutsModalOpen) {
            populateShortcutsGrid();
        }
    }

    // ==============================================================
    // END MIDI MESSAGE HANDLING
    // ==============================================================

    // Keyboard shortcuts modal functions
    let tempKeyboardShortcuts = {}; // Temporary storage for editing
    let currentEditingAction = null;

    const shortcutLabels = {
        'previousClip': 'Previous Clip',
        'nextClip': 'Next Clip',
        'previousCuePoint': 'Previous Cue Point',
        'nextCuePoint': 'Next Cue Point',
        'restartClip': 'Restart Clip',
        'recordCuePoint': 'Record Cue Point',
        'setInPoint': 'Set In Point',
        'setOutPoint': 'Set Out Point',
        'clearInOut': 'Clear In/Out Points',
        'zoomIn': 'Zoom Timeline In',
        'zoomOut': 'Zoom Timeline Out',
        'pausePlay': 'Pause/Play Video',
        'tab1': 'Switch to Tab 1',
        'tab2': 'Switch to Tab 2',
        'tab3': 'Switch to Tab 3',
        'tab4': 'Switch to Tab 4',
        'tab5': 'Switch to Tab 5',
        'speedPreset0.5': 'Speed: 0.5x',
        'speedPreset1': 'Speed: 1x',
        'speedPreset1.5': 'Speed: 1.5x',
        'speedPreset2': 'Speed: 2x'
    };

    function openShortcutsModal() {
        // Copy current shortcuts to temp storage
        tempKeyboardShortcuts = { ...keyboardShortcuts };
        shortcutsModalOpen = true;
        populateShortcutsGrid();
        loadMIDIDevices();
        shortcutsModal.style.display = 'block';
    }

    function closeShortcutsModalFunc() {
        shortcutsModalOpen = false;
        currentEditingAction = null;
        // Exit MIDI learn mode if active
        midiLearnActive = false;
        midiLearnAction = null;
        shortcutsModal.style.display = 'none';
        // Clear any editing states
        document.querySelectorAll('.shortcut-input.editing').forEach(input => {
            input.classList.remove('editing');
        });
        document.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
            btn.classList.remove('learning');
            btn.textContent = 'Learn';
        });
    }

    function populateShortcutsGrid() {
        shortcutsGrid.innerHTML = '';

        for (const [action, label] of Object.entries(shortcutLabels)) {
            const row = document.createElement('div');
            row.className = 'shortcut-row';

            // Label column
            const labelDiv = document.createElement('div');
            labelDiv.className = 'shortcut-label';
            labelDiv.textContent = label;

            // Keyboard shortcut column
            const inputDiv = document.createElement('div');
            inputDiv.className = 'shortcut-input';
            inputDiv.textContent = tempKeyboardShortcuts[action];
            inputDiv.dataset.action = action;

            inputDiv.addEventListener('click', function() {
                startEditingShortcut(action, inputDiv);
            });

            // MIDI mapping column
            const midiCell = document.createElement('div');
            midiCell.className = 'midi-mapping-cell';

            const midiDisplay = document.createElement('div');
            midiDisplay.className = 'midi-mapping-display';
            const mapping = midiMappings[action];
            if (mapping) {
                midiDisplay.textContent = formatMIDIMapping(mapping);
                midiDisplay.classList.add('has-mapping');
            } else {
                midiDisplay.textContent = 'Not Mapped';
            }
            midiDisplay.dataset.action = action;

            const learnBtn = document.createElement('button');
            learnBtn.className = 'midi-learn-btn';
            learnBtn.textContent = 'Learn';
            learnBtn.dataset.action = action;
            learnBtn.addEventListener('click', function() {
                startMIDILearn(action, learnBtn);
            });

            const clearBtn = document.createElement('button');
            clearBtn.className = 'midi-clear-btn';
            clearBtn.textContent = '✕';
            clearBtn.title = 'Clear MIDI mapping';
            clearBtn.dataset.action = action;
            clearBtn.disabled = !mapping;
            clearBtn.addEventListener('click', function() {
                clearMIDIMapping(action);
            });

            midiCell.appendChild(midiDisplay);
            midiCell.appendChild(learnBtn);
            midiCell.appendChild(clearBtn);

            row.appendChild(labelDiv);
            row.appendChild(inputDiv);
            row.appendChild(midiCell);
            shortcutsGrid.appendChild(row);
        }
    }

    // MIDI learn workflow functions
    function startMIDILearn(action, buttonElement) {
        // Clear any existing learn mode
        document.querySelectorAll('.midi-learn-btn.learning').forEach(btn => {
            btn.classList.remove('learning');
            btn.textContent = 'Learn';
        });

        // Enter learn mode
        midiLearnActive = true;
        midiLearnAction = action;
        buttonElement.classList.add('learning');
        buttonElement.textContent = 'Waiting...';
        console.log(`MIDI Learn mode activated for action: ${action}`);
    }

    function clearMIDIMapping(action) {
        midiMappings[action] = null;
        console.log(`Cleared MIDI mapping for action: ${action}`);
        populateShortcutsGrid();
    }

    // Load MIDI devices into selector
    async function loadMIDIDevices() {
        if (!window.electronAPI || !window.electronAPI.getMIDIDevices) {
            console.log('MIDI API not available');
            return;
        }

        try {
            const result = await window.electronAPI.getMIDIDevices();
            if (result.success && result.devices) {
                midiDevices = result.devices;
                const selector = document.getElementById('midiDeviceSelect');
                selector.innerHTML = '';

                if (midiDevices.length === 0) {
                    selector.innerHTML = '<option value="">No MIDI devices found</option>';
                } else {
                    midiDevices.forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.id;
                        option.textContent = device.name;
                        selector.appendChild(option);
                    });

                    // Get current device
                    const currentResult = await window.electronAPI.getCurrentMIDIDevice();
                    if (currentResult.success && currentResult.port !== null) {
                        selector.value = currentResult.port;
                        currentMIDIDevice = currentResult.port;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading MIDI devices:', error);
        }
    }

    // Handle MIDI device selection
    async function handleMIDIDeviceChange(event) {
        const portIndex = parseInt(event.target.value);
        if (isNaN(portIndex)) return;

        try {
            const result = await window.electronAPI.selectMIDIDevice(portIndex);
            if (result.success) {
                currentMIDIDevice = portIndex;
                console.log(`Connected to MIDI device: ${result.name}`);
            } else {
                console.error('Failed to select MIDI device:', result.error);
                alert('Failed to connect to MIDI device');
            }
        } catch (error) {
            console.error('Error selecting MIDI device:', error);
        }
    }

    function startEditingShortcut(action, inputElement) {
        // Clear any other editing states
        document.querySelectorAll('.shortcut-input.editing').forEach(input => {
            input.classList.remove('editing');
        });

        currentEditingAction = action;
        inputElement.classList.add('editing');
        inputElement.textContent = 'Press key...';
    }

    function handleShortcutEdit(event) {
        if (!currentEditingAction || !shortcutsModalOpen) return;

        event.preventDefault();
        event.stopPropagation();

        // Build shortcut string
        let shortcut = '';
        if (event.shiftKey) shortcut += 'Shift+';
        if (event.ctrlKey) shortcut += 'Ctrl+';
        if (event.altKey) shortcut += 'Alt+';
        if (event.metaKey) shortcut += 'Meta+';

        // Add the main key
        let key = event.key;
        if (key === ' ') key = 'Space';
        shortcut += key;

        // Update temp shortcuts
        tempKeyboardShortcuts[currentEditingAction] = shortcut;

        // Update UI
        const inputElement = document.querySelector(`[data-action="${currentEditingAction}"]`);
        inputElement.textContent = shortcut;
        inputElement.classList.remove('editing');

        currentEditingAction = null;
    }

    function resetShortcutsToDefaults() {
        tempKeyboardShortcuts = {
            'previousClip': 'ArrowLeft',
            'nextClip': 'ArrowRight',
            'previousCuePoint': 'q',
            'nextCuePoint': 'w',
            'restartClip': 'r',
            'recordCuePoint': 'c',
            'setInPoint': 'i',
            'setOutPoint': 'o',
            'clearInOut': 'Shift+x',
            'zoomIn': '=',
            'zoomOut': '-',
            'pausePlay': 'Space',
            'tab1': '1',
            'tab2': '2',
            'tab3': '3',
            'tab4': '4',
            'tab5': '5',
            'speedPreset0.5': 'Shift+1',
            'speedPreset1': 'Shift+2',
            'speedPreset1.5': 'Shift+3',
            'speedPreset2': 'Shift+4'
        };
        populateShortcutsGrid();
    }

    function saveShortcutsChanges() {
        keyboardShortcuts = { ...tempKeyboardShortcuts };
        markSessionModified();
        closeShortcutsModalFunc();
    }

    // Add event listener for editing shortcuts
    document.addEventListener('keydown', function(event) {
        if (currentEditingAction && shortcutsModalOpen) {
            handleShortcutEdit(event);
        }
    });

    // File browser event listeners removed - drag videos from OS file explorer instead

    // Timeline zoom button event listeners
    document.querySelectorAll('.zoom-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const zoomLevel = parseInt(this.dataset.zoom);
            setTimelineZoom(zoomLevel);
        });
    });

    // Initialize zoom to 1x
    setTimelineZoom(1);

    // Initialize the matrix
    createClipMatrix();

    // Initialize tab event listeners
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((button) => {
        const tabIndex = parseInt(button.dataset.tab);
        setupTabEventHandlers(button, tabIndex);
    });

    // Add tab button click handler
    addTabBtn.addEventListener('click', addNewTab);

    // Context menu event listeners
    const contextMenuItems = clipContextMenu.querySelectorAll('.context-menu-item');
    contextMenuItems.forEach(item => {
        item.addEventListener('click', function() {
            if (contextMenuClipNumber !== null) {
                const mode = item.dataset.mode;
                const action = item.dataset.action;

                if (action === 'clear') {
                    clearClip(contextMenuClipNumber);
                } else if (mode) {
                    setClipMode(contextMenuClipNumber, mode);
                }
            }
            hideClipContextMenu();
        });
    });

    // Hide context menu when clicking anywhere else
    document.addEventListener('click', function(e) {
        if (!clipContextMenu.contains(e.target)) {
            hideClipContextMenu();
        }
    });

    // Initialize UI state
    // updatePlayButtonState() removed
    // updateCuePointsList(); // REMOVED - cue points visible on timeline
    updateSpeedControls();
    updateSessionStatus('No session loaded');

    // Transport control event listeners

    // Previous Clip button
    prevClipBtn.addEventListener('click', function() {
        console.log('=== PREVIOUS CLIP BUTTON CLICKED ===');
        navigateToClip('previous');
    });

    // Removed: Reverse, Pause/Play, and Forward Play buttons per team feedback
    // Only Previous and Next Clip buttons remain

    // Next Clip button
    nextClipBtn.addEventListener('click', function() {
        console.log('=== NEXT CLIP BUTTON CLICKED ===');
        navigateToClip('next');
    });

    // Record Cue Point button
    recordCuePointBtn.addEventListener('click', function() {
        console.log('Record cue point button clicked');
        recordCuePoint();
    });

    // Restart Clip button
    restartClipBtn.addEventListener('click', function() {
        console.log('Restart clip button clicked');
        restartClip();
    });

    // Previous Cue Point button
    prevCuePointBtn.addEventListener('click', function() {
        console.log('Previous cue point button clicked');
        navigateToPreviousCuePoint();
    });

    // Next Cue Point button
    nextCuePointBtn.addEventListener('click', function() {
        console.log('Next cue point button clicked');
        navigateToNextCuePoint();
    });

    // In/Out Point buttons
    setInPointBtn.addEventListener('click', function() {
        console.log('Set In Point button clicked');
        setInPoint();
    });

    setOutPointBtn.addEventListener('click', function() {
        console.log('Set Out Point button clicked');
        setOutPoint();
    });

    clearInOutBtn.addEventListener('click', function() {
        console.log('Clear In/Out button clicked');
        clearInOutPoints();
    });

    // Auto-Play Toggle
    autoPlayToggle.addEventListener('change', function() {
        console.log('Auto-play toggle clicked');
        toggleGlobalAutoPlay();
    });

    // Timeline event listeners
    timelineTrack.addEventListener('click', handleTimelineClick);
    timelineHandle.addEventListener('mousedown', handleTimelineDrag);

    // Speed control event listeners
    speedSlider.addEventListener('input', function() {
        const speed = parseFloat(speedSlider.value);
        changeSpeed(speed);
    });

    speedPresetBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const speed = parseFloat(btn.dataset.speed);
            changeSpeed(speed);
        });
    });

    // Session management event listeners
    saveSessionBtn.addEventListener('click', function() {
        console.log('Save session button clicked');
        saveSession();
    });

    loadSessionBtn.addEventListener('click', async function() {
        console.log('Load session button clicked');
        try {
            const result = await window.electronAPI.loadSession();

            if (result.canceled) {
                console.log('Session load cancelled by user');
                return;
            }

            if (result.success) {
                await loadSessionData(result.sessionData);
                console.log('Session loaded successfully from:', result.filePath);
            } else {
                throw new Error(result.error || 'Failed to load session');
            }
        } catch (error) {
            console.error('Error loading session:', error);
            alert('Error loading session: ' + error.message);
        }
    });

    // Keyboard shortcuts modal event listeners
    shortcutsBtn.addEventListener('click', openShortcutsModal);

    closeShortcutsModal.addEventListener('click', closeShortcutsModalFunc);

    // Close modal when clicking outside
    shortcutsModal.addEventListener('click', function(event) {
        if (event.target === shortcutsModal) {
            closeShortcutsModalFunc();
        }
    });

    resetShortcutsBtn.addEventListener('click', resetShortcutsToDefaults);

    saveShortcutsBtn.addEventListener('click', saveShortcutsChanges);

    // MIDI device selector event listener
    const midiDeviceSelect = document.getElementById('midiDeviceSelect');
    if (midiDeviceSelect) {
        midiDeviceSelect.addEventListener('change', handleMIDIDeviceChange);
    }

    // Helper function to update visual playing indicator
    function updatePlayingIndicator() {
        // Remove 'playing' class from all clips
        document.querySelectorAll('.clip-slot').forEach(slot => {
            slot.classList.remove('playing');
        });

        // Add 'playing' class to currently playing clip
        if (currentlyPlayingClipNumber && selectedClipSlot) {
            const playingSlot = document.querySelector(`[data-clip-number="${currentlyPlayingClipNumber}"]`);
            if (playingSlot && !video.paused) {
                playingSlot.classList.add('playing');
            }
        }
    }

    // Track bounce direction and animation frame
    let bounceDirection = 1;
    let bounceAnimationFrame = null;
    let lastBounceTime = null;

    // Helper function to handle playback end based on clip mode
    function handlePlaybackEnd() {
        if (!selectedClipSlot) return;

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const mode = clipModes[clipNumber] || 'loop';

        console.log(`Video ended for clip ${clipNumber} in mode: ${mode}`);

        switch (mode) {
            case 'loop':
                // Loop mode - native loop handles this
                console.log('Loop mode: Video looping');
                break;

            case 'forward-next':
                // Forward-next mode - advance to next clip with video
                console.log('Forward-next mode: Advancing to next clip');
                navigateToClip('next');
                break;

            case 'bounce':
                // Bounce mode - seamlessly switch to reversed video element
                // This handles the case when video reaches its natural end (no Out point set)
                console.log('[bounce-ended] Video reached end, switching to reversed video');

                if (!clipReversedVideos[clipNumber]) {
                    console.error('[bounce-ended] No reversed video available for bounce mode');
                    globalPlayIntent = false;
                    updatePlayingIndicator();
                    break;
                }

                // Get In/Out points to calculate where to start reversed video
                const inOut = clipInOutPoints[clipNumber];
                const outPoint = (inOut && inOut.outPoint !== undefined && inOut.outPoint !== null)
                    ? inOut.outPoint : video.duration;

                // Get the playback speed for synchronization
                const currentSpeed = clipSpeeds[clipNumber] || 1.0;

                // Calculate where to start reversed video (position representing Out point)
                const videoDuration = video.duration;
                const reversedStartPosition = videoDuration - outPoint;

                // Hide forward video, show reversed video
                video.style.display = 'none';
                videoReverse.style.display = 'block';

                // Set reversed video to correct position and match speed
                videoReverse.currentTime = reversedStartPosition;
                videoReverse.playbackRate = currentSpeed;

                console.log(`[bounce-ended] Starting reversed video at ${reversedStartPosition.toFixed(2)}s (represents ${outPoint.toFixed(2)}s)`);

                // Play reversed video
                videoReverse.play().then(() => {
                    console.log('[bounce-ended] Playing reversed video');
                    bounceDirection = -1; // Track that we're going backwards
                    startSmoothTimelineUpdates(); // Start timeline animation for reverse playback
                }).catch(e => {
                    console.error('[bounce-ended] Error playing reversed video:', e);
                });

                // Update output window to show reversed video
                if (outputWindowOpen) {
                    // Load reversed video
                    window.electronAPI.sendToOutputWindow({
                        type: 'loadVideo',
                        src: videoReverse.src
                    });
                    // Wait for video to load, then sync position and play
                    setTimeout(() => {
                        window.electronAPI.sendToOutputWindow({
                            type: 'seek',
                            time: reversedStartPosition
                        });
                        window.electronAPI.sendToOutputWindow({
                            type: 'setPlaybackRate',
                            rate: currentSpeed
                        });
                        window.electronAPI.sendToOutputWindow({
                            type: 'play'
                        });
                    }, 100);
                }
                break;

            case 'forward':
            case 'forward-stop':
            default:
                // Forward-stop mode (default) - just stop
                console.log('Forward-stop mode: Video stopped at end');
                globalPlayIntent = false;
                // updatePlayButtonState() removed
                updatePlayingIndicator();
                break;
        }
    }

    // Video event listeners for debugging and state management
    video.addEventListener('play', function() {
        console.log('Video play event fired');
        currentVideoPlaying = true;
        if (selectedClipSlot) {
            currentlyPlayingClipNumber = selectedClipSlot.dataset.clipNumber;
            updatePlayingIndicator();
        }
        // Start smooth 60fps timeline updates
        startSmoothTimelineUpdates();
        // Note: Don't change globalPlayIntent here - only user actions should
    });

    video.addEventListener('pause', function() {
        console.log('Video pause event fired');
        currentVideoPlaying = false;
        updatePlayingIndicator();

        // Stop smooth timeline updates
        stopSmoothTimelineUpdates();
        // Update timeline one last time to show final position
        updateTimeline();

        // Cancel bounce animation if playing
        if (bounceAnimationFrame) {
            cancelAnimationFrame(bounceAnimationFrame);
            bounceAnimationFrame = null;
            bounceDirection = 1; // Reset to forward
        }

        // Note: Don't change globalPlayIntent here - only user actions should
    });

    video.addEventListener('ended', function() {
        console.log('Video ended - handling based on playback mode');
        currentVideoPlaying = false;
        handlePlaybackEnd();
    });

    // Reversed video event listeners for bounce mode
    videoReverse.addEventListener('ended', function() {
        console.log('[bounce-reverse-ended] Reversed video ended - bouncing back to forward');

        if (!selectedClipSlot) return;

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const mode = clipModes[clipNumber] || 'loop';

        if (mode === 'bounce') {
            // Get In/Out points
            const inOut = clipInOutPoints[clipNumber];
            const inPoint = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null)
                ? inOut.inPoint : 0;

            // Hide reversed video, show forward video
            videoReverse.style.display = 'none';
            video.style.display = 'block';

            // Reset forward video to In point and play
            video.currentTime = inPoint;
            const currentSpeed = clipSpeeds[clipNumber] || 1.0;
            video.playbackRate = currentSpeed;

            console.log(`[bounce-reverse-ended] Restarting forward playback at In point: ${inPoint.toFixed(2)}s`);

            video.play().then(() => {
                console.log('[bounce-reverse-ended] Bounced back to forward playback');
                bounceDirection = 1; // Track that we're going forward
            }).catch(e => {
                console.error('[bounce-reverse-ended] Error playing forward video after bounce:', e);
            });

            // Update output window to show forward video
            if (outputVideo && outputWindow) {
                window.electronAPI.sendToOutputWindow({
                    action: 'updateVideoSource',
                    videoSrc: video.src
                });
            }
        }
    });

    // Reversed video timeupdate listener for In/Out point bounce detection
    videoReverse.addEventListener('timeupdate', function() {
        if (!selectedClipSlot || videoReverse.paused) return;

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const mode = clipModes[clipNumber] || 'loop';

        if (mode === 'bounce' && video.duration > 0) {
            // Get In/Out points
            const inOut = clipInOutPoints[clipNumber];
            const inPoint = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null)
                ? inOut.inPoint : 0;

            // Calculate position in reversed video that represents the In point
            // reversed position = duration - forward position
            const videoDuration = video.duration;
            const reversedEndPosition = videoDuration - inPoint;

            // Check if we've reached or passed the In point position (with small tolerance)
            if (videoReverse.currentTime >= reversedEndPosition - 0.05) {
                console.log(`[bounce-reverse-timeupdate] Reached In point (reversed pos: ${videoReverse.currentTime.toFixed(2)}s = forward pos: ${inPoint.toFixed(2)}s), bouncing to forward`);

                // Pause reversed video
                videoReverse.pause();

                // Hide reversed video, show forward video
                videoReverse.style.display = 'none';
                video.style.display = 'block';

                // Start forward video at In point
                video.currentTime = inPoint;
                const currentSpeed = clipSpeeds[clipNumber] || 1.0;
                video.playbackRate = currentSpeed;

                video.play().then(() => {
                    bounceDirection = 1; // Track that we're going forward
                }).catch(e => {
                    console.error('[bounce-reverse-timeupdate] Error playing forward video after reverse bounce:', e);
                });

                // Update output window to show forward video
                if (outputWindowOpen) {
                    // Load forward video
                    window.electronAPI.sendToOutputWindow({
                        type: 'loadVideo',
                        src: video.src
                    });
                    // Wait for video to load, then sync position and play
                    setTimeout(() => {
                        window.electronAPI.sendToOutputWindow({
                            type: 'seek',
                            time: inPoint
                        });
                        window.electronAPI.sendToOutputWindow({
                            type: 'setPlaybackRate',
                            rate: currentSpeed
                        });
                        window.electronAPI.sendToOutputWindow({
                            type: 'play'
                        });
                    }, 100);
                }
            }
        }
    });

    video.addEventListener('timeupdate', function() {
        // Note: Timeline updates now handled by requestAnimationFrame for smooth 60fps motion
        // updateTimeline() is called from smoothUpdateTimeline() instead

        // Mode-aware playback behavior (In/Out points + cue points)
        if (selectedClipSlot && !video.paused && video.duration && !isNaN(video.duration)) {
            const clipNumber = selectedClipSlot.dataset.clipNumber;
            const clipMode = clipModes[clipNumber] || 'loop';
            const inOut = clipInOutPoints[clipNumber];
            const cuePoints = clipCuePoints[clipNumber] || [];
            const currentTime = video.currentTime;

            // Get In/Out points (default to video bounds)
            const inPoint = (inOut && inOut.inPoint !== undefined && inOut.inPoint !== null) ? inOut.inPoint : 0;
            const outPoint = (inOut && inOut.outPoint !== undefined && inOut.outPoint !== null) ? inOut.outPoint : video.duration;

            // Safety check: if In Point is after Out Point (invalid), ignore In Point
            const validInPoint = (inPoint < outPoint) ? inPoint : 0;
            const validOutPoint = (inPoint < outPoint) ? outPoint : video.duration;

            // Safety check: if before In Point, jump to it
            if (currentTime < validInPoint && currentTime > 0.1) {
                video.currentTime = validInPoint;
                updateTimeline();
                console.log(`Before In point, jumping to ${formatTime(validInPoint)}`);
                return;
            }

            // Mode-specific behavior when reaching Out Point or cue points
            switch (clipMode) {
                case 'forward':
                    // Play continuously from In to Out, ignoring cues
                    if (currentTime >= validOutPoint) {
                        video.pause();
                        globalPlayIntent = false;
                        console.log(`[forward] Reached Out point, stopped`);
                    }
                    break;

                case 'loop':
                    // Loop back to In Point when reaching Out Point
                    if (currentTime >= validOutPoint) {
                        video.currentTime = validInPoint;
                        updateTimeline();
                        console.log(`[loop] Reached Out point, looping to ${formatTime(validInPoint)}`);
                    }
                    break;

                case 'forward-stop':
                    // Stop at each cue point OR Out Point (whichever comes first)
                    // Check Out Point first
                    if (currentTime >= validOutPoint) {
                        video.pause();
                        globalPlayIntent = false;
                        console.log(`[forward-stop] Reached Out point, stopped`);
                        break;
                    }

                    // Check cue points (only in forward direction, not during bounce)
                    if (bounceDirection === 1 && cuePoints.length > 0) {
                        for (let i = 0; i < cuePoints.length; i++) {
                            const cuePoint = cuePoints[i];
                            // If within 0.1 seconds of a cue point, pause
                            if (Math.abs(currentTime - cuePoint.time) < 0.1) {
                                // Don't stop if we just navigated to THIS SPECIFIC cue point
                                if (justNavigatedToCue && i === lastNavigatedCueIndex) {
                                    // Clear the flag once we've moved away from this cue point
                                    if (Math.abs(currentTime - cuePoint.time) >= 0.1) {
                                        justNavigatedToCue = false;
                                        lastNavigatedCueIndex = -1;
                                    }
                                    continue; // Skip stopping
                                }

                                video.pause();
                                globalPlayIntent = false;
                                clipCurrentCueIndex[clipNumber] = i;
                                console.log(`[forward-stop] Stopped at cue ${i + 1}/${cuePoints.length}: ${formatTime(cuePoint.time)}`);
                                break;
                            }
                        }
                    }
                    break;

                case 'forward-next':
                    // Play to Out Point, then wait for 'w' to go to next clip
                    if (currentTime >= validOutPoint) {
                        video.pause();
                        globalPlayIntent = false;
                        console.log(`[forward-next] Reached Out point, waiting for next clip trigger`);
                    }
                    break;

                case 'bounce':
                    // Bounce mode - trigger bounce when reaching Out point
                    if (currentTime >= validOutPoint - 0.05) {
                        console.log(`[bounce] Reached Out point at ${formatTime(currentTime)}, switching to reverse`);

                        // Check if reversed video exists
                        if (!clipReversedVideos[clipNumber]) {
                            console.error('[bounce] No reversed video available');
                            video.pause();
                            globalPlayIntent = false;
                            updatePlayingIndicator();
                            break;
                        }

                        // Pause forward video
                        video.pause();

                        // Calculate where to start reversed video
                        // Reversed video position that represents the Out point
                        const videoDuration = video.duration;
                        const reversedStartPosition = videoDuration - validOutPoint;

                        // Switch to reversed video
                        video.style.display = 'none';
                        videoReverse.style.display = 'block';
                        videoReverse.currentTime = reversedStartPosition;
                        videoReverse.playbackRate = clipSpeeds[clipNumber] || 1.0;

                        console.log(`[bounce] Starting reversed video at ${reversedStartPosition.toFixed(2)}s (represents ${validOutPoint.toFixed(2)}s)`);

                        videoReverse.play().then(() => {
                            bounceDirection = -1;
                            startSmoothTimelineUpdates();
                        }).catch(e => {
                            console.error('[bounce] Error playing reversed video:', e);
                        });

                        // Update output window to show reversed video
                        if (outputWindowOpen) {
                            const currentSpeed = clipSpeeds[clipNumber] || 1.0;
                            // Load reversed video
                            window.electronAPI.sendToOutputWindow({
                                type: 'loadVideo',
                                src: videoReverse.src
                            });
                            // Wait for video to load, then sync position and play
                            setTimeout(() => {
                                window.electronAPI.sendToOutputWindow({
                                    type: 'seek',
                                    time: reversedStartPosition
                                });
                                window.electronAPI.sendToOutputWindow({
                                    type: 'setPlaybackRate',
                                    rate: currentSpeed
                                });
                                window.electronAPI.sendToOutputWindow({
                                    type: 'play'
                                });
                            }, 100);
                        }
                    }
                    break;

                default:
                    // Default to loop behavior
                    if (currentTime >= validOutPoint) {
                        video.currentTime = validInPoint;
                        updateTimeline();
                    }
                    break;
            }
        }

        // Only log occasionally to avoid spam
        if (Math.floor(video.currentTime) % 5 === 0) {
            console.log('Video time:', video.currentTime);
        }
    });

    video.addEventListener('loadedmetadata', function() {
        videoDuration = video.duration;
        updateTimeline();
        updateCueMarkersOnTimeline();
        console.log('Video loaded, duration:', videoDuration);
    });

    video.addEventListener('durationchange', function() {
        videoDuration = video.duration;
        updateTimeline();
        updateCueMarkersOnTimeline();
        console.log('Video duration changed:', videoDuration);
    });

    // Output Window Functions (Electron version)
    let outputWindowOpen = false;

    async function createOutputWindow() {
        try {
            const result = await window.electronAPI.openOutputWindow();

            if (result.success) {
                outputWindowOpen = true;
                outputWindowBtn.textContent = 'Close Output Window';

                // Sync current video to output
                syncToOutputWindow();

                console.log('Output window created');
            } else {
                alert('Failed to open output window.');
            }
        } catch (error) {
            console.error('Error opening output window:', error);
            alert('Error opening output window: ' + error.message);
        }
    }

    async function closeOutputWindow() {
        try {
            await window.electronAPI.closeOutputWindow();
            outputWindowOpen = false;
            outputWindowBtn.textContent = 'Open Output Window';
            console.log('Output window closed');
        } catch (error) {
            console.error('Error closing output window:', error);
        }
    }

    function syncToOutputWindow() {
        if (!outputWindowOpen) {
            return;
        }

        // Detect which video element is currently active (visible)
        const activeVideo = (videoReverse.style.display !== 'none') ? videoReverse : video;

        if (!activeVideo.src) {
            return;
        }

        // Send load video message with active video source
        window.electronAPI.sendToOutputWindow({
            type: 'loadVideo',
            src: activeVideo.src
        });

        // Send current state of active video
        window.electronAPI.sendToOutputWindow({
            type: 'seek',
            time: activeVideo.currentTime
        });

        window.electronAPI.sendToOutputWindow({
            type: 'setPlaybackRate',
            rate: activeVideo.playbackRate
        });

        if (!activeVideo.paused) {
            window.electronAPI.sendToOutputWindow({ type: 'play' });
        } else {
            window.electronAPI.sendToOutputWindow({ type: 'pause' });
        }
    }

    // Listen for output window closed event from main process
    if (window.electronAPI && window.electronAPI.onOutputWindowClosed) {
        window.electronAPI.onOutputWindowClosed(() => {
            outputWindowOpen = false;
            outputWindowBtn.textContent = 'Open Output Window';
            console.log('Output window was closed');
        });
    }

    // Add event listeners to sync output window with main video (Electron IPC version)
    video.addEventListener('loadeddata', function() {
        if (outputWindowOpen) {
            syncToOutputWindow();
        }
    });

    video.addEventListener('play', function() {
        if (outputWindowOpen && video.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({ type: 'play' });
        }
    });

    video.addEventListener('pause', function() {
        if (outputWindowOpen && video.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({ type: 'pause' });
        }
    });

    video.addEventListener('seeked', function() {
        if (outputWindowOpen && video.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({
                type: 'seek',
                time: video.currentTime
            });
        }
    });

    video.addEventListener('ratechange', function() {
        if (outputWindowOpen && video.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({
                type: 'setPlaybackRate',
                rate: video.playbackRate
            });
        }
    });

    // Add event listeners for reversed video element (for bounce mode sync)
    videoReverse.addEventListener('play', function() {
        if (outputWindowOpen && videoReverse.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({ type: 'play' });
        }
    });

    videoReverse.addEventListener('pause', function() {
        if (outputWindowOpen && videoReverse.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({ type: 'pause' });
        }
    });

    videoReverse.addEventListener('seeked', function() {
        if (outputWindowOpen && videoReverse.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({
                type: 'seek',
                time: videoReverse.currentTime
            });
        }
    });

    videoReverse.addEventListener('ratechange', function() {
        if (outputWindowOpen && videoReverse.style.display !== 'none') {
            window.electronAPI.sendToOutputWindow({
                type: 'setPlaybackRate',
                rate: videoReverse.playbackRate
            });
        }
    });

    // Output window button click handler
    outputWindowBtn.addEventListener('click', async function() {
        if (!outputWindowOpen) {
            await createOutputWindow();
        } else {
            await closeOutputWindow();
        }
    });

    // Memory management: Clean up resources when window closes (Electron version)
    window.addEventListener('beforeunload', function() {
        console.log('Cleaning up resources before window closes...');

        // In Electron, we use file:// URLs so no blob cleanup needed
        // Close output window if open
        if (outputWindowOpen) {
            window.electronAPI.closeOutputWindow();
        }

        console.log('Resource cleanup complete');
    });

    // Performance monitoring (optional - can be removed in production)
    if (performance && performance.memory) {
        setInterval(function() {
            const memoryInfo = performance.memory;
            const usedMB = (memoryInfo.usedJSHeapSize / 1048576).toFixed(2);
            const totalMB = (memoryInfo.jsHeapSizeLimit / 1048576).toFixed(2);
            console.log(`Memory usage: ${usedMB} MB / ${totalMB} MB`);
        }, 30000); // Log every 30 seconds
    }
});