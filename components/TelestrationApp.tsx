'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventState, DEFAULT_STATE, normalizeState, teleScore } from '@/lib/game';
import {
  DEFAULT_TELESTRATION_STATE,
  TELESTRATION_STAGE_META,
  TelestrationStage,
  TelestrationState,
  formatCountdown,
  nextStage,
  normalizeTelestrationState,
  promptFor,
  roleOrder,
  stageDuration,
  stageRoleNumber,
} from '@/lib/telestration';
import styles from './TelestrationApp.module.css';

const LIVE_STORAGE_KEY = 'telestration-live-state-v1';
const LIVE_CHANNEL_KEY = 'telestration-live';
const SCORE_STORAGE_KEY = 'game-score-state-v1';
const SCORE_CHANNEL_KEY = 'game-score-live';

type LiveStore = {
  state: TelestrationState;
  ready: boolean;
  online: boolean;
  syncing: boolean;
  commit: (mutate: (draft: TelestrationState) => void) => void;
};

type ScoreStore = {
  state: EventState;
  ready: boolean;
  online: boolean;
  setRoundResult: (teamId: string, roundIndex: number, success: boolean) => void;
};

function useTelestrationStore(): LiveStore {
  const [state, setState] = useState<TelestrationState>(() => structuredClone(DEFAULT_TELESTRATION_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: TelestrationState) => {
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);

  const pushRemote = useCallback(async (next: TelestrationState) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/telestration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      const result = await response.json() as { revision: number; updatedAt: number };
      setOnline(true);
      setState((current) => current.updatedAt === next.updatedAt ? { ...current, ...result } : current);
    } catch { setOnline(false); }
    finally { setSyncing(false); }
  }, []);

  const persist = useCallback((next: TelestrationState) => {
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(LIVE_CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeTelestrationState(event.data as TelestrationState);
      if (incoming.updatedAt > stateRef.current.updatedAt) { stateRef.current = incoming; setState(incoming); }
    };
    let local = structuredClone(DEFAULT_TELESTRATION_STATE);
    try { local = normalizeTelestrationState(JSON.parse(localStorage.getItem(LIVE_STORAGE_KEY) ?? 'null')); } catch { /* ignore */ }
    stateRef.current = local; setState(local);

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/telestration', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeTelestrationState(await response.json() as TelestrationState);
        setOnline(true);
        if (remote.updatedAt > stateRef.current.updatedAt || (initial && stateRef.current.updatedAt === 0)) {
          stateRef.current = remote; setState(remote); saveLocal(remote);
        } else if (initial && stateRef.current.updatedAt > remote.updatedAt) {
          void pushRemote(stateRef.current);
        }
      } catch { setOnline(false); }
      finally { if (initial) setReady(true); }
    };
    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 800);
    const handleOnline = () => { setOnline(true); void pushRemote(stateRef.current); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      channelRef.current?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushRemote, saveLocal]);

  const commit = useCallback((mutate: (draft: TelestrationState) => void) => {
    const next = structuredClone(stateRef.current);
    mutate(next);
    next.updatedAt = Date.now();
    stateRef.current = next;
    setState(next);
    persist(next);
  }, [persist]);

  return { state, ready, online, syncing, commit };
}

function useScoreStore(): ScoreStore {
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: EventState) => {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);
  const pushRemote = useCallback(async (next: EventState) => {
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      setOnline(true);
    } catch { setOnline(false); }
  }, []);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(SCORE_CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt > stateRef.current.updatedAt) { stateRef.current = incoming; setState(incoming); }
    };
    let local = structuredClone(DEFAULT_STATE);
    try { local = normalizeState(JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? 'null')); } catch { /* ignore */ }
    stateRef.current = local; setState(local);

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeState(await response.json() as EventState);
        setOnline(true);
        const current = stateRef.current;
        if (remote.updatedAt > current.updatedAt || (initial && current.updatedAt === 0)) {
          stateRef.current = remote; setState(remote); saveLocal(remote);
        } else if (initial && current.updatedAt > remote.updatedAt) {
          void pushRemote(current);
        }
      } catch { setOnline(false); }
      finally { if (initial) setReady(true); }
    };
    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 900);
    const handleOnline = () => { setOnline(true); void pushRemote(stateRef.current); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      channelRef.current?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushRemote, saveLocal]);

  const setRoundResult = useCallback((teamId: string, roundIndex: number, success: boolean) => {
    const next = structuredClone(stateRef.current);
    const team = next.teams.find((entry) => entry.id === teamId);
    if (!team) return;
    while (team.teleRounds.length < 4) team.teleRounds.push(false);
    team.teleRounds[roundIndex] = success;
    team.teleManual = null;
    const now = Date.now();
    next.updatedAt = now;
    next.logs = [{ id: crypto.randomUUID(), at: now, text: `${team.name} 텔레스트레이션 R${roundIndex + 1} ${success ? '정답 +5점' : '0점'}` }, ...next.logs].slice(0, 100);
    stateRef.current = next;
    setState(next);
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  return { state, ready, online, setRoundResult };
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer); }, []);
  return now;
}

