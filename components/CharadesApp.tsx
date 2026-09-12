'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARADES_CATEGORIES,
  CharadesCategoryKey,
  CharadesState,
  CharadesTeam,
  DEFAULT_CHARADES_STATE,
  buildCharadesSchedule,
  categoryById,
  formatShortTime,
  normalizeCharadesState,
  pickCharadesWord,
  plannedSlotLabel,
} from '@/lib/charades';
import styles from './CharadesApp.module.css';

const STORAGE_KEY = 'charades-live-state-v1';
const CHANNEL_KEY = 'charades-live';
const SCORE_STORAGE_KEY = 'game-score-state-v1';
const FALLBACK_TEAMS: CharadesTeam[] = Array.from({ length: 5 }, (_, index) => ({
  id: `team-${index + 1}`,
  name: `${index + 1}팀`,
  color: ['#ef5350', '#4f7cff', '#20a66a', '#f0b429', '#8b5cf6'][index],
}));

type ScoreContext = { eventName: string; adminPin: string; teams: CharadesTeam[] };
type Store = { state: CharadesState; ready: boolean; online: boolean; syncing: boolean; commit: (mutate: (draft: CharadesState) => void) => void };

function useCharadesStore(): Store {
  const [state, setState] = useState<CharadesState>(() => structuredClone(DEFAULT_CHARADES_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: CharadesState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);
  const pushRemote = useCallback(async (next: CharadesState) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/charades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      const result = await response.json() as { revision: number; updatedAt: number };
      setOnline(true);
      setState((current) => current.updatedAt === next.updatedAt ? { ...current, ...result } : current);
    } catch { setOnline(false); }
    finally { setSyncing(false); }
  }, []);
  const persist = useCallback((next: CharadesState) => { saveLocal(next); void pushRemote(next); }, [pushRemote, saveLocal]);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeCharadesState(event.data as CharadesState);
      if (incoming.updatedAt > stateRef.current.updatedAt) { stateRef.current = incoming; setState(incoming); }
    };
    let local = structuredClone(DEFAULT_CHARADES_STATE);
    try { local = normalizeCharadesState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { /* ignore */ }
    stateRef.current = local; setState(local);
    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/charades', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeCharadesState(await response.json() as CharadesState);
        setOnline(true);
        if (remote.updatedAt > stateRef.current.updatedAt || (initial && stateRef.current.updatedAt === 0)) {
          stateRef.current = remote; setState(remote); saveLocal(remote);
        } else if (initial && stateRef.current.updatedAt > remote.updatedAt) void pushRemote(stateRef.current);
      } catch { setOnline(false); }
      finally { if (initial) setReady(true); }
    };
    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 800);
    const handleOnline = () => { setOnline(true); void pushRemote(stateRef.current); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { clearInterval(timer); channelRef.current?.close(); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [pushRemote, saveLocal]);

  const commit = useCallback((mutate: (draft: CharadesState) => void) => {
    const next = structuredClone(stateRef.current); mutate(next); next.updatedAt = Date.now(); stateRef.current = next; setState(next); persist(next);
  }, [persist]);
  return { state, ready, online, syncing, commit };
}

function parseScoreContext(raw: unknown): ScoreContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { eventName?: unknown; adminPin?: unknown; teams?: unknown };
  if (!Array.isArray(value.teams) || !value.teams.length) return null;
  const teams = value.teams.flatMap((rawTeam) => {
    if (!rawTeam || typeof rawTeam !== 'object') return [];
    const team = rawTeam as { id?: unknown; name?: unknown; color?: unknown };
    if (typeof team.id !== 'string') return [];
    return [{ id: team.id, name: typeof team.name === 'string' ? team.name : team.id, color: typeof team.color === 'string' ? team.color : '#4f7cff' }];
  });
  return teams.length ? { eventName: typeof value.eventName === 'string' ? value.eventName : 'GAME SCORE', adminPin: typeof value.adminPin === 'string' ? value.adminPin : '0912', teams } : null;
}

function useScoreContext() {
  const [context, setContext] = useState<ScoreContext>({ eventName: 'GAME SCORE', adminPin: '0912', teams: FALLBACK_TEAMS });
  useEffect(() => {
    try { const local = parseScoreContext(JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? 'null')); if (local) setContext(local); } catch { /* ignore */ }
    const pull = async () => {
      try { const response = await fetch('/api/state', { cache: 'no-store' }); const parsed = response.ok ? parseScoreContext(await response.json()) : null; if (parsed) setContext(parsed); } catch { /* use cached team data */ }
    };
    void pull(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 2000); return () => clearInterval(timer);
  }, []);
  return context;
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer); }, []);
  return now;
}

