import React, { useState } from 'react';
import styled from 'styled-components';
import { useVideoStore } from '../store/videoStore';

const ControlsContainer = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
`;

const ControlButton = styled.button<{ active?: boolean; disabled?: boolean }>`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: ${props =>
    props.disabled ? '#222' :
    props.active ? '#555' : '#333'
  };
  border: 2px solid ${props =>
    props.disabled ? '#444' :
    props.active ? '#777' : '#555'
  };
  color: ${props => props.disabled ? '#666' : '#fff'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.5 : 1};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${props => props.active ? '#666' : '#444'};
    border-color: #777;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

const ControlLabel = styled.div`
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
  color: #ccc;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface TransportState {
  isPlaying: boolean;
  isReverse: boolean;
}

const TransportControls: React.FC = () => {
  const [transportState, setTransportState] = useState<TransportState>({
    isPlaying: false,
    isReverse: false,
  });

  const {
    currentVideo,
    isPlaying,
    playbackRate,
    setPlaying,
    setPlaybackRate,
  } = useVideoStore();

  const handlePreviousClip = () => {
    console.log('Previous Clip');
    // TODO: Implement previous clip logic - navigate to previous slot with video
  };

  const handleReversePlay = () => {
    if (!currentVideo) return;

    setPlaybackRate(-1);
    setPlaying(true);
    setTransportState(prev => ({
      ...prev,
      isPlaying: true,
      isReverse: true,
    }));
    console.log('Reverse Play');
  };

  const handlePause = () => {
    if (!currentVideo) return;

    const newPlayingState = !isPlaying;
    setPlaying(newPlayingState);
    setTransportState(prev => ({
      ...prev,
      isPlaying: newPlayingState,
      isReverse: false,
    }));

    if (newPlayingState) {
      setPlaybackRate(1); // Reset to normal speed when resuming
    }

    console.log(newPlayingState ? 'Play' : 'Pause');
  };

  const handleForwardPlay = () => {
    if (!currentVideo) return;

    setPlaybackRate(1);
    setPlaying(true);
    setTransportState(prev => ({
      ...prev,
      isPlaying: true,
      isReverse: false,
    }));
    console.log('Forward Play');
  };

  const handleNextClip = () => {
    console.log('Next Clip');
    // TODO: Implement next clip logic - navigate to next slot with video
  };

  return (
    <ControlsContainer>
      <ControlGroup>
        <ControlButton onClick={handlePreviousClip}>
          ⏮
        </ControlButton>
        <ControlLabel>Previous<br />Clip</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          onClick={handleReversePlay}
          active={isPlaying && playbackRate < 0}
          disabled={!currentVideo}
        >
          ⏪
        </ControlButton>
        <ControlLabel>Reverse<br />Play</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          onClick={handlePause}
          disabled={!currentVideo}
        >
          {isPlaying ? '⏸' : '▶'}
        </ControlButton>
        <ControlLabel>{isPlaying ? 'Pause' : 'Play'}</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          onClick={handleForwardPlay}
          active={isPlaying && playbackRate > 0}
          disabled={!currentVideo}
        >
          ▶
        </ControlButton>
        <ControlLabel>Forward<br />Play</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton onClick={handleNextClip}>
          ⏭
        </ControlButton>
        <ControlLabel>Next<br />Clip</ControlLabel>
      </ControlGroup>
    </ControlsContainer>
  );
};

export default TransportControls;