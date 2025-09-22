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

    // Track global play intent (user's desired state)
    let globalPlayIntent = false; // true = user wants playing, false = user wants paused

    // Track current video playing state (actual video state)
    let currentVideoPlaying = false;

    // Track the currently selected clip
    let selectedClipSlot = null;

    // Track videos loaded into each slot (clipNumber -> video data)
    const clipVideos = {};

    // Track cue points for each clip (clipNumber -> array of cue point objects)
    const clipCuePoints = {};

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

    // Initialize the matrix
    createClipMatrix();

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
        // Only log occasionally to avoid spam
        if (Math.floor(video.currentTime) % 5 === 0) {
            console.log('Video time:', video.currentTime);
        }
    });
});