function stageRemaining(state: TelestrationState, now: number) {
  if (state.timerStatus === 'running' && state.stageEndsAt) return Math.max(0, Math.ceil((state.stageEndsAt - now) / 1000));
  if (state.timerStatus === 'paused' || state.timerStatus === 'expired') return Math.max(0, state.pausedRemainingSeconds ?? 0);
  return stageDuration(state, state.stage);
}

function sessionRemaining(state: TelestrationState, now: number) {
  if (!state.sessionStartedAt) return state.sessionSeconds;
  return Math.max(0, state.sessionSeconds - Math.floor((now - state.sessionStartedAt) / 1000));
}

function stageInstruction(state: TelestrationState) {
  const member = stageRoleNumber(state.currentRound, state.stage);
  if (state.stage === 'ready') return `각 팀 ${member}번만 진행자에게 제시어를 확인하세요.`;
  if (state.stage === 'draw1') return `${member}번: 제시어를 그림으로 표현하세요. 글자와 숫자는 금지!`;
  if (state.stage === 'guess1') return `${member}번: 앞사람의 그림만 보고 단어를 적으세요.`;
  if (state.stage === 'draw2') return `${member}번: 전달받은 단어를 다시 그림으로 표현하세요.`;
  if (state.stage === 'finalGuess') return `${member}번: 마지막 그림만 보고 최종 답을 적으세요.`;
  return TELESTRATION_STAGE_META[state.stage].instruction;
}

function PinGate({ pin, children }: { pin: string; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('game-score-admin') === 'yes');
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  if (unlocked) return children;
  return <main className={styles.pin}><section><div>텔</div><p>OPERATOR ACCESS</p><h1>텔레스트레이션</h1><form onSubmit={(event) => { event.preventDefault(); if (value === pin) { sessionStorage.setItem('game-score-admin', 'yes'); setUnlocked(true); } else { setError(true); setValue(''); } }}><input aria-label="관리자 PIN" type="password" inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value); setError(false); }} autoFocus /><button>진행 화면 열기</button>{error && <span>PIN이 일치하지 않습니다.</span>}</form><a href="/admin">← 점수판으로 돌아가기</a></section></main>;
}

