import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { useDrag } from 'react-dnd';

const PanelContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #444;
  font-weight: bold;
  font-size: 18px;
`;

const FileList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const FileItem = styled.div<{ isDragging?: boolean }>`
  padding: 8px 12px;
  margin: 2px 0;
  background-color: ${props => props.isDragging ? '#444' : '#333'};
  border-radius: 4px;
  cursor: grab;
  border: 1px solid #555;
  transition: all 0.2s ease;
  opacity: ${props => props.isDragging ? 0.5 : 1};

  &:hover {
    background-color: #444;
    border-color: #666;
  }

  &:active {
    cursor: grabbing;
  }
`;

const FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
`;

const FileSize = styled.div`
  font-size: 12px;
  color: #aaa;
`;

const AddFilesButton = styled.button`
  margin: 8px;
  padding: 12px;
  background-color: #4a4a4a;
  border: 1px solid #666;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #555;
  }
`;

interface FileInfo {
  id: string;
  name: string;
  size: string;
  path: string;
  type: string;
}

const FilePanel: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([
    { id: '1', name: 'Metropolis_Act1.mp4', size: '183.3 MB', path: '', type: 'video' },
    { id: '2', name: 'Factory_Scene.mp4', size: '89.1 MB', path: '', type: 'video' },
    { id: '3', name: 'Maria_Introduction.mov', size: '156.8 MB', path: '', type: 'video' },
    { id: '4', name: 'Underground_Workers.mp4', size: '234.5 MB', path: '', type: 'video' },
    { id: '5', name: 'Robot_Creation.mp4', size: '167.2 MB', path: '', type: 'video' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      const newFiles: FileInfo[] = Array.from(selectedFiles).map((file, index) => ({
        id: Date.now().toString() + index,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        path: (file as any).path || '',
        type: 'video'
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const DraggableFileItem: React.FC<{ file: FileInfo }> = ({ file }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'file',
      item: file,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    return (
      <FileItem
        ref={drag}
        isDragging={isDragging}
      >
        <FileName>{file.name}</FileName>
        <FileSize>{file.size}</FileSize>
      </FileItem>
    );
  };

  return (
    <PanelContainer>
      <PanelHeader>Files</PanelHeader>
      <FileList>
        {files.map((file) => (
          <DraggableFileItem key={file.id} file={file} />
        ))}
      </FileList>
      <AddFilesButton onClick={handleAddFiles}>
        Add Video Files
      </AddFilesButton>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </PanelContainer>
  );
};

export default FilePanel;