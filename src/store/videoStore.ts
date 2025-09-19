import { create } from 'zustand';

interface VideoState {
  currentVideo: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  selectedClipSlot: number | null;
  volume: number;
}

interface VideoActions {
  setCurrentVideo: (videoPath: string | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setSelectedClipSlot: (slotIndex: number | null) => void;
  setVolume: (volume: number) => void;
  resetVideoState: () => void;
  handleProgress: (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => void;
}

type VideoStore = VideoState & VideoActions;

const initialState: VideoState = {
  currentVideo: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  selectedClipSlot: null,
  volume: 1,
};

export const useVideoStore = create<VideoStore>()((set, get) => ({
  ...initialState,

  setCurrentVideo: (videoPath) => {
    set({
      currentVideo: videoPath,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    });
  },

  setPlaying: (isPlaying) => {
    set({ isPlaying });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setDuration: (duration) => {
    set({ duration });
  },

  setPlaybackRate: (rate) => {
    set({ playbackRate: Math.max(0.1, Math.min(10, rate)) });
  },

  setSelectedClipSlot: (slotIndex) => {
    set({ selectedClipSlot: slotIndex });
  },

  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  resetVideoState: () => {
    set(initialState);
  },

  handleProgress: (state) => {
    set({
      currentTime: state.playedSeconds,
    });
  },
}));