'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STATE, EventState, normalizeState, teleScore } from '@/lib/game';
import { DEFAULT_TELESTRATION_STATE, TelestrationState, normalizeTelestrationState } from '@/lib/telestration';
import styles from './TelestrationScoreRibbon.module.css';

const SCORE_STORAGE_KEY = 'game-score-state-v1';
const SCORE_CHANNEL_KEY = 'game-score-live';
const LIVE_STORAGE_KEY = 'telestration-live-state-v1';
const LIVE_CHANNEL_KEY = 'telestration-live';

export function TelestrationScoreRibbon() {
  const [score, setScore] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [live, setLive] = useState<TelestrationState>(() => structuredClone(DEFAULT_TELESTRATION_STATE));
  const scoreRef = useRef(score);
  const liveRef = useRef(live);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { liveRef.current = live; }, [live]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCORE_STORAGE_KEY);
      if (raw) {
        const parsed = normalizeState(JSON.parse(raw));
        scoreRef.current = parsed;
        setScore(parsed);
      }
    } catch { /* ignore local cache */ }
    try {
      const raw = localStorage.getItem(LIVE_STORAGE_KEY);
      if (raw) {
        const parsed = normalizeTelestrationState(JSON.parse(raw));
        liveRef.current = parsed;
        setLive(parsed);
      }
    } catch { /* ignore local cache */ }

    const scoreChannel = new BroadcastChannel(SCORE_CHANNEL_KEY);
    const liveChannel = new BroadcastChannel(LIVE_CHANNEL_KEY);
    scoreChannel.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt >= scoreRef.current.updatedAt) {
        scoreRef.current = incoming;
        setScore(incoming);
      }
    };
    liveChannel.onmessage = (event) => {
      const incoming = normalizeTelestrationState(event.data as TelestrationState);
      if (incoming.updatedAt >= liveRef.current.updatedAt) {
        liveRef.current = incoming;
        setLive(incoming);
      }
    };

    const pull = async () => {
      try {
        const [scoreResponse, liveResponse] = await Promise.all([
          fetch('/api/state', { cache: 'no-store' }),
          fetch('/api/telestration', { cache: 'no-store' }),
        ]);
        if (scoreResponse.ok) {
          const incoming = normalizeState(await scoreResponse.json() as EventState);
          if (incoming.updatedAt >= scoreRef.current.updatedAt) {
            scoreRef.current = incoming;
            setScore(incoming);
          }
        }
        if (liveResponse.ok) {
          const incoming = normalizeTelestrationState(await liveResponse.json() as TelestrationState);
          if (incoming.updatedAt >= liveRef.current.updatedAt) {
            liveRef.current = incoming;
            setLive(incoming);
          }
        }
      } catch { /* keep last known values */ }
    };

    void pull();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pull();
    }, 900);

    return () => {
      clearInterval(timer);
      scoreChannel.close();
      liveChannel.close();
    };
  }, []);

  const teams = useMemo(() => score.teams.slice(0, 5), [score.teams]);
  const hidden = live.stage === 'judge' || live.stage === 'finished';
  if (hidden || teams.length === 0) return null;

  return <aside className={styles.ribbon} aria-label="텔레스트레이션 현재 점수">
    <div className={styles.label}>현재 점수</div>
    <div className={styles.teams}>
      {teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}>
        <span className={styles.teamName}><i />{team.name}</span>
        <strong>{teleScore(team)}<small>/20</small></strong>
        <div className={styles.rounds} aria-label={`${team.name} 라운드 결과`}>
          {Array.from({ length: 4 }, (_, index) => {
            const success = Boolean(team.teleRounds[index]);
            const failed = index < live.currentRound && !success;
            const className = success ? styles.success : failed ? styles.failed : '';
            return <span key={index} className={className}>{index + 1}</span>;
          })}
        </div>
      </article>)}
    </div>
  </aside>;
}