function turnRemaining(state: CharadesState, duration: number, now: number) {
  if (state.phase === 'running' && state.turnEndsAt) return Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000));
  if (state.phase === 'paused' || state.phase === 'expired') return Math.max(0, state.pausedRemainingSeconds ?? 0);
  return duration;
}
function sessionRemaining(state: CharadesState, now: number) {
  return state.sessionStartedAt ? Math.max(0, state.totalSeconds - Math.floor((now - state.sessionStartedAt) / 1000)) : state.totalSeconds;
}

function PinGate({ pin, children }: { pin: string; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('game-score-admin') === 'yes');
  const [value, setValue] = useState(''); const [error, setError] = useState(false);
  if (unlocked) return children;
  return <main className={styles.pin}><section><div>몸</div><p>OPERATOR ACCESS</p><h1>몸으로 말해요</h1><form onSubmit={(event) => { event.preventDefault(); if (value === pin) { sessionStorage.setItem('game-score-admin', 'yes'); setUnlocked(true); } else { setError(true); setValue(''); } }}><input aria-label="관리자 PIN" type="password" inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value); setError(false); }} autoFocus /><button>진행 화면 열기</button>{error && <span>PIN이 일치하지 않습니다.</span>}</form><a href="/admin">← 점수판으로 돌아가기</a></section></main>;
}

