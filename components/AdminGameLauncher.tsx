'use client';

import { useEffect, useRef, useState } from 'react';
import { ActiveMode, DEFAULT_STATE, EventState, PROGRAMS, normalizeState } from '@/lib/game';
import { CharadesState, normalizeCharadesState } from '@/lib/charades';
import { TelestrationState, normalizeTelestrationState } from '@/lib/telestration';
import styles from './EventNavigation.module.css';

const STORAGE_KEY = 'game-score-state-v1';
const CHANNEL_KEY = 'game-score-live';
const CHARADES_STORAGE_KEY = 'charades-live-state-v1';
const CHARADES_CHANNEL_KEY = 'charades-live';
const TELESTRATION_STORAGE_KEY = 'telestration-live-state-v1';
const TELESTRATION_CHANNEL_KEY = 'telestration-live';

function broadcast(channelName: string, value: unknown) {
  const channel = new BroadcastChannel(channelName);
  channel.postMessage(value);
  channel.close();
}

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

  const saveScoreState = async (next: EventState) => {
    stateRef.current = next;
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    broadcast(CHANNEL_KEY, next);
    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        keepalive: true,
      });
    } catch { /* local transition still works */ }
  };

  const launch = async (programIndex: 0 | 1, mode: Exclude<ActiveMode, 'score'>, href: string, label: string) => {
    setSwitching(label);
    const next = structuredClone(stateRef.current);
    next.programIndex = programIndex;
    next.programStartedAt = Date.now();
    next.activeMode = mode;
    next.displayView = 'current';
    if (programIndex === 0) next.charadesComplete = false;
    next.updatedAt = Date.now();
    next.logs = [{ id: crypto.randomUUID(), at: next.updatedAt, text: `${label} 진행 화면으로 이동` }, ...next.logs].slice(0, 100);
    await saveScoreState(next);
    window.location.assign(href);
  };

  const showProjectorMain = async () => {
    setSwitching('전광판 메인');
    const next = structuredClone(stateRef.current);
    next.activeMode = 'score';
    next.displayView = 'overall';
    next.scoresVisible = true;
    next.updatedAt = Date.now();
    next.logs = [{ id: crypto.randomUUID(), at: next.updatedAt, text: '전광판을 메인 종합화면으로 전환' }, ...next.logs].slice(0, 100);
    await saveScoreState(next);
    setSwitching(null);
  };

  const resetProgress = async () => {
    const confirmed = window.confirm('진행 상태를 처음으로 되돌릴까요?\n\n팀 구성과 지금까지 입력한 점수는 유지됩니다. 몸으로 말해요·텔레스트레이션의 진행/타이머와 전광판만 초기화됩니다.');
    if (!confirmed) return;
    setSwitching('진행 리셋');
    const now = Date.now();

    const next = structuredClone(stateRef.current);
    next.programIndex = 0;
    next.programStartedAt = null;
    next.activeMode = 'score';
    next.displayView = 'overall';
    next.scoresVisible = true;
    next.resultReveal = 0;
    next.lionRevealed = false;
    next.charadesComplete = false;
    next.updatedAt = now;
    next.logs = [{ id: crypto.randomUUID(), at: now, text: '전광판/게임 진행 상태 리셋 (점수 유지)' }, ...next.logs].slice(0, 100);
    await saveScoreState(next);

    try {
      const response = await fetch('/api/charades', { cache: 'no-store' });
      if (response.ok) {
        const charades = normalizeCharadesState(await response.json() as CharadesState);
        charades.currentTurnIndex = 0;
        charades.phase = 'setup';
        charades.revealed = false;
        charades.currentWord = null;
        charades.usedWords = [];
        charades.turnEndsAt = null;
        charades.pausedRemainingSeconds = null;
        charades.sessionStartedAt = null;
        charades.updatedAt = now;
        localStorage.setItem(CHARADES_STORAGE_KEY, JSON.stringify(charades));
        broadcast(CHARADES_CHANNEL_KEY, charades);
        await fetch('/api/charades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(charades) });
      }
    } catch { /* score/display reset is still valid */ }

    try {
      const response = await fetch('/api/telestration', { cache: 'no-store' });
      if (response.ok) {
        const telestration = normalizeTelestrationState(await response.json() as TelestrationState);
        telestration.currentRound = 0;
        telestration.stage = 'setup';
        telestration.chainStep = 0;
        telestration.timerStatus = 'idle';
        telestration.stageEndsAt = null;
        telestration.pausedRemainingSeconds = null;
        telestration.sessionStartedAt = null;
        telestration.updatedAt = now;
        localStorage.setItem(TELESTRATION_STORAGE_KEY, JSON.stringify(telestration));
        broadcast(TELESTRATION_CHANNEL_KEY, telestration);
        await fetch('/api/telestration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telestration) });
      }
    } catch { /* score/display reset is still valid */ }

    setSwitching(null);
  };

  const currentName = PROGRAMS[state.programIndex]?.name ?? '행사 진행';

  return <aside className={styles.launcher} aria-label="게임 진행 바로가기">
    <div className={styles.launchInfo}><span>현재 프로그램</span><strong>{currentName}</strong></div>
    <button className={state.activeMode === 'charades' ? styles.active : ''} disabled={Boolean(switching)} onClick={() => void launch(0, 'charades', '/admin/charades', '몸으로 말해요')}>
      <b>몸으로 말해요</b><small>{state.activeMode === 'charades' ? '진행 중' : '진행 화면 열기'}</small>
    </button>
    <button className={state.activeMode === 'telestration' ? styles.active : ''} disabled={Boolean(switching)} onClick={() => void launch(1, 'telestration', '/admin/telestration', '텔레스트레이션')}>
      <b>텔레스트레이션</b><small>{state.activeMode === 'telestration' ? '진행 중' : '진행 화면 열기'}</small>
    </button>
    <button className={styles.mainButton} disabled={Boolean(switching)} onClick={() => void showProjectorMain()}>
      <b>▣ 전광판 메인</b><small>종합화면 즉시 표시</small>
    </button>
    <button className={styles.resetButton} disabled={Boolean(switching)} onClick={() => void resetProgress()}>
      <b>↺ 진행 리셋</b><small>점수는 유지</small>
    </button>
    {switching && <em>{switching} 전환 중…</em>}
  </aside>;
}
