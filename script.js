document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
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

    // Initialize the matrix
    createClipMatrix();

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

    // Play button
    playBtn.addEventListener('click', function() {
        console.log('Play button clicked');
        if (video.src) {
            video.play().then(() => {
                console.log('Video started playing');
            }).catch(e => {
                console.error('Error playing video:', e);
                alert('Error playing video: ' + e.message);
            });
        } else {
            alert('Please load a video first');
        }
    });

    // Pause button
    pauseBtn.addEventListener('click', function() {
        console.log('Pause button clicked');
        if (video.src) {
            video.pause();
            console.log('Video paused');
        } else {
            alert('Please load a video first');
        }
    });

    // Video event listeners for debugging
    video.addEventListener('play', function() {
        console.log('Video play event fired');
    });

    video.addEventListener('pause', function() {
        console.log('Video pause event fired');
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