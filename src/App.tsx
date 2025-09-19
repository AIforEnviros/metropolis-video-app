import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import styled from 'styled-components';
import { useVideoStore } from './store/videoStore';
import FilePanel from './components/FilePanel';
import TransportControls from './components/TransportControls';
import VideoMatrix from './components/VideoMatrix';
import TabsContainer from './components/TabsContainer';
import OutputPreview from './components/OutputPreview';
import CuePointControls from './components/CuePointControls';
import ShitItUpControl from './components/ShitItUpControl';

const AppContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "files transport output"
    "files matrix output"
    "files tabs output";
  background-color: #1a1a1a;
  color: #ffffff;
  gap: 8px;
  padding: 8px;
`;

const FilePanelArea = styled.div`
  grid-area: files;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
`;

const TransportArea = styled.div`
  grid-area: transport;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const MatrixArea = styled.div`
  grid-area: matrix;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  padding: 16px;
`;

const TabsArea = styled.div`
  grid-area: tabs;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  padding: 8px;
`;

const OutputArea = styled.div`
  grid-area: output;
  background-color: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

function App() {
  const {
    currentVideo,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    handleProgress,
    setDuration,
  } = useVideoStore();

  // Check if this is the output window
  const isOutputWindow = window.location.hash === '#output' || window.location.pathname === '/output';

  if (isOutputWindow) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#fff',
        fontSize: '24px'
      }}>
        Output Display - Video Preview Will Appear Here
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <AppContainer>
        <FilePanelArea>
          <FilePanel />
        </FilePanelArea>

        <TransportArea>
          <TransportControls />
        </TransportArea>

        <MatrixArea>
          <VideoMatrix />
        </MatrixArea>

        <TabsArea>
          <TabsContainer />
        </TabsArea>

        <OutputArea>
          <OutputPreview
            currentVideo={currentVideo}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            onProgress={handleProgress}
            onDuration={setDuration}
          />
          <CuePointControls />
          <ShitItUpControl />
        </OutputArea>
      </AppContainer>
    </DndProvider>
  );
}

export default App;