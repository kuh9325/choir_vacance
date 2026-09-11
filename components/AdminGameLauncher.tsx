'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STATE, EventState, PROGRAMS, normalizeState } from '@/lib/game';
import styles from './EventNavigation.module.css';

const STORAGE_KEY = 'game-score-state-v1';
const CHANNEL_KEY = 'game-score-live';

export function AdminGameLauncher() {
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [switching, setSwitching] = useState<string | null>(null);
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

    const pull = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) return;
        const incoming = normalizeState(await response.json() as EventState);
        if (incoming.updatedAt >= stateRef.current.updatedAt) {
          stateRef.current = incoming;
          setState(incoming);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
        }
      } catch { /* keep local state */ }
    };

    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 1200);
    return () => { clearInterval(timer); channel.close(); };
  }, []);

  const launch = async (programIndex: 0 | 1, href: string, label: string) => {
    setSwitching(label);
    const next = structuredClone(stateRef.current);
    next.programIndex = programIndex;
    next.programStartedAt = Date.now();
    next.displayView = 'current';
    if (programIndex === 0) next.charadesComplete = false;
    next.updatedAt = Date.now();
    next.logs = [{ id: crypto.randomUUID(), at: next.updatedAt, text: `${label} 진행 화면으로 이동` }, ...next.logs].slice(0, 100);

    stateRef.current = next;
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.postMessage(next);
    channel.close();

    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        keepalive: true,
      });
    } catch { /* local transition still works */ }
    window.location.assign(href);
  };

  const currentName = PROGRAMS[state.programIndex]?.name ?? '행사 진행';

  return <aside className={styles.launcher} aria-label="게임 진행 바로가기">
    <div className={styles.launchInfo}><span>현재 프로그램</span><strong>{currentName}</strong></div>
    <button className={state.programIndex === 0 ? styles.active : ''} disabled={Boolean(switching)} onClick={() => void launch(0, '/admin/charades', '몸으로 말해요')}>
      <b>몸으로 말해요</b><small>{state.programIndex === 0 ? '현재 프로그램' : '진행 화면 열기'}</small>
    </button>
    <button className={state.programIndex === 1 ? styles.active : ''} disabled={Boolean(switching)} onClick={() => void launch(1, '/admin/telestration', '텔레스트레이션')}>
      <b>텔레스트레이션</b><small>{state.programIndex === 1 ? '현재 프로그램' : '진행 화면 열기'}</small>
    </button>
    {switching && <em>{switching} 전환 중…</em>}
  </aside>;
}
