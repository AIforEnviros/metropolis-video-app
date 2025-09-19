import React, { useState } from 'react';
import styled from 'styled-components';

const ControlsContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background-color: #333;
  border-radius: 8px;
  border: 1px solid #555;
`;

const ControlButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: ${props =>
    props.variant === 'primary' ? '#d32f2f' : '#444'
  };
  border: 2px solid ${props =>
    props.variant === 'primary' ? '#f44336' : '#666'
  };
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props =>
      props.variant === 'primary' ? '#e53935' : '#555'
    };
    border-color: ${props =>
      props.variant === 'primary' ? '#ff5722' : '#777'
    };
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const ControlLabel = styled.div`
  font-size: 10px;
  color: #ccc;
  text-align: center;
  line-height: 1.2;
`;

const CuePointInfo = styled.div`
  background-color: #2a2a2a;
  border-radius: 4px;
  padding: 8px 12px;
  margin-left: 16px;
  font-size: 12px;
  color: #ccc;
  min-width: 80px;
  text-align: center;
`;

interface CuePointState {
  currentCuePoint: number;
  totalCuePoints: number;
}

const CuePointControls: React.FC = () => {
  const [cuePointState, setCuePointState] = useState<CuePointState>({
    currentCuePoint: 0,
    totalCuePoints: 0,
  });

  const handleRestartClip = () => {
    setCuePointState(prev => ({
      ...prev,
      currentCuePoint: 1,
    }));
    console.log('Restart Clip - Jump to first cue point');
    // TODO: Implement restart clip logic
  };

  const handleBackOneCuePoint = () => {
    setCuePointState(prev => ({
      ...prev,
      currentCuePoint: Math.max(1, prev.currentCuePoint - 1),
    }));
    console.log('Back 1 Cue Point');
    // TODO: Implement back cue point logic
  };

  const handleForwardOneCuePoint = () => {
    setCuePointState(prev => ({
      ...prev,
      currentCuePoint: Math.min(prev.totalCuePoints, prev.currentCuePoint + 1),
    }));
    console.log('Forward 1 Cue Point');
    // TODO: Implement forward cue point logic
  };

  const handleRecordCuePoint = () => {
    setCuePointState(prev => ({
      ...prev,
      totalCuePoints: prev.totalCuePoints + 1,
      currentCuePoint: prev.totalCuePoints + 1,
    }));
    console.log('Record Cue Point at current position');
    // TODO: Implement record cue point logic
  };

  return (
    <ControlsContainer>
      <ControlGroup>
        <ControlButton onClick={handleRestartClip}>
          ⏮
        </ControlButton>
        <ControlLabel>Restart<br />Clip</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton onClick={handleBackOneCuePoint}>
          ⏪
        </ControlButton>
        <ControlLabel>Back 1<br />Cue Point</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton onClick={handleForwardOneCuePoint}>
          ⏩
        </ControlButton>
        <ControlLabel>Forward 1<br />Cue Point</ControlLabel>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          variant="primary"
          onClick={handleRecordCuePoint}
          style={{ width: '56px', height: '56px' }}
        >
          ⏺
        </ControlButton>
        <ControlLabel>Record<br />Cue Point</ControlLabel>
      </ControlGroup>

      <CuePointInfo>
        Cue Point<br />
        {cuePointState.currentCuePoint} / {cuePointState.totalCuePoints}
      </CuePointInfo>
    </ControlsContainer>
  );
};

export default CuePointControls;