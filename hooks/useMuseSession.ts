import { useState, useEffect } from 'react';
import { TrackParameters } from '../types/music';

const STORAGE_KEY = 'muse-tiles-session';

export function useMuseSession() {
  const [parameters, setParameters] = useState<TrackParameters>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setParameters(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse Muse-Tiles session from local storage', err);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parameters));
    }
  }, [parameters, isLoaded]);

  const updateParameter = (key: keyof TrackParameters, value: any) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  };

  const resetSession = () => {
    setParameters({});
    localStorage.removeItem(STORAGE_KEY);
  };

  return { parameters, updateParameter, resetSession, isLoaded };
}
