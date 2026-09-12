'use client';

import { teleScore } from '@/lib/game';
import styles from './TelestrationScoreRibbon.module.css';
import { useTelestrationLive, useTelestrationScore } from './telestration/TelestrationRuntime';

export function TelestrationScoreRibbonDynamic() {
  const score = useTelestrationScore();
  const live = useTelestrationLive();
  const teams = score.state.teams;
  const hidden = live.state.stage === 'judge' || live.state.stage === 'finished';
  if (hidden || !teams.length) return null;

  return <aside className={styles.ribbon} aria-label="텔레스트레이션 현재 점수">
    <div className={styles.label}>현재 점수</div>
    <div className={styles.teams} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
      {teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}>
        <span className={styles.teamName}><i />{team.name}</span>
        <strong>{teleScore(team)}<small>/20</small></strong>
        <div className={styles.rounds} aria-label={`${team.name} 라운드 결과`}>
          {Array.from({ length: 4 }, (_, index) => {
            const success = Boolean(team.teleRounds[index]);
            const done = index < live.state.currentRound || live.state.stage === 'judge' || live.state.stage === 'finished';
            return <span key={index} className={success ? styles.success : done ? styles.failed : ''}>{index + 1}</span>;
          })}
        </div>
      </article>)}
    </div>
  </aside>;
}
