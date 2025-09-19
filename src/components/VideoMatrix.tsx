import React, { useState } from 'react';
import styled from 'styled-components';
import { useDrop } from 'react-dnd';
import { useVideoStore } from '../store/videoStore';

const MatrixContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const MatrixHeader = styled.div`
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: bold;
  color: #fff;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
  flex: 1;
  height: 100%;
`;

const ClipSlot = styled.div<{ hasVideo?: boolean; isSelected?: boolean; isDropping?: boolean }>`
  background-color: ${props =>
    props.isDropping ? '#444' :
    props.isSelected ? '#555' :
    props.hasVideo ? '#333' : '#2a2a2a'
  };
  border: 2px solid ${props =>
    props.isDropping ? '#888' :
    props.isSelected ? '#777' :
    props.hasVideo ? '#555' : '#444'
  };
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  min-height: 60px;

  &:hover {
    border-color: #666;
    background-color: ${props => props.hasVideo ? '#444' : '#333'};
  }
`;

const ClipNumber = styled.div`
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 4px;
  color: #aaa;
`;

const ClipName = styled.div`
  font-size: 10px;
  text-align: center;
  color: #ccc;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const CuePointIndicator = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: #ff6b6b;
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: bold;
`;

interface VideoClip {
  id: string;
  name: string;
  path: string;
  cuePoints: number[];
}

interface MatrixState {
  clips: { [slotIndex: number]: VideoClip };
  selectedSlot: number | null;
}

const VideoMatrix: React.FC = () => {
  const [matrixState, setMatrixState] = useState<MatrixState>({
    clips: {},
    selectedSlot: null,
  });

  const { setCurrentVideo, setSelectedClipSlot, selectedClipSlot } = useVideoStore();

  const handleSlotClick = (slotIndex: number) => {
    const clip = matrixState.clips[slotIndex];

    if (clip) {
      // If there's a video in this slot, load it
      setCurrentVideo(clip.path);
      setSelectedClipSlot(slotIndex);
      setMatrixState(prev => ({
        ...prev,
        selectedSlot: slotIndex,
      }));
      console.log('Loading video:', clip.name, 'from path:', clip.path);
    } else {
      // If no video, deselect
      if (matrixState.selectedSlot === slotIndex) {
        setCurrentVideo(null);
        setSelectedClipSlot(null);
        setMatrixState(prev => ({
          ...prev,
          selectedSlot: null,
        }));
      }
    }
  };

  const handleDrop = (slotIndex: number, file: any) => {
    console.log('Dropping file:', file);
    const newClip: VideoClip = {
      id: file.id,
      name: file.name,
      path: file.path,
      cuePoints: [],
    };

    setMatrixState(prev => ({
      ...prev,
      clips: {
        ...prev.clips,
        [slotIndex]: newClip,
      },
      selectedSlot: slotIndex,
    }));
  };

  const ClipSlotComponent: React.FC<{ slotIndex: number }> = ({ slotIndex }) => {
    const [{ isOver }, drop] = useDrop({
      accept: 'file',
      drop: (item: any) => {
        handleDrop(slotIndex, item);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    const clip = matrixState.clips[slotIndex];
    const isSelected = matrixState.selectedSlot === slotIndex;

    return (
      <ClipSlot
        ref={drop}
        hasVideo={!!clip}
        isSelected={isSelected}
        isDropping={isOver}
        onClick={() => handleSlotClick(slotIndex)}
      >
        <ClipNumber>Clip {slotIndex + 1}</ClipNumber>
        {clip ? (
          <>
            <ClipName>{clip.name}</ClipName>
            {clip.cuePoints.length > 0 && (
              <CuePointIndicator>{clip.cuePoints.length}</CuePointIndicator>
            )}
          </>
        ) : (
          <ClipName>Drop video here</ClipName>
        )}
      </ClipSlot>
    );
  };

  // Generate 36 slots (6x6 grid)
  const slots = Array.from({ length: 36 }, (_, index) => (
    <ClipSlotComponent key={index} slotIndex={index} />
  ));

  return (
    <MatrixContainer>
      <MatrixHeader>Clips</MatrixHeader>
      <GridContainer>
        {slots}
      </GridContainer>
    </MatrixContainer>
  );
};

export default VideoMatrix;