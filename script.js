document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const prevClipBtn = document.getElementById('prevClipBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const pausePlayBtn = document.getElementById('pausePlayBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const nextClipBtn = document.getElementById('nextClipBtn');

    // Track current playing state
    let isPlaying = false;
    const loadTestVideoBtn = document.getElementById('loadTestVideo');
    const fileInput = document.getElementById('fileInput');
    const clipsMatrix = document.getElementById('clipsMatrix');

    // Track the currently selected clip
    let selectedClipSlot = null;

    // Track videos loaded into each slot (clipNumber -> video data)
    const clipVideos = {};

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
            video.src = clipVideos[clipNumber].url;
            video.load();
            console.log('Loaded video for selected slot:', clipVideos[clipNumber].name);
        }
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

    // Update pause/play button appearance
    function updatePlayButtonState() {
        if (isPlaying) {
            pausePlayBtn.textContent = '⏸';
            pausePlayBtn.classList.add('playing');
        } else {
            pausePlayBtn.textContent = '▶';
            pausePlayBtn.classList.remove('playing');
        }
    }

    // Initialize the matrix
    createClipMatrix();

    // Initialize UI state
    updatePlayButtonState();

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
        video.src = videoUrl;
        video.load();

        // Update the visual appearance of the slot
        updateSlotAppearance(selectedClipSlot, true);

        video.addEventListener('loadeddata', function() {
            console.log('Test video loaded successfully into slot', clipNumber);
        });

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
            video.src = url;
            video.load();

            // Update the visual appearance of the slot
            updateSlotAppearance(selectedClipSlot, true);

            video.addEventListener('loadeddata', function() {
                console.log('File loaded successfully into slot', clipNumber);
            });
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

        if (isPlaying) {
            video.pause();
        } else {
            video.play().then(() => {
                console.log('Video started playing');
            }).catch(e => {
                console.error('Error playing video:', e);
                alert('Error playing video: ' + e.message);
            });
        }
    });

    // Forward Play button
    forwardBtn.addEventListener('click', function() {
        console.log('Forward play button clicked');
        if (!video.src) {
            alert('Please select a clip with video first');
            return;
        }

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

    // Video event listeners for debugging and state management
    video.addEventListener('play', function() {
        console.log('Video play event fired');
        isPlaying = true;
        updatePlayButtonState();
    });

    video.addEventListener('pause', function() {
        console.log('Video pause event fired');
        isPlaying = false;
        updatePlayButtonState();
    });

    video.addEventListener('ended', function() {
        console.log('Video ended');
    });

    video.addEventListener('timeupdate', function() {
        // Only log occasionally to avoid spam
        if (Math.floor(video.currentTime) % 5 === 0) {
            console.log('Video time:', video.currentTime);
        }
    });
});