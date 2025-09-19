import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VideoClip {
  id: string;
  name: string;
  path: string;
  cuePoints: number[];
  duration: number;
  currentTime: number;
  playbackRate: number;
}

interface Tab {
  id: string;
  name: string;
  clips: { [slotIndex: number]: VideoClip };
}

interface TransportState {
  isPlaying: boolean;
  isReverse: boolean;
  selectedClipSlot: number | null;
  selectedTab: string;
}

interface ChaosState {
  level: number;
  effectsEnabled: boolean;
}

interface MidiMapping {
  [midiNote: number]: {
    action: string;
    target?: string | number;
  };
}

interface AppState {
  // Tabs and clips
  tabs: Tab[];
  activeTabId: string;

  // Transport controls
  transport: TransportState;

  // Chaos control
  chaos: ChaosState;

  // MIDI mappings
  midiMappings: MidiMapping;

  // Session management
  lastSavedAt: number;
  isDirty: boolean;

  // Actions for tabs
  addTab: (name?: string) => void;
  removeTab: (tabId: string) => void;
  renameTab: (tabId: string, newName: string) => void;
  setActiveTab: (tabId: string) => void;

  // Actions for clips
  loadClipToSlot: (tabId: string, slotIndex: number, clip: Omit<VideoClip, 'cuePoints' | 'duration' | 'currentTime' | 'playbackRate'>) => void;
  removeClipFromSlot: (tabId: string, slotIndex: number) => void;
  addCuePoint: (tabId: string, slotIndex: number, time: number) => void;
  removeCuePoint: (tabId: string, slotIndex: number, cuePointIndex: number) => void;
  updateClipTime: (tabId: string, slotIndex: number, currentTime: number) => void;
  setClipPlaybackRate: (tabId: string, slotIndex: number, rate: number) => void;

  // Actions for transport
  setPlaying: (isPlaying: boolean) => void;
  setReverse: (isReverse: boolean) => void;
  selectClipSlot: (slotIndex: number | null) => void;

  // Actions for chaos control
  setChaosLevel: (level: number) => void;
  toggleChaosEffects: () => void;

  // Actions for MIDI
  setMidiMapping: (note: number, action: string, target?: string | number) => void;
  removeMidiMapping: (note: number) => void;

  // Session actions
  markDirty: () => void;
  markClean: () => void;
  resetSession: () => void;
}

const initialState = {
  tabs: [
    {
      id: '1',
      name: 'Tab 1',
      clips: {},
    },
  ],
  activeTabId: '1',
  transport: {
    isPlaying: false,
    isReverse: false,
    selectedClipSlot: null,
    selectedTab: '1',
  },
  chaos: {
    level: 0,
    effectsEnabled: true,
  },
  midiMappings: {},
  lastSavedAt: Date.now(),
  isDirty: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Tab actions
      addTab: (name) => {
        const newTabNumber = get().tabs.length + 1;
        const newTab: Tab = {
          id: Date.now().toString(),
          name: name || `Tab ${newTabNumber}`,
          clips: {},
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
          isDirty: true,
        }));
      },

      removeTab: (tabId) => {
        const tabs = get().tabs;
        if (tabs.length <= 1) return; // Don't remove the last tab

        const filteredTabs = tabs.filter(tab => tab.id !== tabId);
        const newActiveId = get().activeTabId === tabId
          ? filteredTabs[0]?.id || ''
          : get().activeTabId;

        set({
          tabs: filteredTabs,
          activeTabId: newActiveId,
          isDirty: true,
        });
      },

      renameTab: (tabId, newName) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, name: newName } : tab
          ),
          isDirty: true,
        }));
      },

      setActiveTab: (tabId) => {
        set({
          activeTabId: tabId,
          transport: { ...get().transport, selectedTab: tabId },
        });
      },

      // Clip actions
      loadClipToSlot: (tabId, slotIndex, clipData) => {
        const newClip: VideoClip = {
          ...clipData,
          cuePoints: [],
          duration: 0,
          currentTime: 0,
          playbackRate: 1.0,
        };

        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  clips: { ...tab.clips, [slotIndex]: newClip }
                }
              : tab
          ),
          isDirty: true,
        }));
      },

      removeClipFromSlot: (tabId, slotIndex) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  clips: Object.fromEntries(
                    Object.entries(tab.clips).filter(([index]) => parseInt(index) !== slotIndex)
                  )
                }
              : tab
          ),
          isDirty: true,
        }));
      },

      addCuePoint: (tabId, slotIndex, time) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId && tab.clips[slotIndex]
              ? {
                  ...tab,
                  clips: {
                    ...tab.clips,
                    [slotIndex]: {
                      ...tab.clips[slotIndex],
                      cuePoints: [...tab.clips[slotIndex].cuePoints, time].sort((a, b) => a - b)
                    }
                  }
                }
              : tab
          ),
          isDirty: true,
        }));
      },

      removeCuePoint: (tabId, slotIndex, cuePointIndex) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId && tab.clips[slotIndex]
              ? {
                  ...tab,
                  clips: {
                    ...tab.clips,
                    [slotIndex]: {
                      ...tab.clips[slotIndex],
                      cuePoints: tab.clips[slotIndex].cuePoints.filter((_, index) => index !== cuePointIndex)
                    }
                  }
                }
              : tab
          ),
          isDirty: true,
        }));
      },

      updateClipTime: (tabId, slotIndex, currentTime) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId && tab.clips[slotIndex]
              ? {
                  ...tab,
                  clips: {
                    ...tab.clips,
                    [slotIndex]: {
                      ...tab.clips[slotIndex],
                      currentTime
                    }
                  }
                }
              : tab
          ),
        }));
      },

      setClipPlaybackRate: (tabId, slotIndex, rate) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId && tab.clips[slotIndex]
              ? {
                  ...tab,
                  clips: {
                    ...tab.clips,
                    [slotIndex]: {
                      ...tab.clips[slotIndex],
                      playbackRate: Math.max(0.1, Math.min(10, rate))
                    }
                  }
                }
              : tab
          ),
          isDirty: true,
        }));
      },

      // Transport actions
      setPlaying: (isPlaying) => {
        set((state) => ({
          transport: { ...state.transport, isPlaying }
        }));
      },

      setReverse: (isReverse) => {
        set((state) => ({
          transport: { ...state.transport, isReverse }
        }));
      },

      selectClipSlot: (slotIndex) => {
        set((state) => ({
          transport: { ...state.transport, selectedClipSlot: slotIndex }
        }));
      },

      // Chaos actions
      setChaosLevel: (level) => {
        set((state) => ({
          chaos: { ...state.chaos, level: Math.max(0, Math.min(10, level)) }
        }));
      },

      toggleChaosEffects: () => {
        set((state) => ({
          chaos: { ...state.chaos, effectsEnabled: !state.chaos.effectsEnabled }
        }));
      },

      // MIDI actions
      setMidiMapping: (note, action, target) => {
        set((state) => ({
          midiMappings: {
            ...state.midiMappings,
            [note]: { action, target }
          },
          isDirty: true,
        }));
      },

      removeMidiMapping: (note) => {
        const { [note]: removed, ...rest } = get().midiMappings;
        set({
          midiMappings: rest,
          isDirty: true,
        });
      },

      // Session actions
      markDirty: () => {
        set({ isDirty: true });
      },

      markClean: () => {
        set({
          isDirty: false,
          lastSavedAt: Date.now(),
        });
      },

      resetSession: () => {
        set({
          ...initialState,
          lastSavedAt: Date.now(),
        });
      },
    }),
    {
      name: 'metropolis-session',
      version: 1,
    }
  )
);