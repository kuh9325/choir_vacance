'use client';

import { useMemo } from 'react';
import { teleScore } from '@/lib/game';
import {
  buildTelestrationPlan,
  formatCountdown,
  memberCountFor,
  memberForStep,
  promptFor,
  stepDuration,
  stepKind,
  stepTitle,
} from '@/lib/telestration';
import styles from '@/components/TelestrationApp.module.css';
import { LiveStore, ScoreStore, useTelestrationClock } from './TelestrationRuntime';

function remainingSeconds(live: LiveStore, plan: ReturnType<typeof buildTelestrationPlan>, now: number) {
  const { state } = live;
  if (state.timerStatus === 'running' && state.stageEndsAt) return Math.max(0, Math.ceil((state.stageEndsAt - now) / 1000));
  if (state.timerStatus === 'paused' || state.timerStatus === 'expired') return Math.max(0, state.pausedRemainingSeconds ?? 0);
  return state.stage === 'chain' ? stepDuration(plan, state.chainStep) : 0;
}

export function TelestrationDynamicDisplay({ live, score, memberCounts }: { live: LiveStore; score: ScoreStore; memberCounts: Record<string, number> }) {
  const state = live.state;
  const teams = score.state.teams;
  const now = useTelestrationClock();
  const plan = useMemo(() => buildTelestrationPlan(teams.map((team) => team.id), memberCounts, state.sessionSeconds), [teams, memberCounts, state.sessionSeconds]);
  const remaining = remainingSeconds(live, plan, now);
  const overallRemaining = state.sessionStartedAt ? Math.max(0, state.sessionSeconds - Math.floor((now - state.sessionStartedAt) / 1000)) : state.sessionSeconds;

  if (!live.ready || !score.ready) return <main className={styles.display}><div className={styles.displayLoading}>텔레스트레이션 준비 중…</div></main>;

  if (state.stage === 'finished') return <main className={styles.display}><section className={styles.finish}><p>TELESTRATION COMPLETE</p><h1>텔레스트레이션 종료!</h1><div style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>{teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><strong>{teleScore(team)}</strong><em>/ 20</em></article>)}</div><small>관리자가 기본화면으로 돌아가면 전광판도 자동 전환됩니다.</small></section></main>;

  if (state.stage === 'judge') return <main className={styles.display}><section className={styles.displayJudge}><header><p>ROUND {state.currentRound + 1} · 정답 확인</p><h1>처음 제시어는?</h1></header><div style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>{teams.map((team, index) => { const success = Boolean(team.teleRounds[state.currentRound]); return <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><h2>{promptFor(state.currentRound, index).text}</h2><b className={success ? styles.resultCorrect : ''}>{success ? '✓ 정답 +5' : '판정 대기 / 0점'}</b></article>; })}</div></section></main>;

  const kind = state.stage === 'chain' ? stepKind(state.chainStep) : null;
  const title = state.stage === 'setup' ? 'TELESTRATION' : state.stage === 'ready' ? '제시어 확인' : stepTitle(state.chainStep);
  const mainInstruction = state.stage === 'setup' ? '텔레스트레이션'
    : state.stage === 'ready' ? '각 팀 첫 그림 담당만 제시어를 확인하세요'
      : kind === 'draw' ? '그림으로 표현하세요!' : '그림만 보고 단어를 적으세요!';
  const starterText = teams.map((team) => `${team.name} ${memberForStep(state.currentRound, 0, memberCountFor(team.id, memberCounts))}번`).join(' · ');
  const assignmentText = teams.map((team) => `${team.name} ${memberForStep(state.currentRound, state.chainStep, memberCountFor(team.id, memberCounts))}번`).join(' · ');

  return <main className={styles.display}><section className={styles.displayGame}>
    <div className={styles.displayTop}><span>ROUND {state.currentRound + 1} / 4 · {teams.length}팀 · 최대 {plan.maxMembers}명 · {plan.chainSteps}단계</span><span>전체 {formatCountdown(overallRemaining)}</span></div>
    <p>{title}</p><h1>{mainInstruction}</h1>
    {state.stage === 'ready' ? <div className={styles.readyMark}>첫 그림 담당 · {starterText}</div>
      : state.stage === 'setup' ? <div className={styles.readyMark}>총 {Math.round(state.sessionSeconds / 60)}분 · 팀 구성에 맞춰 자동 배정</div>
        : <><div className={state.timerStatus === 'expired' ? styles.displayTimerExpired : styles.displayTimer}>{formatCountdown(remaining)}</div><footer>{state.timerStatus === 'expired' ? '시간 종료! 손을 멈추고 다음 안내를 기다려 주세요.' : `담당 · ${assignmentText}`}</footer></>}
  </section></main>;
}
