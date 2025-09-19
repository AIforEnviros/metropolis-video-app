import React, { useState } from 'react';
import styled from 'styled-components';

const TabsWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const TabsGrid = styled.div`
  display: flex;
  gap: 4px;
`;

const Tab = styled.button<{ active?: boolean }>`
  padding: 12px 24px;
  background-color: ${props => props.active ? '#444' : '#333'};
  border: 1px solid ${props => props.active ? '#666' : '#555'};
  border-radius: 8px 8px 0 0;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 80px;

  &:hover {
    background-color: #444;
    border-color: #666;
  }

  &:active {
    transform: translateY(1px);
  }
`;

const AddTabButton = styled.button`
  padding: 12px 16px;
  background-color: #2a2a2a;
  border: 1px dashed #555;
  border-radius: 8px 8px 0 0;
  color: #aaa;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;

  &:hover {
    background-color: #333;
    border-color: #666;
    color: #ccc;
  }
`;

interface Tab {
  id: string;
  name: string;
}

const TabsContainer: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', name: 'Tab 1' },
    { id: '2', name: 'Tab 2' },
    { id: '3', name: 'Tab 3' },
    { id: '4', name: 'Tab 4' },
    { id: '5', name: 'Tab 5' },
  ]);

  const [activeTabId, setActiveTabId] = useState('1');

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    console.log(`Switched to tab: ${tabId}`);
    // TODO: Implement tab switching logic to load different matrix configurations
  };

  const handleAddTab = () => {
    const newTabNumber = tabs.length + 1;
    const newTab: Tab = {
      id: Date.now().toString(),
      name: `Tab ${newTabNumber}`,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    console.log(`Added new tab: ${newTab.name}`);
  };

  return (
    <TabsWrapper>
      <TabsGrid>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            active={activeTabId === tab.id}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.name}
          </Tab>
        ))}
        <AddTabButton onClick={handleAddTab}>
          +
        </AddTabButton>
      </TabsGrid>
    </TabsWrapper>
  );
};

export default TabsContainer;