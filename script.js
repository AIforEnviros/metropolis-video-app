document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const prevClipBtn = document.getElementById('prevClipBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const pausePlayBtn = document.getElementById('pausePlayBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const nextClipBtn = document.getElementById('nextClipBtn');

    const clipsMatrix = document.getElementById('clipsMatrix');
    const recordCuePointBtn = document.getElementById('recordCuePointBtn');
    const cuePointsList = document.getElementById('cuePointsList');
    const restartClipBtn = document.getElementById('restartClipBtn');
    const prevCuePointBtn = document.getElementById('prevCuePointBtn');
    const nextCuePointBtn = document.getElementById('nextCuePointBtn');
    const timelineTrack = document.getElementById('timelineTrack');
    const timelineProgress = document.getElementById('timelineProgress');
    const timelineHandle = document.getElementById('timelineHandle');
    const cueMarkers = document.getElementById('cueMarkers');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalDurationDisplay = document.getElementById('totalDuration');
    const tabBar = document.getElementById('tabBar');
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    const upFolderBtn = document.getElementById('upFolderBtn');
    const currentPathDisplay = document.getElementById('currentPath');
    const fileList = document.getElementById('fileList');
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

    // Output window reference
    let outputWindow = null;
    let outputVideo = null;

    // Performance optimizations - disable audio globally
    video.muted = true;
    video.volume = 0;

    // Preload hint for faster loading
    video.preload = 'auto';

    // Track global play intent (user's desired state)
    let globalPlayIntent = false; // true = user wants playing, false = user wants paused

    // Track current video playing state (actual video state)
    let currentVideoPlaying = false;

    // Track the currently selected clip
    let selectedClipSlot = null;

    // Track which tab is currently active
    let currentTab = 0;

    // Track videos loaded into each slot for each tab (tabIndex -> { clipNumber -> video data })
    const tabClipVideos = {};

    // Track cue points for each clip for each tab (tabIndex -> { clipNumber -> array of cue point objects })
    const tabClipCuePoints = {};

    // Track speed settings for each clip for each tab (tabIndex -> { clipNumber -> speed value })
    const tabClipSpeeds = {};

    // Initialize tab data structures
    for (let i = 0; i < 5; i++) {
        tabClipVideos[i] = {};
        tabClipCuePoints[i] = {};
        tabClipSpeeds[i] = {};
    }

    // Legacy references for current tab's data (for compatibility)
    let clipVideos = tabClipVideos[currentTab];
    let clipCuePoints = tabClipCuePoints[currentTab];
    let clipSpeeds = tabClipSpeeds[currentTab];

    // File browser state
    let currentFolderPath = '';
    let currentFolderFiles = [];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];

    // Session management state
    let currentSessionName = null;
    let sessionModified = false;

    // Keyboard shortcuts configuration
    let keyboardShortcuts = {
        'playPause': 'Space',
        'previousClip': 'ArrowLeft',
        'nextClip': 'ArrowRight',
        'previousCuePoint': 'q',
        'nextCuePoint': 'w',
        'restartClip': 'r',
        'recordCuePoint': 'c',
        'reversePlay': 'Shift+r',
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

    // Track if shortcuts modal is open
    let shortcutsModalOpen = false;

    // Session management functions
    function createSessionData() {
        // Create a clean copy of video data without blob URLs
        const cleanVideos = {};
        Object.keys(tabClipVideos).forEach(tabIndex => {
            cleanVideos[tabIndex] = {};
            Object.keys(tabClipVideos[tabIndex]).forEach(clipNumber => {
                const video = tabClipVideos[tabIndex][clipNumber];
                cleanVideos[tabIndex][clipNumber] = {
                    name: video.name,
                    type: video.type,
                    // Don't save the URL since blob URLs expire
                    // We'll reconstruct from file browser
                };
            });
        });

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            sessionName: currentSessionName,
            currentTab: currentTab,
            selectedClipSlot: selectedClipSlot ? selectedClipSlot.dataset.clipNumber : null,
            currentFolderPath: currentFolderPath,
            globalPlayIntent: globalPlayIntent,
            keyboardShortcuts: keyboardShortcuts,
            tabs: {
                videos: cleanVideos,
                cuePoints: tabClipCuePoints,
                speeds: tabClipSpeeds
            }
        };
    }

    function saveSession() {
        try {
            const sessionData = createSessionData();

            console.log('=== SAVING SESSION ===');
            console.log('Current tab data:', tabClipVideos);
            console.log('Session data being saved:', sessionData);

            // Create a default session name if none exists
            if (!currentSessionName) {
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                currentSessionName = `metropolis-session-${timestamp}`;
            }

            // Create downloadable file
            const dataStr = JSON.stringify(sessionData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `${currentSessionName}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            sessionModified = false;
            updateSessionStatus(`Saved: ${currentSessionName}`);
            console.log('Session saved successfully');

        } catch (error) {
            console.error('Error saving session:', error);
            alert('Error saving session: ' + error.message);
        }
    }

    function loadSessionFromFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const sessionData = JSON.parse(e.target.result);
                loadSessionData(sessionData);
            } catch (error) {
                console.error('Error parsing session file:', error);
                alert('Error loading session: Invalid file format');
            }
        };
        reader.readAsText(file);
    }

    function loadSessionData(sessionData) {
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
                Object.assign(tabClipVideos, sessionData.tabs.videos);
            }
            if (sessionData.tabs.cuePoints) {
                console.log('Restoring cue points:', sessionData.tabs.cuePoints);
                Object.assign(tabClipCuePoints, sessionData.tabs.cuePoints);
            }
            if (sessionData.tabs.speeds) {
                console.log('Restoring speeds:', sessionData.tabs.speeds);
                Object.assign(tabClipSpeeds, sessionData.tabs.speeds);
            }

            console.log('After restoring - tab data:', tabClipVideos);

            // Restore current tab
            if (sessionData.currentTab !== undefined) {
                console.log('Switching to tab:', sessionData.currentTab);
                switchTab(sessionData.currentTab);
            }

            // Update current tab references
            clipVideos = tabClipVideos[currentTab];
            clipCuePoints = tabClipCuePoints[currentTab];
            clipSpeeds = tabClipSpeeds[currentTab];
            console.log('Current tab video data:', clipVideos);

            // Restore folder path
            if (sessionData.currentFolderPath) {
                currentFolderPath = sessionData.currentFolderPath;
                currentPathDisplay.textContent = currentFolderPath;
            }

            // Restore global play intent
            if (sessionData.globalPlayIntent !== undefined) {
                globalPlayIntent = sessionData.globalPlayIntent;
                updatePlayButtonState();
            }

            // Restore keyboard shortcuts
            if (sessionData.keyboardShortcuts) {
                keyboardShortcuts = { ...keyboardShortcuts, ...sessionData.keyboardShortcuts };
            }

            // Restore session name
            currentSessionName = sessionData.sessionName;
            sessionModified = false;
            updateSessionStatus(`Loaded: ${currentSessionName || 'Unnamed session'}`);

            // Refresh UI to show restored slots
            refreshClipMatrix();

            // Inform user about video file reconnection
            if (Object.keys(clipVideos).length > 0) {
                alert('Session loaded successfully! Video slots are restored but videos need to be reconnected. Please browse to the folder containing your video files to automatically reconnect them.');
            }

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
            tabClipCuePoints[i] = {};
            tabClipSpeeds[i] = {};
        }

        // Update current references
        clipVideos = tabClipVideos[currentTab];
        clipCuePoints = tabClipCuePoints[currentTab];
        clipSpeeds = tabClipSpeeds[currentTab];

        // Clear UI
        refreshClipMatrix();
        updateCuePointsList();
        updateCueMarkersOnTimeline();
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

                    // Create new blob URL for this file
                    const url = URL.createObjectURL(file);
                    console.log(`Created blob URL: ${url}`);

                    // Update the video data with new file reference
                    videoData.url = url;
                    videoData.file = file;
                    videoData.type = 'file'; // Update type since it's now properly loaded

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
                // Check if dragging file from browser OR external file explorer
                if (window.draggedFile || (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files'))) {
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

            // Add drag and drop handlers
            setupClipSlotDropZone(clipSlot);

            clipsMatrix.appendChild(clipSlot);
        }
        console.log('Created 6x6 clip matrix with 36 slots');
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

                video.load();
                console.log('Loaded video for selected slot:', videoData.name);
            } else {
                // Video data exists but no valid URL - this is from a loaded session
                console.warn(`Video slot ${clipNumber} has data but no valid URL:`, videoData);
                console.log('Video needs to be reconnected from file browser');

                // Clear the video player
                video.src = '';
                video.load();

                // Show user-friendly message
                if (videoData.name) {
                    alert(`Video "${videoData.name}" needs to be reconnected. Please browse to the folder containing your video files.`);
                }
            }

            // If we were playing before, continue playing the new clip
            if (wasPlaying) {
                video.addEventListener('loadeddata', function() {
                    // Apply the correct speed for this clip
                    const clipSpeed = clipSpeeds[clipNumber] || 1.0;
                    setVideoSpeed(clipSpeed);

                    video.play().then(() => {
                        console.log('Auto-playing new clip due to global play state');
                        // globalPlayIntent unchanged - was already true
                    }).catch(e => {
                        console.error('Error auto-playing new clip:', e);
                        // globalPlayIntent unchanged - keep user's intent
                    });
                }, { once: true });
            } else {
                // Apply speed even when not auto-playing
                video.addEventListener('loadeddata', function() {
                    const clipSpeed = clipSpeeds[clipNumber] || 1.0;
                    setVideoSpeed(clipSpeed);
                }, { once: true });

                // Make sure button state is correct when not playing
                // globalPlayIntent unchanged - keep user's intent
                updatePlayButtonState();
            }
        } else {
            // No video in this slot
            // globalPlayIntent unchanged - keep user's intent
            updatePlayButtonState();
        }

        // Update cue points list for the newly selected clip
        updateCuePointsList();
        updateCueMarkersOnTimeline();
        updateSpeedControls();
    }

    // Update visual appearance of slot based on whether it has video
    function updateSlotAppearance(slot, hasVideo) {
        if (hasVideo) {
            slot.classList.add('has-video');
            const clipNumber = slot.dataset.clipNumber;
            const videoData = clipVideos[clipNumber];
            slot.innerHTML = `<div>Clip ${clipNumber}</div><div style="font-size: 10px; margin-top: 2px;">${videoData.name}</div>`;
        } else {
            slot.classList.remove('has-video');
            slot.textContent = `Clip ${slot.dataset.clipNumber}`;
        }
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

    // Update pause/play button appearance based on global intent
    function updatePlayButtonState() {
        if (globalPlayIntent) {
            pausePlayBtn.textContent = '⏸';
            pausePlayBtn.classList.add('playing');
        } else {
            pausePlayBtn.textContent = '▶';
            pausePlayBtn.classList.remove('playing');
        }
    }

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
        updateCuePointsList();
        updateCueMarkersOnTimeline();
    }

    // Speed control functions
    function setVideoSpeed(speed) {
        if (video.src) {
            video.playbackRate = speed;
            console.log(`Set video speed to ${speed}x`);
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

    // Update the visual display of cue points for the currently selected clip
    function updateCuePointsList() {
        if (!selectedClipSlot) {
            cuePointsList.innerHTML = '<p class="no-cue-points">No clip selected</p>';
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const cuePoints = clipCuePoints[clipNumber] || [];

        if (cuePoints.length === 0) {
            cuePointsList.innerHTML = '<p class="no-cue-points">No cue points recorded</p>';
            return;
        }

        // Build the cue points list HTML
        let html = '';
        cuePoints.forEach((cuePoint, index) => {
            html += `
                <div class="cue-point-item">
                    <span>Cue ${index + 1}</span>
                    <span class="cue-point-time">${formatTime(cuePoint.time)}</span>
                </div>
            `;
        });

        cuePointsList.innerHTML = html;
    }

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

        if (cuePoints.length > 0) {
            // Jump to first cue point
            const firstCuePoint = cuePoints[0];
            video.currentTime = firstCuePoint.time;
            console.log(`Restarted clip to first cue point: ${formatTime(firstCuePoint.time)}`);
        } else {
            // Jump to beginning if no cue points
            video.currentTime = 0;
            console.log('Restarted clip to beginning (no cue points)');
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

        const currentTime = video.currentTime;

        // Find the previous cue point (the last one that's before current time)
        let targetCuePoint = null;

        for (let i = cuePoints.length - 1; i >= 0; i--) {
            if (cuePoints[i].time < currentTime - 0.1) { // 0.1 second tolerance
                targetCuePoint = cuePoints[i];
                break;
            }
        }

        if (targetCuePoint) {
            video.currentTime = targetCuePoint.time;
            console.log(`Navigated to previous cue point: ${formatTime(targetCuePoint.time)}`);
        } else {
            // If no previous cue point found, go to beginning
            video.currentTime = 0;
            console.log('Navigated to beginning (no previous cue point)');
        }
    }

    // Navigate to the next cue point
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

        const cuePoints = clipCuePoints[clipNumber] || [];

        if (cuePoints.length === 0) {
            alert('No cue points to navigate to');
            return;
        }

        const currentTime = video.currentTime;

        // Find the next cue point (the first one that's after current time)
        let targetCuePoint = null;

        for (let i = 0; i < cuePoints.length; i++) {
            if (cuePoints[i].time > currentTime + 0.1) { // 0.1 second tolerance
                targetCuePoint = cuePoints[i];
                break;
            }
        }

        if (targetCuePoint) {
            video.currentTime = targetCuePoint.time;
            console.log(`Navigated to next cue point: ${formatTime(targetCuePoint.time)}`);
        } else {
            // Silently do nothing when no more cue points ahead
            console.log('No more cue points ahead');
        }
    }

    // Timeline functionality
    let isDragging = false;
    let videoDuration = 0;

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

        const currentTime = video.currentTime;
        const progress = (currentTime / videoDuration) * 100;

        if (!isDragging) {
            timelineProgress.style.width = `${progress}%`;
            timelineHandle.style.left = `${progress}%`;
        }

        currentTimeDisplay.textContent = formatTimeShort(currentTime);
        totalDurationDisplay.textContent = formatTimeShort(videoDuration);
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

        const rect = timelineTrack.getBoundingClientRect();

        function onMouseMove(e) {
            if (!isDragging || videoDuration === 0) return;

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
        allTabButtons.forEach((btn, index) => {
            if (index === tabIndex) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Save current tab state and switch to new tab
        currentTab = tabIndex;

        // Update legacy references to point to new tab's data
        clipVideos = tabClipVideos[currentTab];
        clipCuePoints = tabClipCuePoints[currentTab];
        clipSpeeds = tabClipSpeeds[currentTab];

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
        updateCuePointsList();
        updateCueMarkersOnTimeline();
        updateSpeedControls();
        updatePlayButtonState();
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

        // Memory management: Revoke old blob URL if it exists
        if (clipVideos[clipNumber] && clipVideos[clipNumber].url) {
            URL.revokeObjectURL(clipVideos[clipNumber].url);
            console.log(`Revoked old blob URL for clip ${clipNumber}`);
        }

        const url = URL.createObjectURL(file);

        // Store video information
        clipVideos[clipNumber] = {
            name: file.name,
            url: url,
            file: file
        };

        // Mark session as modified
        markSessionModified();

        // Update slot appearance
        updateSlotAppearance(selectedClipSlot, clipVideos[clipNumber]);

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

        updateCuePointsList();
        updateCueMarkersOnTimeline();
    }

    // Browse folder using File System Access API (Chrome) with fallback
    async function browseFolder() {
        try {
            // Try modern File System Access API first (Chrome 86+)
            if ('showDirectoryPicker' in window) {
                const dirHandle = await window.showDirectoryPicker();
                const files = [];

                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        files.push(file);
                    }
                }

                currentFolderPath = dirHandle.name;
                currentPathDisplay.textContent = currentFolderPath;
                displayFiles(files);
                upFolderBtn.disabled = false;

            } else {
                // Fallback: Use directory input (WebKit)
                const input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                input.multiple = true;

                input.onchange = function(e) {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        // Get folder path from first file
                        const firstFile = files[0];
                        const pathParts = firstFile.webkitRelativePath.split('/');
                        currentFolderPath = pathParts[0];
                        currentPathDisplay.textContent = currentFolderPath;

                        // Filter to only show files in root directory
                        const rootFiles = files.filter(file => {
                            const parts = file.webkitRelativePath.split('/');
                            return parts.length === 2; // folder/file.ext
                        });

                        displayFiles(rootFiles);
                        upFolderBtn.disabled = false;
                    }
                };

                input.click();
            }
        } catch (error) {
            console.error('Error accessing folder:', error);
            alert('Unable to access folder. Please try again.');
        }
    }

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
        // Don't trigger shortcuts if typing in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // Check each shortcut
        for (const [action, shortcut] of Object.entries(keyboardShortcuts)) {
            if (matchesShortcut(event, shortcut)) {
                event.preventDefault();
                event.stopPropagation();

                switch (action) {
                    case 'playPause':
                        pausePlayBtn.click();
                        break;
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
                    case 'reversePlay':
                        reverseBtn.click();
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

    // Keyboard shortcuts modal functions
    let tempKeyboardShortcuts = {}; // Temporary storage for editing
    let currentEditingAction = null;

    const shortcutLabels = {
        'playPause': 'Play/Pause',
        'previousClip': 'Previous Clip',
        'nextClip': 'Next Clip',
        'previousCuePoint': 'Previous Cue Point',
        'nextCuePoint': 'Next Cue Point',
        'restartClip': 'Restart Clip',
        'recordCuePoint': 'Record Cue Point',
        'reversePlay': 'Reverse Play',
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
        shortcutsModal.style.display = 'block';
    }

    function closeShortcutsModalFunc() {
        shortcutsModalOpen = false;
        currentEditingAction = null;
        shortcutsModal.style.display = 'none';
        // Clear any editing states
        document.querySelectorAll('.shortcut-input.editing').forEach(input => {
            input.classList.remove('editing');
        });
    }

    function populateShortcutsGrid() {
        shortcutsGrid.innerHTML = '';

        for (const [action, label] of Object.entries(shortcutLabels)) {
            const row = document.createElement('div');
            row.className = 'shortcut-row';

            const labelDiv = document.createElement('div');
            labelDiv.className = 'shortcut-label';
            labelDiv.textContent = label;

            const inputDiv = document.createElement('div');
            inputDiv.className = 'shortcut-input';
            inputDiv.textContent = tempKeyboardShortcuts[action];
            inputDiv.dataset.action = action;

            inputDiv.addEventListener('click', function() {
                startEditingShortcut(action, inputDiv);
            });

            row.appendChild(labelDiv);
            row.appendChild(inputDiv);
            shortcutsGrid.appendChild(row);
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
            'playPause': 'Space',
            'previousClip': 'ArrowLeft',
            'nextClip': 'ArrowRight',
            'previousCuePoint': 'q',
            'nextCuePoint': 'w',
            'restartClip': 'r',
            'recordCuePoint': 'c',
            'reversePlay': 'Shift+r',
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

    // Event listeners for file browser
    browseFolderBtn.addEventListener('click', browseFolder);

    upFolderBtn.addEventListener('click', function() {
        // For now, just clear the file list and reset to initial state
        fileList.innerHTML = `
            <div class="file-item other-file">
                <span class="file-name">Click "Browse Folder" to start...</span>
                <span class="file-size"></span>
            </div>
        `;
        currentPathDisplay.textContent = 'Select folder to browse...';
        currentFolderPath = '';
        upFolderBtn.disabled = true;
    });

    // Initialize the matrix
    createClipMatrix();

    // Initialize tab event listeners
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((button, index) => {
        button.addEventListener('click', function() {
            switchTab(index);
        });
    });

    // Initialize UI state
    updatePlayButtonState();
    updateCuePointsList();
    updateSpeedControls();
    updateSessionStatus('No session loaded');

    // Transport control event listeners

    // Previous Clip button
    prevClipBtn.addEventListener('click', function() {
        console.log('=== PREVIOUS CLIP BUTTON CLICKED ===');
        navigateToClip('previous');
    });

    // Reverse Play button (placeholder for now)
    reverseBtn.addEventListener('click', function() {
        console.log('Reverse play button clicked');

        if (!selectedClipSlot) {
            console.log('No clip selected for reverse playback');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const videoData = clipVideos[clipNumber];

        if (!videoData) {
            console.log('No video loaded in selected slot for reverse playback');
            return;
        }

        // Set negative playback rate for reverse
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            video.playbackRate = -1.0;

            // If video is paused, start playing in reverse
            if (video.paused) {
                globalPlayIntent = true;
                video.play().then(() => {
                    console.log('Started reverse playback');
                    updatePlayButtonState();
                }).catch(e => {
                    console.error('Error starting reverse playback:', e);
                });
            } else {
                console.log('Switched to reverse playback');
            }
        } else {
            console.log('Video not ready for reverse playback');
        }
    });

    // Pause/Play toggle button
    pausePlayBtn.addEventListener('click', function() {
        console.log('Pause/Play button clicked');
        if (!video.src) {
            alert('Please select a clip with video first');
            return;
        }

        // Toggle the global play intent based on user action
        globalPlayIntent = !globalPlayIntent;
        updatePlayButtonState();

        if (globalPlayIntent) {
            video.play().then(() => {
                console.log('Video started playing');
            }).catch(e => {
                console.error('Error playing video:', e);
                alert('Error playing video: ' + e.message);
            });
        } else {
            video.pause();
            console.log('Video paused by user');
        }
    });

    // Forward Play button
    forwardBtn.addEventListener('click', function() {
        console.log('Forward play button clicked');

        if (!selectedClipSlot) {
            alert('Please select a clip slot first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const videoData = clipVideos[clipNumber];

        if (!videoData) {
            alert('Please load a video into the selected clip slot first');
            return;
        }

        if (!video.src) {
            alert('No video loaded in player - please select a clip with video');
            return;
        }

        // Set normal forward playback rate (restore from reverse if needed)
        const clipSpeed = clipSpeeds[clipNumber] || 1.0;
        video.playbackRate = clipSpeed;

        // Set global intent to play when Forward Play is pressed
        globalPlayIntent = true;
        updatePlayButtonState();

        video.play().then(() => {
            console.log('Video started playing forward at speed:', clipSpeed);
        }).catch(e => {
            console.error('Error playing video:', e);
            alert('Error playing video: ' + e.message);
        });
    });

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

    loadSessionBtn.addEventListener('click', function() {
        console.log('Load session button clicked');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                loadSessionFromFile(file);
            }
        };
        input.click();
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

    // Video event listeners for debugging and state management
    video.addEventListener('play', function() {
        console.log('Video play event fired');
        currentVideoPlaying = true;
        // Note: Don't change globalPlayIntent here - only user actions should
    });

    video.addEventListener('pause', function() {
        console.log('Video pause event fired');
        currentVideoPlaying = false;
        // Note: Don't change globalPlayIntent here - only user actions should
    });

    video.addEventListener('ended', function() {
        console.log('Video ended - global play intent remains unchanged');
        currentVideoPlaying = false;
        // Key change: Don't change globalPlayIntent when video ends
        // The user's intent to "play" should persist until they choose "pause"
    });

    video.addEventListener('timeupdate', function() {
        updateTimeline();
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

    // Output Window Functions
    function createOutputWindow() {
        if (outputWindow && !outputWindow.closed) {
            outputWindow.focus();
            return;
        }

        // Create popup window
        outputWindow = window.open('', 'OutputWindow', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');

        if (!outputWindow) {
            alert('Failed to open output window. Please allow popups for this site.');
            return;
        }

        // Write HTML for output window
        outputWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Mimolume Output</title>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        background-color: #000;
                        overflow: hidden;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                    }
                    video {
                        max-width: 100%;
                        max-height: 100vh;
                        width: auto;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                <video id="outputVideo" muted></video>
            </body>
            </html>
        `);
        outputWindow.document.close();

        // Get reference to output video element
        outputVideo = outputWindow.document.getElementById('outputVideo');

        // Ensure output video is also muted for performance
        outputVideo.muted = true;
        outputVideo.volume = 0;
        outputVideo.preload = 'auto';

        // Sync current video to output
        syncToOutputWindow();

        // Update button text
        outputWindowBtn.textContent = 'Close Output Window';

        console.log('Output window created');
    }

    function closeOutputWindow() {
        if (outputWindow && !outputWindow.closed) {
            outputWindow.close();
        }
        outputWindow = null;
        outputVideo = null;
        outputWindowBtn.textContent = 'Open Output Window';
        console.log('Output window closed');
    }

    function syncToOutputWindow() {
        if (!outputVideo || !video.src) {
            return;
        }

        // Sync video source
        if (outputVideo.src !== video.src) {
            outputVideo.src = video.src;
            outputVideo.load();
        }

        // Sync playback state
        outputVideo.currentTime = video.currentTime;
        outputVideo.playbackRate = video.playbackRate;

        if (!video.paused) {
            outputVideo.play().catch(e => console.error('Error playing output video:', e));
        } else {
            outputVideo.pause();
        }
    }

    // Add event listeners to sync output window with main video
    video.addEventListener('loadeddata', function() {
        if (outputVideo) {
            syncToOutputWindow();
        }
    });

    video.addEventListener('play', function() {
        if (outputVideo && outputVideo.paused) {
            outputVideo.play().catch(e => console.error('Error playing output video:', e));
        }
    });

    video.addEventListener('pause', function() {
        if (outputVideo && !outputVideo.paused) {
            outputVideo.pause();
        }
    });

    video.addEventListener('seeked', function() {
        if (outputVideo) {
            outputVideo.currentTime = video.currentTime;
        }
    });

    video.addEventListener('ratechange', function() {
        if (outputVideo) {
            outputVideo.playbackRate = video.playbackRate;
        }
    });

    // Output window button click handler
    outputWindowBtn.addEventListener('click', function() {
        if (!outputWindow || outputWindow.closed) {
            createOutputWindow();
        } else {
            closeOutputWindow();
        }
    });

    // Check if output window was closed by user
    setInterval(function() {
        if (outputWindow && outputWindow.closed) {
            outputWindow = null;
            outputVideo = null;
            outputWindowBtn.textContent = 'Open Output Window';
        }
    }, 1000);

    // Memory management: Clean up blob URLs when window closes
    window.addEventListener('beforeunload', function() {
        console.log('Cleaning up resources before window closes...');

        // Revoke all blob URLs
        for (let i = 0; i < 5; i++) {
            const tabVideos = tabClipVideos[i];
            Object.keys(tabVideos).forEach(clipNumber => {
                if (tabVideos[clipNumber] && tabVideos[clipNumber].url) {
                    URL.revokeObjectURL(tabVideos[clipNumber].url);
                }
            });
        }

        // Close output window if open
        if (outputWindow && !outputWindow.closed) {
            outputWindow.close();
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