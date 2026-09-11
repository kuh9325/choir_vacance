'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_STATE, EventState, normalizeState, teleScore } from '@/lib/game';
import { normalizeTelestrationState } from '@/lib/telestration';
import styles from './TelestrationScoreDock.module.css';

const STORAGE_KEY = 'game-score-state-v1';
const CHANNEL_KEY = 'game-score-live';

export function TelestrationScoreDock() {
  const [unlocked, setUnlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [currentRound, setCurrentRound] = useState(0);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const check = () => setUnlocked(sessionStorage.getItem('game-score-admin') === 'yes');
    check();
    const timer = window.setInterval(check, 400);
    return () => clearInterval(timer);
  }, []);

  const saveLocal = useCallback((next: EventState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);

  const pushRemote = useCallback(async (next: EventState) => {
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error('save failed');
      const result = await response.json() as { revision: number; updatedAt: number };
      setOnline(true);
      setState((current) => current.updatedAt === next.updatedAt ? { ...current, ...result } : current);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    channelRef.current = new BroadcastChannel(CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt > stateRef.current.updatedAt) {
        stateRef.current = incoming;
        setState(incoming);
      }
    };

    try {
      const local = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
      stateRef.current = local;
      setState(local);
    } catch { /* ignore */ }

    const pull = async (initial = false) => {
      try {
        const [scoreResponse, liveResponse] = await Promise.all([
          fetch('/api/state', { cache: 'no-store' }),
          fetch('/api/telestration', { cache: 'no-store' }),
        ]);
        if (scoreResponse.ok) {
          const remote = normalizeState(await scoreResponse.json() as EventState);
          if (remote.updatedAt >= stateRef.current.updatedAt || initial) {
            stateRef.current = remote;
            setState(remote);
            saveLocal(remote);
          }
        }
        if (liveResponse.ok) {
          const live = normalizeTelestrationState(await liveResponse.json());
          setCurrentRound(live.currentRound);
        }
        setOnline(scoreResponse.ok);
      } catch {
        setOnline(false);
      } finally {
        if (initial) setReady(true);
      }
    };

    void pull(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pull(false);
    }, 900);
    return () => {
      clearInterval(timer);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [saveLocal, unlocked]);

  const setRoundResult = useCallback((teamId: string, roundIndex: number, success: boolean) => {
    const next = structuredClone(stateRef.current);
    const team = next.teams.find((entry) => entry.id === teamId);
    if (!team) return;
    while (team.teleRounds.length < 4) team.teleRounds.push(false);
    team.teleRounds[roundIndex] = success;
    team.teleManual = null;
    const now = Date.now();
    next.updatedAt = now;
    next.logs = [{
      id: crypto.randomUUID(),
      at: now,
      text: `${team.name} 텔레스트레이션 R${roundIndex + 1} ${success ? '정답 +5점' : '0점'}`,
    }, ...next.logs].slice(0, 100);
    stateRef.current = next;
    setState(next);
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  if (!unlocked) return null;
  const teams = state.teams.slice(0, 5);

  return <>
    <button className={styles.fab} type="button" onClick={() => setOpen(true)}>
      <span>점수 입력</span>
      <b>텔레스트레이션</b>
    </button>

    {open && <div className={styles.backdrop} onClick={() => setOpen(false)}>
      <section className={styles.sheet} onClick={(event) => event.stopPropagation()} aria-label="텔레스트레이션 점수 입력">
        <header>
          <div>
            <p>LIVE SCORING</p>
            <h2>텔레스트레이션 점수</h2>
            <small>{ready ? (online ? '● 점수판과 실시간 연동' : '● 오프라인 · 로컬 저장') : '점수 불러오는 중…'}</small>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="점수 패널 닫기">×</button>
        </header>

        <div className={styles.hint}>현재 <b>ROUND {currentRound + 1}</b> · 정답이면 해당 라운드 버튼을 눌러 +5점 처리합니다. 다시 누르면 취소됩니다.</div>

        <div className={styles.teamList}>
          {teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}>
            <div className={styles.teamHead}>
              <span><i />{team.name}</span>
              <strong>{teleScore(team)} <em>/ 20</em></strong>
            </div>
            <div className={styles.rounds}>
              {[0, 1, 2, 3].map((roundIndex) => {
                const success = Boolean(team.teleRounds[roundIndex]);
                const current = roundIndex === currentRound;
                return <button
                  key={roundIndex}
                  type="button"
                  className={`${success ? styles.success : ''} ${current ? styles.current : ''}`}
                  onClick={() => setRoundResult(team.id, roundIndex, !success)}
                  aria-pressed={success}
                >
                  <small>R{roundIndex + 1}{current ? ' · 현재' : ''}</small>
                  <b>{success ? '✓ +5점' : '○ 0점'}</b>
                </button>;
              })}
            </div>
          </article>)}
        </div>
      </section>
    </div>}
  </>;
}
