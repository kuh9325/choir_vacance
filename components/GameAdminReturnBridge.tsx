'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_STATE, EventState, normalizeState } from '@/lib/game';
import styles from './EventNavigation.module.css';

type Mode = 'charades' | 'telestration';

const SCORE_STORAGE_KEY = 'game-score-state-v1';
const SCORE_CHANNEL_KEY = 'game-score-live';

export function GameAdminReturnBridge({ mode }: { mode: Mode }) {
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const endpoint = mode === 'charades' ? '/api/charades' : '/api/telestration';
    const pull = async () => {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) return;
        const raw = await response.json() as { phase?: string; stage?: string };
        setComplete(mode === 'charades' ? raw.phase === 'finished' : raw.stage === 'finished');
      } catch { /* wait for next poll */ }
    };
    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 600);
    return () => clearInterval(timer);
  }, [mode]);

  if (!complete) return null;

  const finishAndReturn = async () => {
    setSaving(true);
    let current = structuredClone(DEFAULT_STATE);
    try {
      const local = localStorage.getItem(SCORE_STORAGE_KEY);
      if (local) current = normalizeState(JSON.parse(local));
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (response.ok) current = normalizeState(await response.json() as EventState);
    } catch { /* use best available state */ }

    const next = structuredClone(current);
    const now = Date.now();
    if (mode === 'charades') {
      next.charadesComplete = true;
      next.programIndex = 1;
      next.logs = [{ id: crypto.randomUUID(), at: now, text: '몸으로 말해요 종료 · 텔레스트레이션으로 이동' }, ...next.logs].slice(0, 100);
    } else {
      next.programIndex = 2;
      next.logs = [{ id: crypto.randomUUID(), at: now, text: '텔레스트레이션 종료 · 바닥팩맨으로 이동' }, ...next.logs].slice(0, 100);
    }
    next.programStartedAt = now;
    next.displayView = 'current';
    next.updatedAt = now;

    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    const channel = new BroadcastChannel(SCORE_CHANNEL_KEY);
    channel.postMessage(next);
    channel.close();

    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        keepalive: true,
      });
    } catch { /* local state still returns the admin */ }
    window.location.assign('/admin');
  };

  const title = mode === 'charades' ? '몸으로 말해요가 끝났습니다.' : '텔레스트레이션이 끝났습니다.';
  const nextName = mode === 'charades' ? '텔레스트레이션' : '바닥팩맨';

  return <aside className={styles.returnBridge}>
    <div><span>GAME COMPLETE</span><strong>{title} 다음은 {nextName}입니다.</strong></div>
    <button disabled={saving} onClick={() => void finishAndReturn()}>{saving ? '전환 중…' : '완료 · 기본화면으로 →'}</button>
  </aside>;
}
