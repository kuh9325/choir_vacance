'use client';

import { useEffect, useRef, useState } from 'react';
import { CharadesApp } from '@/components/CharadesApp';
import { ScoreApp } from '@/components/ScoreApp';
import { TelestrationApp } from '@/components/TelestrationApp';
import { DEFAULT_STATE, EventState, normalizeState } from '@/lib/game';
import styles from './EventNavigation.module.css';

const STORAGE_KEY = 'game-score-state-v1';
const CHANNEL_KEY = 'game-score-live';

export function EventDisplayRouter() {
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeState(JSON.parse(raw));
        stateRef.current = parsed;
        setState(parsed);
      }
    } catch { /* ignore cache */ }

    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt >= stateRef.current.updatedAt) {
        stateRef.current = incoming;
        setState(incoming);
      }
    };

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const incoming = normalizeState(await response.json() as EventState);
        if (incoming.updatedAt >= stateRef.current.updatedAt || initial) {
          stateRef.current = incoming;
          setState(incoming);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
        }
      } catch { /* keep last known display state */ }
      finally { if (initial) setReady(true); }
    };

    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 700);
    return () => { clearInterval(timer); channel.close(); };
  }, []);

  if (!ready) return <main className={styles.displayLoading}>전광판 준비 중…</main>;

  if (state.programIndex === 0 && !state.charadesComplete) return <CharadesApp mode="display" />;
  if (state.programIndex === 1) return <TelestrationApp mode="display" />;
  return <ScoreApp mode="display" />;
}