function Admin({ live, score }: { live: LiveStore; score: ScoreStore }) {
  const { state, commit } = live;
  const now = useClock();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const meta = TELESTRATION_STAGE_META[state.stage];
  const instruction = stageInstruction(state);
  const remaining = stageRemaining(state, now);
  const overallRemaining = sessionRemaining(state, now);
  const roles = roleOrder(state.currentRound);

  useEffect(() => { setRevealed({}); }, [state.currentRound]);
  useEffect(() => {
    if (state.timerStatus === 'running' && state.stageEndsAt && state.stageEndsAt <= now) {
      commit((draft) => { if (draft.timerStatus === 'running') { draft.timerStatus = 'expired'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = 0; } });
    }
  }, [commit, now, state.stageEndsAt, state.timerStatus]);

  const startTimedStage = (stage: TelestrationStage) => commit((draft) => {
    const seconds = stageDuration(draft, stage);
    draft.stage = stage;
    draft.timerStatus = seconds > 0 ? 'running' : 'idle';
    draft.stageEndsAt = seconds > 0 ? Date.now() + seconds * 1000 : null;
    draft.pausedRemainingSeconds = null;
    draft.sessionStartedAt ??= Date.now();
  });

  const advance = () => {
    if (state.stage === 'setup') {
      commit((draft) => { draft.currentRound = 0; draft.stage = 'ready'; draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = null; });
      return;
    }
    if (state.stage === 'judge') {
      commit((draft) => {
        if (draft.currentRound >= 3) { draft.stage = 'finished'; draft.timerStatus = 'idle'; }
        else { draft.currentRound += 1; draft.stage = 'ready'; draft.timerStatus = 'idle'; }
        draft.stageEndsAt = null;
        draft.pausedRemainingSeconds = null;
      });
      return;
    }
    if (state.stage === 'finished') return;
    startTimedStage(nextStage(state.stage));
  };

  const pause = () => commit((draft) => {
    draft.pausedRemainingSeconds = draft.stageEndsAt ? Math.max(0, Math.ceil((draft.stageEndsAt - Date.now()) / 1000)) : stageDuration(draft, draft.stage);
    draft.stageEndsAt = null;
    draft.timerStatus = 'paused';
  });
  const resume = () => commit((draft) => {
    const left = Math.max(1, draft.pausedRemainingSeconds ?? stageDuration(draft, draft.stage));
    draft.stageEndsAt = Date.now() + left * 1000;
    draft.pausedRemainingSeconds = null;
    draft.timerStatus = 'running';
  });

  const teams = score.state.teams.slice(0, 5);
  const nextLabel = state.stage === 'setup' ? '게임 준비 시작' : state.stage === 'ready' ? '첫 그림 시작' : state.stage === 'draw1' ? '추측 단계로' : state.stage === 'guess1' ? '두 번째 그림으로' : state.stage === 'draw2' ? '최종 정답으로' : state.stage === 'finalGuess' ? '정답 확인' : state.stage === 'judge' ? (state.currentRound === 3 ? '게임 종료' : '다음 라운드') : '';

  return <main className={styles.admin}>
    <header><div><p>TELESTRATION CONTROL</p><h1>텔레스트레이션 LIVE</h1><small>{score.state.eventName}</small></div><nav><span>{live.syncing ? '동기화 중…' : live.online && score.online ? '● 실시간 연결' : '● 오프라인'}</span><a href="/display/telestration" target="_blank" rel="noreferrer">전광판 ↗</a><a href="/admin">점수판 →</a></nav></header>

    <section className={styles.hero}>
      <div className={styles.heroTop}><b>ROUND {state.currentRound + 1}/4 · 역할 {roles.join(' → ')}</b><b>전체 남은 시간 {formatCountdown(overallRemaining)}</b></div>
      <div className={styles.stage}><div><small>현재 단계</small><h2>{meta.title}</h2><p>{instruction}</p></div><div className={state.timerStatus === 'expired' ? styles.timeExpired : styles.time}><small>단계 타이머</small><strong>{formatCountdown(remaining)}</strong><em>{state.timerStatus === 'expired' ? '시간 종료' : state.timerStatus === 'paused' ? '일시정지' : state.timerStatus === 'running' ? '진행 중' : '대기'}</em></div></div>
      <div className={styles.actions}>
        {state.stage !== 'finished' && <button className={styles.primary} onClick={advance}>{nextLabel} →</button>}
        {state.timerStatus === 'running' && <button onClick={pause}>Ⅱ 일시정지</button>}
        {state.timerStatus === 'paused' && <button onClick={resume}>▶ 이어서</button>}
        {state.stage !== 'setup' && <button onClick={() => commit((draft) => { draft.stage = 'setup'; draft.currentRound = 0; draft.timerStatus = 'idle'; draft.stageEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = null; })}>↺ 전체 초기화</button>}
      </div>
    </section>

    {state.stage !== 'setup' && state.stage !== 'finished' && <section className={styles.prompts}><div className={styles.sectionHead}><div><p>PRIVATE PROMPTS</p><h2>{state.currentRound + 1}라운드 팀별 제시어 · 첫 그림 {roles[0]}번</h2></div><button onClick={() => setRevealed({})}>모두 가리기</button></div><p className={styles.notice}>제시어는 이 관리자 화면에서만 보입니다. 각 팀의 {roles[0]}번에게 해당 카드만 보여 주세요.</p><div className={styles.promptGrid}>{teams.map((team, index) => { const prompt = promptFor(state.currentRound, index); const isOpen = Boolean(revealed[team.id]); return <button key={team.id} className={styles.promptCard} style={{ '--team': team.color } as React.CSSProperties} onClick={() => setRevealed((current) => ({ ...current, [team.id]: !current[team.id] }))}><span>{team.name}</span><strong>{isOpen ? prompt.text : '••••••••'}</strong><em>{isOpen ? '탭하여 가리기' : '탭하여 제시어 보기'}</em></button>; })}</div></section>}

    {state.stage === 'judge' && <section className={styles.judge}><div className={styles.sectionHead}><div><p>SCORING</p><h2>{state.currentRound + 1}라운드 정답 판정</h2></div><strong>정답 팀은 +5점</strong></div><div className={styles.judgeGrid}>{teams.map((team, index) => { const prompt = promptFor(state.currentRound, index); const success = Boolean(team.teleRounds[state.currentRound]); return <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><h3>{prompt.text}</h3><small>인정 예: {prompt.accepted.slice(0, 2).join(' · ')}</small><button className={success ? styles.correct : ''} onClick={() => score.setRoundResult(team.id, state.currentRound, !success)}>{success ? '✓ 정답 +5점' : '○ 오답 0점'}</button><b>누적 {teleScore(team)} / 20</b></article>; })}</div></section>}

    <section className={styles.settings}><div><h3>단계별 시간</h3><p>5개 팀 동시 진행 · 역할은 라운드마다 자동 회전합니다.</p></div>{(['draw1','guess1','draw2','finalGuess'] as const).map((key) => <label key={key}>{TELESTRATION_STAGE_META[key].title}<input type="number" min={10} max={90} value={state.durations[key]} onChange={(event) => commit((draft) => { draft.durations[key] = Math.max(10, Math.min(90, Number(event.target.value))); })} />초</label>)}</section>
  </main>;
}

