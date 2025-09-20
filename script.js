document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const loadTestVideoBtn = document.getElementById('loadTestVideo');
    const fileInput = document.getElementById('fileInput');

    // Load test video functionality
    loadTestVideoBtn.addEventListener('click', function() {
        console.log('Loading test video...');
        video.src = 'test-videos/test-video.mp4';
        video.load();

        video.addEventListener('loadeddata', function() {
            console.log('Test video loaded successfully');
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
            console.log('Loading file:', file.name);
            const url = URL.createObjectURL(file);
            video.src = url;
            video.load();

            video.addEventListener('loadeddata', function() {
                console.log('File loaded successfully');
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