function Admin({ store, context }: { store: Store; context: ScoreContext }) {
  const { state, commit } = store; const now = useClock();
  const schedule = useMemo(() => buildCharadesSchedule(context.teams, state), [context.teams, state]);
  const current = schedule[Math.min(state.currentTurnIndex, Math.max(0, schedule.length - 1))];
  const remaining = current ? turnRemaining(state, current.durationSeconds, now) : 0;
  useEffect(() => {
    if (state.phase === 'running' && state.turnEndsAt && state.turnEndsAt <= now) commit((draft) => { if (draft.phase === 'running') { draft.phase = 'expired'; draft.turnEndsAt = null; draft.pausedRemainingSeconds = 0; } });
  }, [commit, now, state.phase, state.turnEndsAt]);
  if (!current) return <main className={styles.loading}>팀 정보를 불러오는 중…</main>;
  const category = categoryById(current.categoryId);
  const drawWord = (reveal: boolean) => { const picked = pickCharadesWord(current.categoryId, state.usedWords); commit((draft) => { draft.currentWord = picked.word; draft.usedWords = [...draft.usedWords, picked.key].slice(-500); draft.revealed = reveal; }); };
  const startTurn = () => { const picked = state.currentWord ? null : pickCharadesWord(current.categoryId, state.usedWords); commit((draft) => { if (picked) { draft.currentWord = picked.word; draft.usedWords = [...draft.usedWords, picked.key].slice(-500); } draft.revealed = true; draft.phase = 'running'; draft.turnEndsAt = Date.now() + current.durationSeconds * 1000; draft.pausedRemainingSeconds = null; draft.sessionStartedAt ??= Date.now(); }); };
  const move = (delta: number) => commit((draft) => {
    if (delta > 0 && draft.currentTurnIndex >= schedule.length - 1) { draft.phase = 'finished'; draft.currentWord = null; draft.revealed = false; draft.turnEndsAt = null; return; }
    draft.currentTurnIndex = Math.max(0, Math.min(schedule.length - 1, draft.currentTurnIndex + delta)); draft.phase = 'ready'; draft.currentWord = null; draft.revealed = false; draft.turnEndsAt = null; draft.pausedRemainingSeconds = null;
  });
  const rounds = Math.max(...schedule.map((turn) => turn.round));
  return <main className={styles.admin}>
    <header><div><p>WARM-UP CONTROL</p><h1>몸으로 말해요 LIVE</h1><small>{context.eventName}</small></div><nav><span>{store.syncing ? '동기화 중…' : store.online ? '● 실시간 연결' : '● 오프라인'}</span><a href="/display/charades" target="_blank" rel="noreferrer">전광판 ↗</a><a href="/admin">점수판 →</a></nav></header>
    <section className={styles.hero} style={{ '--team': current.teamColor } as React.CSSProperties}>
      <div className={styles.heroTop}><b>TURN {state.currentTurnIndex + 1}/{schedule.length}</b><b>전체 {formatShortTime(sessionRemaining(state, now))}</b></div>
      <div className={styles.heroGrid}><div><small>{current.round}라운드 · 담당 {current.memberNumbers.join('·')}번</small><h2>{current.teamName}</h2></div><div><small>주제</small><h2>{category.emoji} {category.label}</h2></div><div><small>제시어</small><h2>{state.currentWord ?? '아직 뽑지 않음'}</h2><em>{state.revealed ? '전광판 공개 중' : '전광판 숨김'}</em></div><div><small>이번 턴</small><h2>{formatShortTime(remaining)}</h2><em>{current.durationSeconds}초 배정</em></div></div>
      <div className={styles.actions}>
        {(state.phase === 'setup' || state.phase === 'finished') && <button className={styles.primary} onClick={() => commit((draft) => { draft.currentTurnIndex = 0; draft.phase = 'ready'; draft.revealed = false; draft.currentWord = null; draft.usedWords = []; draft.turnEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = Date.now(); })}>▶ 새 10분 세션 시작</button>}
        {state.phase !== 'setup' && state.phase !== 'finished' && <><button onClick={() => drawWord(false)}>🎲 제시어 뽑기</button><button disabled={!state.currentWord} onClick={() => commit((draft) => { draft.revealed = !draft.revealed; })}>{state.revealed ? '🙈 가리기' : '👁 공개'}</button>{state.phase === 'running' ? <button onClick={() => commit((draft) => { draft.pausedRemainingSeconds = draft.turnEndsAt ? Math.max(0, Math.ceil((draft.turnEndsAt - Date.now()) / 1000)) : current.durationSeconds; draft.turnEndsAt = null; draft.phase = 'paused'; })}>Ⅱ 일시정지</button> : state.phase === 'paused' ? <button className={styles.primary} onClick={() => commit((draft) => { const left = Math.max(1, draft.pausedRemainingSeconds ?? current.durationSeconds); draft.turnEndsAt = Date.now() + left * 1000; draft.pausedRemainingSeconds = null; draft.phase = 'running'; })}>▶ 이어서</button> : <button className={styles.primary} onClick={startTurn}>▶ 타이머 시작</button>}<button disabled={state.phase !== 'running' && state.phase !== 'paused'} onClick={() => drawWord(true)}>다음 제시어 →</button></>}
      </div>
      {state.phase !== 'setup' && <div className={styles.turnNav}><button disabled={state.currentTurnIndex === 0} onClick={() => move(-1)}>← 이전 팀</button><span>{state.phase === 'expired' ? '시간 종료! 다음 팀으로 넘겨 주세요.' : '팀 교대 시 제시어는 자동으로 숨겨집니다.'}</span><button disabled={state.phase === 'finished'} onClick={() => move(1)}>{state.currentTurnIndex === schedule.length - 1 ? '워밍업 종료 ✓' : '다음 팀 →'}</button></div>}
    </section>
    <section className={styles.settings}><div><h3>자동 시간 배정</h3><p>기본 10분 · 쉬운 주제보다 속담에 더 긴 시간을 배정합니다.</p></div><label>총 시간 <input type="number" min={3} max={30} value={Math.round(state.totalSeconds / 60)} onChange={(event) => commit((draft) => { draft.totalSeconds = Math.max(180, Math.min(1800, Number(event.target.value) * 60)); })} />분</label><label>팀 전환 <input type="number" min={0} max={30} value={state.transitionSeconds} onChange={(event) => commit((draft) => { draft.transitionSeconds = Math.max(0, Math.min(30, Number(event.target.value))); })} />초</label><b>팀당 {rounds}회 · 총 {schedule.length}턴</b></section>
    <section className={styles.members}>{context.teams.map((team) => <div key={team.id} style={{ '--team': team.color } as React.CSSProperties}><span>{team.name}</span><button onClick={() => commit((draft) => { draft.memberCounts[team.id] = Math.max(1, (draft.memberCounts[team.id] ?? 4) - 1); })}>−</button><strong>{state.memberCounts[team.id] ?? 4}명</strong><button onClick={() => commit((draft) => { draft.memberCounts[team.id] = Math.min(12, (draft.memberCounts[team.id] ?? 4) + 1); })}>＋</button></div>)}</section>
    <section className={styles.schedule}><h3>자동 배정표</h3>{schedule.map((turn) => <div key={turn.index} className={turn.index === state.currentTurnIndex ? styles.current : ''}><b>{turn.index + 1}</b><i style={{ background: turn.teamColor }} /><strong>{turn.teamName}</strong><select value={turn.categoryId} onChange={(event) => commit((draft) => { draft.categoryOverrides[String(turn.index)] = event.target.value as CharadesCategoryKey; if (turn.index === draft.currentTurnIndex) { draft.currentWord = null; draft.revealed = false; } })}>{CHARADES_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>)}</select><span>{turn.memberNumbers.join('·')}번</span><em>{turn.durationSeconds}초</em><small>{plannedSlotLabel(turn)}</small></div>)}</section>
    <footer><span>7개 주제 · 210개 제시어 · <b>무배점 워밍업</b></span><button onClick={() => { if (window.confirm('몸으로 말해요 진행상태를 초기화할까요?')) commit((draft) => { draft.currentTurnIndex = 0; draft.phase = 'setup'; draft.revealed = false; draft.currentWord = null; draft.usedWords = []; draft.turnEndsAt = null; draft.pausedRemainingSeconds = null; draft.sessionStartedAt = null; }); }}>진행상태 초기화</button></footer>
  </main>;
}