function Display({ live, score }: { live: LiveStore; score: ScoreStore }) {
  const state = live.state;
  const now = useClock();
  const meta = TELESTRATION_STAGE_META[state.stage];
  const instruction = stageInstruction(state);
  const remaining = stageRemaining(state, now);
  const overallRemaining = sessionRemaining(state, now);
  const teams = score.state.teams.slice(0, 5);
  const roles = roleOrder(state.currentRound);

  if (!live.ready || !score.ready) return <main className={styles.display}><div className={styles.displayLoading}>텔레스트레이션 준비 중…</div></main>;
  if (state.stage === 'finished') return <main className={styles.display}><section className={styles.finish}><p>TELESTRATION COMPLETE</p><h1>텔레스트레이션 종료!</h1><div>{teams.map((team) => <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><strong>{teleScore(team)}</strong><em>/ 20</em></article>)}</div><small>잠시 후 다음 게임으로 이동합니다.</small></section></main>;
  if (state.stage === 'judge') return <main className={styles.display}><section className={styles.displayJudge}><header><p>ROUND {state.currentRound + 1} · 정답 확인</p><h1>처음 제시어는?</h1></header><div>{teams.map((team, index) => { const success = Boolean(team.teleRounds[state.currentRound]); return <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><h2>{promptFor(state.currentRound, index).text}</h2><b className={success ? styles.resultCorrect : ''}>{success ? '✓ 정답 +5' : '판정 대기 / 0점'}</b></article>; })}</div></section></main>;

  return <main className={styles.display}><section className={styles.displayGame}><div className={styles.displayTop}><span>ROUND {state.currentRound + 1} / 4 · {roles.join(' → ')}</span><span>전체 {formatCountdown(overallRemaining)}</span></div><p>{state.stage === 'setup' ? 'TELESTRATION' : meta.title}</p><h1>{state.stage === 'setup' ? '텔레스트레이션' : instruction}</h1>{state.stage === 'ready' ? <div className={styles.readyMark}>각 팀 {roles[0]}번만 제시어를 확인하세요</div> : state.stage === 'setup' ? <div className={styles.readyMark}>잠시 후 시작합니다</div> : <div className={state.timerStatus === 'expired' ? styles.displayTimerExpired : styles.displayTimer}>{formatCountdown(remaining)}</div>}<footer>{state.timerStatus === 'expired' ? '시간 종료! 손을 멈추고 다음 안내를 기다려 주세요.' : state.stage === 'draw1' || state.stage === 'draw2' ? '글자 · 숫자 · 말로 설명하기 금지' : '앞 단계 결과만 보고 진행합니다.'}</footer></section></main>;
}

export function TelestrationApp({ mode }: { mode: 'admin' | 'display' }) {
  const live = useTelestrationStore();
  const score = useScoreStore();
  if (mode === 'admin' && (!live.ready || !score.ready)) return <main className={styles.loading}>텔레스트레이션 상태를 불러오는 중…</main>;
  if (mode === 'display') return <Display live={live} score={score} />;
  return <PinGate pin={score.state.adminPin}><Admin live={live} score={score} /></PinGate>;
}
