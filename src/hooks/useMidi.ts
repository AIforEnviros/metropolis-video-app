import { useState, useEffect, useCallback } from 'react';

interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  type: 'input' | 'output';
}

interface MidiMessage {
  command: number;
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

interface MidiHookReturn {
  devices: MidiDevice[];
  isSupported: boolean;
  isConnected: boolean;
  lastMessage: MidiMessage | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (command: number, note: number, velocity: number) => void;
}

export const useMidi = (): MidiHookReturn => {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MidiMessage | null>(null);

  useEffect(() => {
    // Check if Web MIDI API is supported
    setIsSupported('requestMIDIAccess' in navigator);
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      console.warn('Web MIDI API is not supported in this browser');
      return;
    }

    try {
      // For now, just simulate connection
      setIsConnected(true);
      console.log('MIDI connection simulated - Web MIDI API integration pending');
    } catch (error) {
      console.error('Failed to get MIDI access:', error);
      setIsConnected(false);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setDevices([]);
    setLastMessage(null);
    console.log('MIDI disconnected');
  }, []);

  const sendMessage = useCallback((command: number, note: number, velocity: number) => {
    if (!isConnected) {
      console.warn('MIDI not connected');
      return;
    }
    console.log('MIDI message would be sent:', { command, note, velocity });
  }, [isConnected]);

  return {
    devices,
    isSupported,
    isConnected,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
  };
};