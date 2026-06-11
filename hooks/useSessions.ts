import { useState, useEffect, useCallback } from 'react';
import { Session, Artifact } from '../types';
import { generateId } from '../utils';

const STORAGE_KEY = 'flash-ui-sessions';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionIndex(parsed.length - 1);
        }
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
        setIsLoaded(true);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isLoaded]);

  const addSession = useCallback((prompt: string, initialArtifacts: Artifact[]) => {
    const newSession: Session = {
      id: generateId(),
      prompt,
      timestamp: Date.now(),
      artifacts: initialArtifacts
    };
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(prev => prev + 1);
    setFocusedArtifactIndex(null);
    return newSession.id;
  }, []);

  const updateSessionArtifacts = useCallback((sessionId: string, updater: (artifacts: Artifact[]) => Artifact[]) => {
    setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, artifacts: updater(s.artifacts) };
    }));
  }, []);

  const updateArtifact = useCallback((sessionId: string, artifactId: string, updates: Partial<Artifact>) => {
    setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return {
            ...s,
            artifacts: s.artifacts.map(a => a.id === artifactId ? { ...a, ...updates } : a)
        };
    }));
  }, []);

  // Navigation
  const nextItem = useCallback(() => {
    if (focusedArtifactIndex !== null) {
      if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
    } else {
      if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
    }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
    if (focusedArtifactIndex !== null) {
      if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
    } else {
      if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
    }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const currentSession = sessions[currentSessionIndex];

  return {
    sessions,
    currentSessionIndex,
    setCurrentSessionIndex,
    focusedArtifactIndex,
    setFocusedArtifactIndex,
    currentSession,
    addSession,
    updateSessionArtifacts,
    updateArtifact,
    nextItem,
    prevItem,
    isLoaded
  };
}
