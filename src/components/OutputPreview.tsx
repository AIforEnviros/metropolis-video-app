import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import ReactPlayer from 'react-player';

const PreviewContainer = styled.div`
  flex: 1;
  background-color: #000;
  border: 2px solid #555;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
`;

const PreviewHeader = styled.div`
  background-color: #333;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: bold;
  border-bottom: 1px solid #555;
`;

const PreviewWindow = styled.div`
  flex: 1;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 16px;
  text-align: center;
  position: relative;
`;

const PlayerContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .react-player {
    width: 100% !important;
    height: 100% !important;
  }
`;

const PlaceholderText = styled.div`
  color: #666;
  font-size: 14px;
  text-align: center;
  padding: 20px;
`;

const PreviewControls = styled.div`
  background-color: #333;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #555;
`;

const TimeDisplay = styled.div`
  font-size: 12px;
  color: #ccc;
  font-family: monospace;
`;

const StatusIndicator = styled.div<{ isPlaying?: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.isPlaying ? '#4CAF50' : '#f44336'};
`;

interface OutputPreviewProps {
  currentVideo?: string | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  onProgress?: (state: any) => void;
  onDuration?: (duration: number) => void;
  playbackRate?: number;
}

const OutputPreview: React.FC<OutputPreviewProps> = ({
  currentVideo,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onProgress,
  onDuration,
  playbackRate = 1,
}) => {
  const playerRef = useRef<ReactPlayer>(null);
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Seek to specific time when currentTime prop changes
  useEffect(() => {
    if (playerRef.current && currentTime !== undefined) {
      playerRef.current.seekTo(currentTime, 'seconds');
    }
  }, [currentTime]);

  return (
    <PreviewContainer>
      <PreviewHeader>
        Output Preview
      </PreviewHeader>

      <PreviewWindow>
        {currentVideo ? (
          <PlayerContainer>
            <ReactPlayer
              ref={playerRef}
              url={currentVideo}
              playing={isPlaying}
              muted={true}
              width="100%"
              height="100%"
              playbackRate={playbackRate}
              onProgress={onProgress}
              onDuration={onDuration}
              onError={(error) => console.error('Video playback error:', error)}
              config={{
                file: {
                  attributes: {
                    style: { width: '100%', height: '100%', objectFit: 'contain' }
                  }
                }
              }}
            />
          </PlayerContainer>
        ) : (
          <PlaceholderText>
            No video selected<br />
            Select a clip from the matrix to preview
          </PlaceholderText>
        )}
      </PreviewWindow>

      <PreviewControls>
        <TimeDisplay>
          {formatTime(currentTime)} / {formatTime(duration)}
        </TimeDisplay>
        <StatusIndicator isPlaying={isPlaying} />
      </PreviewControls>
    </PreviewContainer>
  );
};

export default OutputPreview;