function Display({ state, context }: { state: CharadesState; context: ScoreContext }) {
  const now = useClock(); const schedule = useMemo(() => buildCharadesSchedule(context.teams, state), [context.teams, state]);
  const current = schedule[Math.min(state.currentTurnIndex, Math.max(0, schedule.length - 1))];
  if (state.phase === 'setup') return <main className={styles.idle}><div>몸</div><p>WARM-UP GAME</p><h1>몸으로 말해요</h1><strong>곧 시작합니다!</strong><small>총 {formatShortTime(state.totalSeconds)} · 점수 없는 워밍업</small></main>;
  if (state.phase === 'finished' || !current) return <main className={styles.idle}><div>👏</div><p>WARM-UP COMPLETE</p><h1>워밍업 종료!</h1><strong>모두 수고했습니다</strong></main>;
  const category = categoryById(current.categoryId); const remaining = turnRemaining(state, current.durationSeconds, now); const progress = Math.max(0, Math.min(100, remaining / current.durationSeconds * 100));
  return <main className={styles.display} style={{ '--team': current.teamColor } as React.CSSProperties}>
    <header><div><i /><strong>{current.teamName}</strong><span>{current.round}라운드 · {current.memberNumbers.join('·')}번 담당</span></div><b>TURN {state.currentTurnIndex + 1}/{schedule.length}</b><div><small>전체 남은 시간</small><strong>{formatShortTime(sessionRemaining(state, now))}</strong></div></header>
    <section><div className={styles.category}>{category.emoji} {category.label}</div>{state.phase === 'expired' ? <div className={styles.word}><small>TIME UP</small><h1>시간 종료!</h1><p>다음 팀을 준비해 주세요</p></div> : <><div className={styles.word}><small>{state.revealed ? '제시어' : 'READY'}</small><h1>{state.revealed && state.currentWord ? state.currentWord : '준비하세요!'}</h1><p>{state.revealed ? '몸으로만 표현해 주세요 · 말하기 금지' : `${current.teamName} 차례입니다`}</p></div><div className={styles.timer}><small>{state.phase === 'paused' ? 'PAUSED' : state.phase === 'running' ? 'TIME LEFT' : '배정 시간'}</small><strong>{formatShortTime(remaining)}</strong></div></>}</section>
    <footer><div><span style={{ width: `${progress}%` }} /></div><p>{state.phase === 'running' ? '맞히면 진행자가 다음 제시어로 넘깁니다!' : state.phase === 'paused' ? '진행자가 잠시 멈췄습니다' : '진행자 신호를 기다려 주세요'} <b>{current.durationSeconds}초 배정</b></p></footer>
  </main>;
}

export function CharadesApp({ mode }: { mode: 'admin' | 'display' }) {
  const store = useCharadesStore(); const context = useScoreContext();
  if (!store.ready) return <main className={styles.loading}>몸으로 말해요 준비 중…</main>;
  if (mode === 'display') return <Display state={store.state} context={context} />;
  return <PinGate pin={context.adminPin}><Admin store={store} context={context} /></PinGate>;
}
