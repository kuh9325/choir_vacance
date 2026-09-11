'use client';

import { useEffect, useMemo, useState } from 'react';
import { teleScore } from '@/lib/game';
import {
  TELESTRATION_STAGE_META,
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

function sessionRemaining(live: LiveStore, now: number) {
  const { state } = live;
  return state.sessionStartedAt ? Math.max(0, state.sessionSeconds - Math.floor((now - state.sessionStartedAt) / 1000)) : state.sessionSeconds;
}

export function TelestrationDynamicAdmin({ live, score, memberCounts }: { live: LiveStore; score: ScoreStore; memberCounts: Record<string, number> }) {
  const { state, commit } = live;
  const teams = score.state.teams;
  const now = useTelestrationClock();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const plan = useMemo(() => buildTelestrationPlan(teams.map((team) => team.id), memberCounts, state.sessionSeconds), [teams, memberCounts, state.sessionSeconds]);
  const remaining = remainingSeconds(live, plan, now);
  const totalRemaining = sessionRemaining(live, now);
  const kind = state.stage === 'chain' ? stepKind(state.chainStep) : null;
  const title = state.stage === 'chain' ? stepTitle(state.chainStep) : TELESTRATION_STAGE_META[state.stage].title;
  const assignments = teams.map((team) => ({ team, member: memberForStep(state.currentRound, state.chainStep, memberCountFor(team.id, memberCounts)) }));
  const assignmentText = assignments.map(({ team, member }) => `${team.name} ${member}번`).join(' · ');

  useEffect(() => { setRevealed({}); }, [state.currentRound]);
  useEffect(() => {
    if (state.timerStatus === 'running' && state.stageEndsAt && state.stageEndsAt <= now) {
      commit((draft) => { if (draft.timerStatus === 'running') { draft.timerStatus = 'expired'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = 0; } });
    }
  }, [commit, now, state.stageEndsAt, state.timerStatus]);

  const startStep = (step: number) => commit((draft) => {
    draft.stage = 'chain';
    draft.chainStep = step;
    draft.timerStatus = 'running';
    draft.stageEndsAt = Date.now() + stepDuration(plan, step) * 1000;
    draft.pausedRemainingSeconds = null;
    draft.sessionStartedAt ??= Date.now();
  });

  const advance = () => {
    if (state.stage === 'setup') {
      commit((draft) => { draft.currentRound = 0; draft.stage = 'ready'; draft.chainStep = 0; draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = null; });
      return;
    }
    if (state.stage === 'ready') { startStep(0); return; }
    if (state.stage === 'chain') {
      if (state.chainStep + 1 < plan.chainSteps) startStep(state.chainStep + 1);
      else commit((draft) => { draft.stage = 'judge'; draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null; });
      return;
    }
    if (state.stage === 'judge') {
      commit((draft) => {
        if (draft.currentRound >= 3) draft.stage = 'finished';
        else { draft.currentRound += 1; draft.stage = 'ready'; draft.chainStep = 0; }
        draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null;
      });
    }
  };

  const pause = () => commit((draft) => {
    draft.pausedRemainingSeconds = draft.stageEndsAt ? Math.max(0, Math.ceil((draft.stageEndsAt - Date.now()) / 1000)) : stepDuration(plan, draft.chainStep);
    draft.stageEndsAt = null; draft.timerStatus = 'paused';
  });
  const resume = () => commit((draft) => {
    const left = Math.max(1, draft.pausedRemainingSeconds ?? stepDuration(plan, draft.chainStep));
    draft.stageEndsAt = Date.now() + left * 1000; draft.pausedRemainingSeconds = null; draft.timerStatus = 'running';
  });

  const nextLabel = state.stage === 'setup' ? '게임 준비 시작'
    : state.stage === 'ready' ? '첫 그림 시작'
      : state.stage === 'chain' ? (state.chainStep + 1 < plan.chainSteps ? `${stepTitle(state.chainStep + 1)}로` : '정답 확인')
        : state.stage === 'judge' ? (state.currentRound === 3 ? '게임 종료' : '다음 라운드') : '';
  const instruction = state.stage === 'chain'
    ? kind === 'draw' ? '표시된 담당자가 전달받은 내용을 그림으로 표현하세요. 글자와 숫자는 금지!' : '표시된 담당자가 앞사람의 그림만 보고 단어를 적으세요.'
    : TELESTRATION_STAGE_META[state.stage].instruction;

  return <main className={styles.admin}>
    <header><div><p>TELESTRATION CONTROL</p><h1>텔레스트레이션 LIVE</h1><small>{score.state.eventName}</small></div><nav><span>{live.syncing ? '동기화 중…' : live.online && score.online ? '● 실시간 연결' : '● 오프라인'}</span><a href="/display" target="_blank" rel="noreferrer">전광판 ↗</a><a href="/admin">점수판 →</a></nav></header>

    <section className={styles.hero}>
      <div className={styles.heroTop}><b>ROUND {state.currentRound + 1}/4 · {teams.length}팀 · 최대 {plan.maxMembers}명 · {plan.chainSteps}단계</b><b>전체 {formatCountdown(totalRemaining)}</b></div>
      <div className={styles.stage}><div><small>현재 단계</small><h2>{title}</h2><p>{instruction}{state.stage === 'chain' && <><br /><b>담당 · {assignmentText}</b></>}</p></div><div className={state.timerStatus === 'expired' ? styles.timeExpired : styles.time}><small>단계 타이머</small><strong>{formatCountdown(remaining)}</strong><em>{state.timerStatus === 'expired' ? '시간 종료' : state.timerStatus === 'paused' ? '일시정지' : state.timerStatus === 'running' ? '진행 중' : '대기'}</em></div></div>
      <div className={styles.actions}>{state.stage !== 'finished' && <button className={styles.primary} onClick={advance}>{nextLabel} →</button>}{state.timerStatus === 'running' && <button onClick={pause}>Ⅱ 일시정지</button>}{state.timerStatus === 'paused' && <button onClick={resume}>▶ 이어서</button>}{state.stage !== 'setup' && <button onClick={() => commit((draft) => { draft.stage = 'setup'; draft.currentRound = 0; draft.chainStep = 0; draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = null; })}>↺ 전체 초기화</button>}</div>
    </section>

    {state.stage !== 'setup' && state.stage !== 'judge' && state.stage !== 'finished' && <section className={styles.prompts}><div className={styles.sectionHead}><div><p>PRIVATE PROMPTS</p><h2>{state.currentRound + 1}라운드 팀별 제시어</h2></div><button onClick={() => setRevealed({})}>모두 가리기</button></div><p className={styles.notice}>각 카드에 표시된 첫 그림 담당에게만 보여 주세요. 인원수에 맞춰 담당 번호가 자동 순환합니다.</p><div className={styles.promptGrid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>{teams.map((team, index) => { const prompt = promptFor(state.currentRound, index); const isOpen = Boolean(revealed[team.id]); const starter = memberForStep(state.currentRound, 0, memberCountFor(team.id, memberCounts)); return <button key={team.id} className={styles.promptCard} style={{ '--team': team.color } as React.CSSProperties} onClick={() => setRevealed((current) => ({ ...current, [team.id]: !current[team.id] }))}><span>{team.name} · 첫 그림 {starter}번</span><strong>{isOpen ? prompt.text : '••••••••'}</strong><em>{isOpen ? '탭하여 가리기' : '탭하여 제시어 보기'}</em></button>; })}</div></section>}

    {state.stage === 'judge' && <section className={styles.judge}><div className={styles.sectionHead}><div><p>SCORING</p><h2>{state.currentRound + 1}라운드 정답 판정</h2></div><strong>정답 팀 +5점</strong></div><div className={styles.judgeGrid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>{teams.map((team, index) => { const prompt = promptFor(state.currentRound, index); const success = Boolean(team.teleRounds[state.currentRound]); return <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><h3>{prompt.text}</h3><small>인정 예: {prompt.accepted.slice(0, 2).join(' · ')}</small><button className={success ? styles.correct : ''} onClick={() => score.setRoundResult(team.id, state.currentRound, !success)}>{success ? '✓ 정답 +5점' : '○ 오답 0점'}</button><b>누적 {teleScore(team)} / 20</b></article>; })}</div></section>}

    <section className={styles.settings}><div><h3>자동 시간 배정</h3><p>{teams.length}팀 · 최대 {plan.maxMembers}명 · 라운드당 {plan.chainSteps}단계 · 4라운드/20점 고정</p></div><label>총 시간 <input type="number" min={10} max={30} value={Math.round(state.sessionSeconds / 60)} onChange={(event) => commit((draft) => { draft.sessionSeconds = Math.max(600, Math.min(1800, Number(event.target.value) * 60)); })} />분</label><label>그림 <strong>{plan.drawSeconds}초</strong></label><label>추측 <strong>{plan.guessSeconds}초</strong></label><b>진행 {formatCountdown(plan.timedSeconds)} · 준비/판정 {formatCountdown(plan.reserveSeconds)}</b></section>
  </main>;
}
