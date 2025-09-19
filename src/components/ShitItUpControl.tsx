import React, { useState } from 'react';
import styled from 'styled-components';

const ControlContainer = styled.div<{ chaosLevel: number }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background-color: #333;
  border-radius: 8px;
  border: 1px solid #555;
  transition: all 0.3s ease;

  ${props => props.chaosLevel > 5 && `
    animation: shake 0.5s infinite;
  `}

  ${props => props.chaosLevel > 8 && `
    filter: hue-rotate(${props.chaosLevel * 20}deg) saturate(${1 + props.chaosLevel * 0.2});
  `}

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px) rotate(-1deg); }
    75% { transform: translateX(2px) rotate(1deg); }
  }
`;

const DialContainer = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
`;

const DialBackground = styled.div<{ chaosLevel: number }>`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #333 0deg,
    #666 ${props => (props.chaosLevel / 10) * 360}deg,
    #333 ${props => (props.chaosLevel / 10) * 360}deg
  );
  border: 3px solid #555;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;

  ${props => props.chaosLevel > 7 && `
    border-color: #ff6b6b;
    box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
  `}
`;

const DialKnob = styled.div<{ rotation: number; chaosLevel: number }>`
  position: absolute;
  top: 10px;
  left: 50%;
  width: 6px;
  height: 40px;
  background-color: ${props => props.chaosLevel > 7 ? '#ff6b6b' : '#fff'};
  border-radius: 3px;
  transform-origin: 3px 50px;
  transform: translateX(-50%) rotate(${props => props.rotation}deg);
  transition: background-color 0.3s ease;
`;

const DialLabel = styled.div<{ chaosLevel: number }>`
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  color: ${props => props.chaosLevel > 7 ? '#ff6b6b' : '#fff'};
  transition: color 0.3s ease;

  ${props => props.chaosLevel > 6 && `
    animation: pulse 1s infinite;
  `}

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;

const DialSubLabel = styled.div<{ chaosLevel: number }>`
  font-size: 12px;
  color: ${props => props.chaosLevel > 7 ? '#ff9999' : '#ccc'};
  text-align: center;
  margin-top: 4px;
  transition: color 0.3s ease;
`;

const ScaleMarks = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const ScaleMark = styled.div<{ angle: number; isMax?: boolean }>`
  position: absolute;
  top: 15px;
  left: 50%;
  width: 2px;
  height: 15px;
  background-color: ${props => props.isMax ? '#ff6b6b' : '#666'};
  transform-origin: 1px 45px;
  transform: translateX(-50%) rotate(${props => props.angle}deg);
`;

const ScaleLabel = styled.div<{ angle: number; isMax?: boolean }>`
  position: absolute;
  top: 5px;
  left: 50%;
  font-size: 10px;
  font-weight: bold;
  color: ${props => props.isMax ? '#ff6b6b' : '#999'};
  transform-origin: 0 55px;
  transform: translateX(-50%) rotate(${props => props.angle}deg);
`;

const ValueDisplay = styled.div<{ chaosLevel: number }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: bold;
  color: ${props => props.chaosLevel > 7 ? '#ff6b6b' : '#fff'};
  text-shadow: ${props => props.chaosLevel > 7 ? '0 0 10px #ff6b6b' : 'none'};
`;

const ShitItUpControl: React.FC = () => {
  const [chaosLevel, setChaosLevel] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateChaosLevel(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateChaosLevel(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateChaosLevel = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;

    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // Map angle to chaos level (0-10)
    const newChaosLevel = Math.round((angle / 360) * 10);
    setChaosLevel(Math.max(0, Math.min(10, newChaosLevel)));

    console.log(`Chaos level set to: ${newChaosLevel}`);
    // TODO: Implement chaos effects based on level
  };

  const rotation = (chaosLevel / 10) * 360;

  const getDialLabel = () => {
    if (chaosLevel === 0) return "Clean";
    if (chaosLevel <= 3) return "Mild Chaos";
    if (chaosLevel <= 6) return "Getting Weird";
    if (chaosLevel <= 8) return "Shit It Up!";
    if (chaosLevel === 9) return "Motherf*cker";
    return "MAXIMUM CHAOS";
  };

  // Generate scale marks
  const scaleMarks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = (i / 10) * 360;
    const isMax = i === 10;
    scaleMarks.push(
      <ScaleMark key={i} angle={angle} isMax={isMax} />
    );
    if (i === 0 || i === 5 || i === 10) {
      scaleMarks.push(
        <ScaleLabel key={`label-${i}`} angle={angle} isMax={isMax}>
          {i === 10 ? "MAX" : i}
        </ScaleLabel>
      );
    }
  }

  return (
    <ControlContainer chaosLevel={chaosLevel}>
      <DialContainer>
        <DialBackground
          chaosLevel={chaosLevel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <ScaleMarks>
            {scaleMarks}
          </ScaleMarks>
          <DialKnob
            rotation={rotation}
            chaosLevel={chaosLevel}
          />
          <ValueDisplay chaosLevel={chaosLevel}>
            {chaosLevel}
          </ValueDisplay>
        </DialBackground>
      </DialContainer>

      <DialLabel chaosLevel={chaosLevel}>
        {getDialLabel()}
      </DialLabel>

      <DialSubLabel chaosLevel={chaosLevel}>
        Shit it up, baby!
      </DialSubLabel>
    </ControlContainer>
  );
};

export default ShitItUpControl;