document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const prevClipBtn = document.getElementById('prevClipBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const pausePlayBtn = document.getElementById('pausePlayBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const nextClipBtn = document.getElementById('nextClipBtn');

    const loadTestVideoBtn = document.getElementById('loadTestVideo');
    const fileInput = document.getElementById('fileInput');
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

    // Initialize tab data structures
    for (let i = 0; i < 5; i++) {
        tabClipVideos[i] = {};
        tabClipCuePoints[i] = {};
    }

    // Legacy references for current tab's data (for compatibility)
    let clipVideos = tabClipVideos[currentTab];
    let clipCuePoints = tabClipCuePoints[currentTab];

    // File browser state
    let currentFolderPath = '';
    let currentFolderFiles = [];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];

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

            clipsMatrix.appendChild(clipSlot);
        }
        console.log('Created 6x6 clip matrix with 36 slots');
    }

    // Handle clip selection
    function selectClipSlot(clipSlot) {
        // Remove selected class from previously selected slot
        if (selectedClipSlot) {
            selectedClipSlot.classList.remove('selected');
        }

        // Add selected class to new slot
        clipSlot.classList.add('selected');
        selectedClipSlot = clipSlot;

        const clipNumber = clipSlot.dataset.clipNumber;
        console.log(`Selected clip slot ${clipNumber}`);

        // If this slot has a video, load it in the preview
        if (clipVideos[clipNumber]) {
            const wasPlaying = globalPlayIntent;
            video.src = clipVideos[clipNumber].url;
            video.load();
            console.log('Loaded video for selected slot:', clipVideos[clipNumber].name);

            // If we were playing before, continue playing the new clip
            if (wasPlaying) {
                video.addEventListener('loadeddata', function() {
                    video.play().then(() => {
                        console.log('Auto-playing new clip due to global play state');
                        // globalPlayIntent unchanged - was already true
                    }).catch(e => {
                        console.error('Error auto-playing new clip:', e);
                        // globalPlayIntent unchanged - keep user's intent
                    });
                }, { once: true });
            } else {
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
        const allSlots = Array.from(document.querySelectorAll('.clip-slot'));
        const loadedSlots = allSlots.filter(slot => {
            const clipNumber = slot.dataset.clipNumber;
            return clipVideos[clipNumber];
        });

        if (loadedSlots.length === 0) {
            alert('No clips with videos loaded');
            return;
        }

        let currentIndex = -1;
        if (selectedClipSlot) {
            currentIndex = loadedSlots.findIndex(slot => slot === selectedClipSlot);
        }

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % loadedSlots.length;
        } else {
            nextIndex = (currentIndex - 1 + loadedSlots.length) % loadedSlots.length;
        }

        const targetSlot = loadedSlots[nextIndex];
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

        // Update the display
        updateCuePointsList();
        updateCueMarkersOnTimeline();
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
            alert('No more cue points ahead');
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
        updatePlayButtonState();
    }

    // Refresh the clip matrix to show current tab's video states
    function refreshClipMatrix() {
        const allSlots = document.querySelectorAll('.clip-slot');
        allSlots.forEach(slot => {
            const clipNumber = slot.dataset.clipNumber;
            const hasVideo = clipVideos[clipNumber];
            updateSlotAppearance(slot, hasVideo);
        });
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

            // Add click handler for video files to load them
            if (isVideo) {
                fileItem.addEventListener('click', function() {
                    loadVideoFromFile(file);
                });
                fileItem.style.cursor = 'pointer';
                fileItem.title = `Click to load ${file.name} into selected clip slot`;
            }

            fileList.appendChild(fileItem);
        });
    }

    function loadVideoFromFile(file) {
        if (!selectedClipSlot) {
            alert('Please select a clip slot first');
            return;
        }

        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const url = URL.createObjectURL(file);

        // Store video information
        clipVideos[clipNumber] = {
            name: file.name,
            url: url,
            file: file
        };

        // Update slot appearance
        updateSlotAppearance(selectedClipSlot, clipVideos[clipNumber]);

        // Load video in player
        video.src = url;
        video.load();

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

    // Load test video functionality
    loadTestVideoBtn.addEventListener('click', function() {
        if (!selectedClipSlot) {
            alert('Please select a clip slot first');
            return;
        }

        console.log('Loading test video into slot', selectedClipSlot.dataset.clipNumber);
        const clipNumber = selectedClipSlot.dataset.clipNumber;
        const videoUrl = 'test-videos/test-video.mp4';

        // Store video data for this slot
        clipVideos[clipNumber] = {
            url: videoUrl,
            name: 'Test Video',
            type: 'test'
        };

        // Update the video player to show this video
        const wasPlaying = isPlaying;
        video.src = videoUrl;
        video.load();

        // Update the visual appearance of the slot
        updateSlotAppearance(selectedClipSlot, true);

        video.addEventListener('loadeddata', function() {
            console.log('Test video loaded successfully into slot', clipNumber);
            // Continue playing if we were playing before
            if (wasPlaying) {
                video.play().then(() => {
                    console.log('Auto-continuing playback after loading test video');
                }).catch(e => {
                    console.error('Error continuing playback:', e);
                });
            }
        }, { once: true });

        video.addEventListener('error', function(e) {
            console.error('Error loading test video:', e);
            alert('Error loading test video. Please check the file exists.');
        });
    });

    // File input functionality
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (!selectedClipSlot) {
                alert('Please select a clip slot first');
                return;
            }

            console.log('Loading file into slot', selectedClipSlot.dataset.clipNumber, ':', file.name);
            const clipNumber = selectedClipSlot.dataset.clipNumber;
            const url = URL.createObjectURL(file);

            // Store video data for this slot
            clipVideos[clipNumber] = {
                url: url,
                name: file.name,
                type: 'file',
                file: file
            };

            // Update the video player to show this video
            const wasPlaying = globalPlayIntent;
            video.src = url;
            video.load();

            // Update the visual appearance of the slot
            updateSlotAppearance(selectedClipSlot, true);

            video.addEventListener('loadeddata', function() {
                console.log('File loaded successfully into slot', clipNumber);
                // Continue playing if we were playing before
                if (wasPlaying) {
                    video.play().then(() => {
                        console.log('Auto-continuing playback after loading file');
                    }).catch(e => {
                        console.error('Error continuing playback:', e);
                    });
                }
            }, { once: true });
        }
    });

    // Previous Clip button
    prevClipBtn.addEventListener('click', function() {
        console.log('Previous clip button clicked');
        navigateToClip('previous');
    });

    // Reverse Play button (placeholder for now)
    reverseBtn.addEventListener('click', function() {
        console.log('Reverse play button clicked');
        alert('Reverse play functionality coming soon!');
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
        if (!video.src) {
            alert('Please select a clip with video first');
            return;
        }

        // Set global intent to play when Forward Play is pressed
        globalPlayIntent = true;
        updatePlayButtonState();

        video.play().then(() => {
            console.log('Video started playing forward');
        }).catch(e => {
            console.error('Error playing video:', e);
            alert('Error playing video: ' + e.message);
        });
    });

    // Next Clip button
    nextClipBtn.addEventListener('click', function() {
        console.log('Next clip button clicked');
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
});