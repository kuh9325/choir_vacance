'use client';

import { useEffect, useState } from 'react';
import { teleScore } from '@/lib/game';
import styles from './TelestrationScoreDock.module.css';
import { useTelestrationLive, useTelestrationScore } from './telestration/TelestrationRuntime';

export function TelestrationScoreDockDynamic() {
  const [unlocked, setUnlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const score = useTelestrationScore();
  const live = useTelestrationLive();

  useEffect(() => {
    const check = () => setUnlocked(sessionStorage.getItem('game-score-admin') === 'yes');
    check();
    const timer = window.setInterval(check, 400);
    return () => clearInterval(timer);
  }, []);

  if (!unlocked) return null;
  const currentRound = live.state.currentRound;
  const teams = score.state.teams;

  return <>
    <button className={styles.fab} type="button" onClick={() => setOpen(true)}><span>점수 입력</span><b>텔레스트레이션</b></button>
    {open && <div className={styles.backdrop} onClick={() => setOpen(false)}>
      <section className={styles.sheet} onClick={(event) => event.stopPropagation()} aria-label="텔레스트레이션 점수 입력">
        <header><div><p>LIVE SCORING</p><h2>텔레스트레이션 점수</h2><small>{score.ready ? (score.online ? '● 점수판과 실시간 연동' : '● 오프라인 · 로컬 저장') : '점수 불러오는 중…'}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="점수 패널 닫기">×</button></header>
        <div className={styles.hint}>현재 <b>ROUND {currentRound + 1}</b> · 4개 채점 라운드 × 5점 = 20점입니다.</div>
        <div className={styles.teamList}>{teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}>
          <div className={styles.teamHead}><span><i />{team.name}</span><strong>{teleScore(team)} <em>/ 20</em></strong></div>
          <div className={styles.rounds}>{[0, 1, 2, 3].map((roundIndex) => {
            const success = Boolean(team.teleRounds[roundIndex]);
            const current = roundIndex === currentRound;
            return <button key={roundIndex} type="button" className={`${success ? styles.success : ''} ${current ? styles.current : ''}`} onClick={() => score.setRoundResult(team.id, roundIndex, !success)} aria-pressed={success}><small>R{roundIndex + 1}{current ? ' · 현재' : ''}</small><b>{success ? '✓ +5점' : '○ 0점'}</b></button>;
          })}</div>
        </article>)}</div>
      </section>
    </div>}
  </>;
}
