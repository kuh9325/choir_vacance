'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_STATE,
  PROGRAMS,
  EventState,
  GameKey,
  Team,
  formatTime,
  gameMax,
  gameScore,
  huntScore,
  isGameStarted,
  makeTeam,
  normalizeState,
  pacScore,
  rankPacman,
  rankTeams,
  teleScore,
  totalScore,
  treasureItemScore,
} from '@/lib/game';

const STORAGE_KEY = 'game-score-state-v1';
const UNDO_KEY = 'game-score-undo-v1';

type Store = {
  state: EventState;
  ready: boolean;
  online: boolean;
  syncing: boolean;
  commit: (text: string, mutate: (draft: EventState) => void) => void;
  undo: () => void;
  canUndo: boolean;
};

function useEventStore(): Store {
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const undoRef = useRef<EventState[]>([]);

  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: EventState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);

  const pushRemote = useCallback(async (next: EventState) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      const result = await response.json() as { revision: number; updatedAt: number };
      setOnline(true);
      setState((current) => current.updatedAt === next.updatedAt ? { ...current, ...result } : current);
    } catch {
      setOnline(false);
    } finally {
      setSyncing(false);
    }
  }, []);

  const persist = useCallback((next: EventState) => {
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('game-score-live');
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt > stateRef.current.updatedAt) setState(incoming);
    };
    try {
      undoRef.current = (JSON.parse(localStorage.getItem(UNDO_KEY) ?? '[]') as EventState[]).slice(-20);
      setCanUndo(undoRef.current.length > 0);
    } catch { undoRef.current = []; }

    const local = (() => {
      try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
      catch { return normalizeState(null); }
    })();
    setState(local);
    stateRef.current = local;

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeState(await response.json() as EventState);
        setOnline(true);
        const current = stateRef.current;
        if (remote.updatedAt > current.updatedAt || (initial && current.updatedAt === 0)) {
          setState(remote); stateRef.current = remote; saveLocal(remote);
        } else if (initial && current.updatedAt > remote.updatedAt) {
          void pushRemote(current);
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

  const commit = useCallback((text: string, mutate: (draft: EventState) => void) => {
    const previous = structuredClone(stateRef.current);
    const next = structuredClone(previous);
    mutate(next);
    next.updatedAt = Date.now();
    next.logs = [{ id: crypto.randomUUID(), at: next.updatedAt, text }, ...next.logs].slice(0, 100);
    undoRef.current = [...undoRef.current, previous].slice(-20);
    localStorage.setItem(UNDO_KEY, JSON.stringify(undoRef.current));
    setCanUndo(true);
    stateRef.current = next;
    setState(next);
    persist(next);
  }, [persist]);

  const undo = useCallback(() => {
    const restored = undoRef.current.pop();
    if (!restored) return;
    const next = { ...restored, updatedAt: Date.now(), logs: [{ id: crypto.randomUUID(), at: Date.now(), text: '가장 최근 변경을 실행 취소함' }, ...restored.logs].slice(0, 100) };
    undoRef.current = undoRef.current.slice(-20);
    localStorage.setItem(UNDO_KEY, JSON.stringify(undoRef.current));
    setCanUndo(undoRef.current.length > 0);
    stateRef.current = next;
    setState(next);
    persist(next);
  }, [persist]);

  return { state, ready, online, syncing, commit, undo, canUndo };
}

function formatClock(startedAt: number | null, now: number) {
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function scoreLabel(game: GameKey) {
  return game === 'tele' ? '텔레스트레이션' : game === 'pac' ? '바닥팩맨' : '팀전 보물찾기';
}

function formatRank(rank: number, ranked: Array<{ rank: number }>, medals = false) {
  if (ranked.filter((entry) => entry.rank === rank).length > 1) return `공동 ${rank}위`;
  if (medals) return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`;
  return `${rank}위`;
}

function TeamBadge({ team, compact = false }: { team: Team; compact?: boolean }) {
  return <span className={compact ? 'team-badge compact' : 'team-badge'} style={{ '--team': team.color } as React.CSSProperties}><i />{team.name}</span>;
}

function Stepper({ label, value, min = 0, max = 99, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (next: number) => void }) {
  return <div className="stepper-row"><span>{label}</span><div className="stepper"><button aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button><strong>{value}</strong><button aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(value + 1)}>＋</button></div></div>;
}

function PinGate({ state, children }: { state: EventState; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('game-score-admin') === 'yes');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  if (unlocked) return children;
  return <main className="pin-screen"><section className="pin-card"><div className="pin-mark">GS</div><p className="eyebrow">OPERATOR ACCESS</p><h1>운영자 모드</h1><p>현장 운영자 PIN을 입력해 주세요.</p><form onSubmit={(event) => { event.preventDefault(); if (pin === state.adminPin) { sessionStorage.setItem('game-score-admin', 'yes'); setUnlocked(true); } else { setError(true); setPin(''); } }}><label htmlFor="pin">관리자 PIN</label><input id="pin" inputMode="numeric" type="password" maxLength={8} value={pin} onChange={(event) => { setPin(event.target.value); setError(false); }} placeholder="••••" autoFocus /><button type="submit">운영자 화면 열기</button>{error && <span role="alert">PIN이 일치하지 않습니다.</span>}</form><a href="/display">전광판 화면으로 이동 →</a><small>초기 PIN은 행사 날짜인 0905입니다.</small></section></main>;
}

function ScoreEditor({ team, game, state, changeTeam }: { team: Team; game: GameKey; state: EventState; changeTeam: (text: string, mutate: (team: Team) => void) => void }) {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!team.timerStartedAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [team.timerStartedAt]);

  if (game === 'tele') {
    return <div className="editor-body"><div className="editor-title"><div><p className="section-kicker">4 ROUNDS</p><h3>정답 버튼을 눌러 기록</h3></div><strong>{teleScore(team)} <small>/ {state.maxScores.tele}</small></strong></div><div className="round-grid">{team.teleRounds.map((success, index) => <button key={index} className={success ? 'round-button success' : 'round-button'} onClick={() => changeTeam(`${team.name} 텔레스트레이션 R${index + 1} ${success ? '취소' : '+5점'}`, (draft) => { draft.teleRounds[index] = !draft.teleRounds[index]; draft.teleManual = null; })}><span>ROUND {index + 1}</span><b>{success ? '✓ 정답 +5' : '＋ 정답 +5'}</b></button>)}</div><label className="manual-field"><span>직접 점수 수정</span><div><input type="number" min={0} max={state.maxScores.tele} value={team.teleManual ?? teleScore(team)} onChange={(event) => changeTeam(`${team.name} 텔레스트레이션 점수 직접 수정`, (draft) => { draft.teleManual = Math.max(0, Math.min(state.maxScores.tele, Number(event.target.value))); })} /><span>/ {state.maxScores.tele}</span></div></label>{team.teleManual !== null && <button className="text-button" onClick={() => changeTeam(`${team.name} 텔레스트레이션 라운드 합산으로 복귀`, (draft) => { draft.teleManual = null; })}>라운드 자동 합산으로 되돌리기</button>}</div>;
  }

  if (game === 'pac') {
    return <div className="editor-body"><div className="editor-title"><div><p className="section-kicker">FLOOR PAC-MAN</p><h3>획득 결과 기록</h3></div><strong>{pacScore(team)} <small>/ {state.maxScores.pac}</small></strong></div><div className="pac-grid"><Stepper label="일반 먹이" value={team.pacFood} max={15} onChange={(next) => changeTeam(`${team.name} 일반 먹이 ${team.pacFood} → ${next}`, (draft) => { draft.pacFood = next; })} /><button className={team.pacGold ? 'gold-toggle active' : 'gold-toggle'} onClick={() => changeTeam(`${team.name} 황금 먹이 ${team.pacGold ? '취소' : '획득'}`, (draft) => { draft.pacGold = !draft.pacGold; })}><span>황금 먹이</span><strong>{team.pacGold ? '★ 획득 +5' : '☆ 미획득'}</strong></button><Stepper label="잡힌 횟수" value={team.pacCaught} onChange={(next) => changeTeam(`${team.name} 잡힌 횟수 ${team.pacCaught} → ${next}`, (draft) => { draft.pacCaught = next; })} /></div><div className="rule-note">동점 순위: 획득점수 → 잡힌 횟수 적은 순 → 황금 먹이 획득</div></div>;
  }

  const runningSeconds = team.timerStartedAt && clock ? Math.floor((clock - team.timerStartedAt) / 1000) : 0;
  return <div className="editor-body"><div className="editor-title"><div><p className="section-kicker">5 TREASURES</p><h3>보물별 평가 체크</h3></div><strong>{huntScore(team)} <small>/ {state.maxScores.hunt}</small></strong></div><div className="treasure-list">{team.treasures.map((treasure, index) => <details key={index} open={index === 0}><summary><span>보물 {index + 1}</span><strong>{treasureItemScore(treasure)} / 6</strong></summary><div className="check-grid">{([['found', '보물 발견', '+1'], ['answer', '문제 정답', '+3'], ['mission', '팀 미션 성공', '+2'], ['hint', '힌트 사용', '−1']] as const).map(([key, label, points]) => <button key={key} className={treasure[key] ? `check-button checked ${key === 'hint' ? 'hint' : ''}` : 'check-button'} onClick={() => changeTeam(`${team.name} 보물 ${index + 1} ${label} ${treasure[key] ? '취소' : '체크'}`, (draft) => { draft.treasures[index][key] = !draft.treasures[index][key]; })}><span>{treasure[key] ? '✓' : '○'}</span><b>{label}</b><em>{points}</em></button>)}</div></details>)}</div><section className="timer-panel"><div><span>완주 시간</span><strong>{team.timerStartedAt ? formatTime(runningSeconds) : formatTime(team.finishSeconds)}</strong></div><div className="timer-actions">{!team.timerStartedAt ? <button className="primary-small" onClick={() => changeTeam(`${team.name} 보물찾기 타이머 시작`, (draft) => { draft.timerStartedAt = Date.now(); })}>▶ START</button> : <button className="finish-button" onClick={() => changeTeam(`${team.name} 보물찾기 완주 시간 기록`, (draft) => { draft.finishSeconds = Math.floor((Date.now() - (draft.timerStartedAt ?? Date.now())) / 1000); draft.timerStartedAt = null; })}>■ FINISH</button>}<label className="time-input">직접 입력 <input aria-label="완주 시간 분" type="number" min={0} value={Math.floor((team.finishSeconds ?? 0) / 60)} onChange={(event) => changeTeam(`${team.name} 완주 시간 직접 수정`, (draft) => { draft.finishSeconds = Number(event.target.value) * 60 + ((draft.finishSeconds ?? 0) % 60); draft.timerStartedAt = null; })} />분 <input aria-label="완주 시간 초" type="number" min={0} max={59} value={(team.finishSeconds ?? 0) % 60} onChange={(event) => changeTeam(`${team.name} 완주 시간 직접 수정`, (draft) => { draft.finishSeconds = Math.floor((draft.finishSeconds ?? 0) / 60) * 60 + Math.min(59, Number(event.target.value)); draft.timerStartedAt = null; })} />초</label></div></section></div>;
}

function AdminApp({ store }: { store: Store }) {
  const { state, online, syncing, commit, undo, canUndo } = store;
  const [tab, setTab] = useState<'scores' | 'timeline' | 'results' | 'logs' | 'settings'>('scores');
  const currentGame = PROGRAMS[state.programIndex]?.game ?? 'tele';
  const [game, setGame] = useState<GameKey>(currentGame);
  const [selectedTeamId, setSelectedTeamId] = useState(state.teams[0]?.id ?? '');
  const [resetStep, setResetStep] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const selectedTeam = state.teams.find((team) => team.id === selectedTeamId) ?? state.teams[0];
  const maxTotal = state.maxScores.tele + state.maxScores.pac + state.maxScores.hunt;
  const changeTeam = (text: string, mutate: (team: Team) => void) => commit(text, (draft) => { const team = draft.teams.find((item) => item.id === selectedTeam.id); if (team) mutate(team); });

  const download = (kind: 'csv' | 'json') => {
    const ranked = rankTeams(state.teams);
    const content = kind === 'json' ? JSON.stringify(state, null, 2) : '\uFEFF' + ['순위,팀,텔레스트레이션,바닥팩맨,보물찾기,총점,완주시간', ...ranked.map(({ team, rank }) => `${rank},${team.name},${teleScore(team)},${pacScore(team)},${huntScore(team)},${totalScore(team)},${formatTime(team.finishSeconds)}`)].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `game-score-${state.eventDate}.${kind}`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <main className="admin-shell">
    {!online && <div className="offline-banner">오프라인 상태 — 입력 내용은 이 기기에 임시 저장됩니다.</div>}
    <header className="admin-header"><div><p className="eyebrow">{state.eventDate.replaceAll('-', '.')}</p><h1>{state.eventName}</h1></div><div className="header-actions"><span className={online ? 'connection online' : 'connection'}><i />{syncing ? '동기화 중' : online ? '실시간 연결' : '로컬 저장'}</span><button className="undo-button" disabled={!canUndo} onClick={undo}>↶ Undo</button><a className="display-link" href="/display" target="_blank">전광판 열기 ↗</a></div></header>
    <section className="now-card"><div className="now-index">{state.programIndex + 1}<small>/ {PROGRAMS.length}</small></div><div><p className="section-kicker">NOW PLAYING</p><h2>{PROGRAMS[state.programIndex].name}</h2><p>{PROGRAMS[state.programIndex].meta}</p></div><strong className="event-timer">{formatClock(state.programStartedAt, now)}</strong><button onClick={() => commit('다음 프로그램으로 이동', (draft) => { draft.programIndex = Math.min(PROGRAMS.length - 1, draft.programIndex + 1); draft.programStartedAt = Date.now(); const nextGame = PROGRAMS[draft.programIndex].game; if (nextGame) setGame(nextGame); })}>다음 프로그램 <span>→</span></button></section>
    <nav className="admin-tabs">{([['scores','점수 입력','▦'],['timeline','진행 관리','⌁'],['results','결과 발표','★'],['logs','변경 기록','◴'],['settings','설정','⚙']] as const).map(([key,label,icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><b>{icon}</b><span>{label}</span></button>)}</nav>

    {tab === 'scores' && <section className="admin-content"><div className="content-heading"><div><p className="section-kicker">TEAM OVERVIEW</p><h2>팀별 종합점수</h2></div><span className="autosave">✓ 입력 즉시 자동 저장</span></div><div className="admin-team-grid">{state.teams.map((team, index) => <button key={team.id} className={selectedTeam.id === team.id ? 'admin-team-card selected' : 'admin-team-card'} style={{ '--team': team.color } as React.CSSProperties} onClick={() => setSelectedTeamId(team.id)}><div><span className="team-number">{index + 1}</span><TeamBadge team={team} compact /></div><strong>{totalScore(team)}<small> / {maxTotal}</small></strong><div className="progress-track"><span style={{ width: `${Math.min(100, totalScore(team) / maxTotal * 100)}%` }} /></div><dl><div><dt>텔레</dt><dd>{teleScore(team)}/{state.maxScores.tele}</dd></div><div><dt>팩맨</dt><dd>{pacScore(team)}/{state.maxScores.pac}</dd></div><div><dt>보물</dt><dd>{huntScore(team)}/{state.maxScores.hunt}</dd></div></dl></button>)}</div><div className="score-workspace"><div className="workspace-top"><div><p className="section-kicker">QUICK INPUT</p><h2><TeamBadge team={selectedTeam} /> 점수 입력</h2></div><div className="game-switch">{(['tele','pac','hunt'] as GameKey[]).map((key) => <button key={key} className={game === key ? 'active' : ''} onClick={() => setGame(key)}>{scoreLabel(key)}</button>)}</div></div><ScoreEditor team={selectedTeam} game={game} state={state} changeTeam={changeTeam} /></div></section>}

    {tab === 'timeline' && <section className="admin-content split-content"><div className="panel"><div className="content-heading"><div><p className="section-kicker">EVENT FLOW</p><h2>게임 진행 타임라인</h2></div></div><div className="timeline-list">{PROGRAMS.map((program, index) => <button key={program.time} className={index === state.programIndex ? 'timeline-item active' : index < state.programIndex ? 'timeline-item done' : 'timeline-item'} onClick={() => commit(`${program.name}(으)로 현재 프로그램 변경`, (draft) => { draft.programIndex = index; draft.programStartedAt = Date.now(); })}><time>{program.time}</time><i>{index < state.programIndex ? '✓' : index + 1}</i><div><strong>{program.name}</strong><span>{program.meta}</span></div>{index === state.programIndex && <em>진행 중</em>}</button>)}</div></div><div className="side-stack"><section className="panel simple-status"><p className="section-kicker">점수 없는 게임</p><h3>몸으로 말해요</h3><button className={state.charadesComplete ? 'status-toggle complete' : 'status-toggle'} onClick={() => commit(`몸으로 말해요 ${state.charadesComplete ? '완료 취소' : '완료'}`, (draft) => { draft.charadesComplete = !draft.charadesComplete; })}>{state.charadesComplete ? '✓ 워밍업 완료' : '○ 완료 여부 체크'}</button></section><section className="panel simple-status"><p className="section-kicker">AVALON · 종합점수 미반영</p><h3>아발론 진행 기록</h3><div className="segmented">{(['예정','진행 중','종료'] as const).map((status) => <button key={status} className={state.avalonStatus === status ? 'active' : ''} onClick={() => commit(`아발론 상태: ${status}`, (draft) => { draft.avalonStatus = status; })}>{status}</button>)}</div>{(['A','B'] as const).map((group) => <label className="select-row" key={group}><span>{group}조 승리 진영</span><select value={group === 'A' ? state.avalonA : state.avalonB} onChange={(event) => commit(`아발론 ${group}조 승리 진영 기록`, (draft) => { if (group === 'A') draft.avalonA = event.target.value as EventState['avalonA']; else draft.avalonB = event.target.value as EventState['avalonB']; })}><option>미정</option><option>선 진영</option><option>악 진영</option></select></label>)}</section><section className="panel display-control"><p className="section-kicker">PROJECTOR CONTROL</p><h3>전광판 표시</h3><div className="segmented">{([['overall','종합순위'],['current','현재 게임'],['results','결과 발표']] as const).map(([value,label]) => <button key={value} className={state.displayView === value ? 'active' : ''} onClick={() => commit(`전광판을 ${label}(으)로 전환`, (draft) => { draft.displayView = value; })}>{label}</button>)}</div><button className={state.scoresVisible ? 'visibility-toggle active' : 'visibility-toggle'} onClick={() => commit(`점수 공개 ${state.scoresVisible ? 'OFF' : 'ON'}`, (draft) => { draft.scoresVisible = !draft.scoresVisible; })}><span>{state.scoresVisible ? '👁 점수 공개 중' : '◌ 점수 비공개'}</span><i>{state.scoresVisible ? 'ON' : 'OFF'}</i></button></section></div></section>}

    {tab === 'results' && <section className="admin-content split-content"><div className="panel reveal-controller"><p className="section-kicker">RESULT REVEAL</p><h2>순위를 한 팀씩 공개합니다</h2><div className="reveal-preview"><span>현재 공개 단계</span><strong>{state.resultReveal} <small>/ {state.teams.length}</small></strong><div className="reveal-dots">{state.teams.map((team, index) => <i key={team.id} className={index < state.resultReveal ? 'active' : ''} />)}</div></div><div className="reveal-actions"><button className="secondary-button" onClick={() => commit('결과 발표 초기화', (draft) => { draft.resultReveal = 0; draft.lionRevealed = false; draft.displayView = 'results'; })}>처음부터</button><button className="primary-button" disabled={state.resultReveal >= state.teams.length} onClick={() => commit(`${state.teams.length - state.resultReveal}위 결과 공개`, (draft) => { draft.displayView = 'results'; draft.scoresVisible = true; draft.resultReveal = Math.min(draft.teams.length, draft.resultReveal + 1); })}>{state.resultReveal === 0 ? '결과 발표 시작' : state.resultReveal < state.teams.length ? `${state.teams.length - state.resultReveal}위 공개` : '전체 공개 완료'} →</button></div><a className="wide-link" href="/results" target="_blank">결과 발표 화면 열기 ↗</a></div><div className="side-stack"><section className="panel lion-panel"><div className="lion-icon">♛</div><p className="section-kicker">SPECIAL AWARD</p><h2>사자왕상 선정</h2><p>가능하면 종합 1등과 다른 팀의 장점을 발견하여 선정해 주세요.</p><div className="lion-team-grid">{state.teams.map((team) => <button key={team.id} className={state.lionAwardId === team.id ? 'selected' : ''} style={{ '--team': team.color } as React.CSSProperties} onClick={() => commit(`사자왕상: ${team.name}`, (draft) => { draft.lionAwardId = team.id; draft.lionRevealed = false; })}><i />{team.name}</button>)}</div><button className="award-reveal" disabled={!state.lionAwardId} onClick={() => commit('사자왕상 공개', (draft) => { draft.lionRevealed = true; draft.displayView = 'results'; })}>사자왕상 공개 ★</button></section><section className="panel result-summary"><p className="section-kicker">CURRENT RANKING</p>{rankTeams(state.teams).map(({ team, rank }, _index, ranked) => <div key={team.id}><b>{formatRank(rank, ranked)}</b><TeamBadge team={team} compact /><strong>{totalScore(team)}점</strong></div>)}</section></div></section>}

    {tab === 'logs' && <section className="admin-content split-content"><div className="panel"><div className="content-heading"><div><p className="section-kicker">CHANGE HISTORY</p><h2>변경 기록</h2></div><button className="undo-button" disabled={!canUndo} onClick={undo}>↶ 최근 변경 취소</button></div>{state.logs.length === 0 ? <div className="empty-state"><b>아직 변경 기록이 없습니다.</b><span>점수를 입력하면 시간과 내용이 여기에 기록됩니다.</span></div> : <ol className="log-list">{state.logs.map((log) => <li key={log.id}><time>{new Date(log.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><i /><span>{log.text}</span></li>)}</ol>}</div><div className="side-stack"><section className="panel"><p className="section-kicker">EXPORT</p><h3>행사 결과 내보내기</h3><p className="panel-copy">점수와 순위는 행사 종료 후 파일로 보관할 수 있습니다.</p><div className="export-actions"><button onClick={() => download('csv')}>↓ CSV 다운로드</button><button onClick={() => download('json')}>↓ JSON 백업</button></div></section></div></section>}

    {tab === 'settings' && <section className="admin-content split-content"><div className="panel settings-panel"><p className="section-kicker">BASIC SETTINGS</p><h2>행사 및 팀 설정</h2><label><span>행사명</span><input value={state.eventName} onChange={(event) => commit('행사명 변경', (draft) => { draft.eventName = event.target.value; })} /></label><label><span>행사 날짜</span><input type="date" value={state.eventDate} onChange={(event) => commit('행사 날짜 변경', (draft) => { draft.eventDate = event.target.value; })} /></label><label><span>관리자 PIN</span><input inputMode="numeric" value={state.adminPin} onChange={(event) => commit('관리자 PIN 변경', (draft) => { draft.adminPin = event.target.value; })} /></label><label><span>참가팀 수</span><select value={state.teams.length} onChange={(event) => commit(`참가팀 수를 ${event.target.value}팀으로 변경`, (draft) => { const count = Number(event.target.value); if (count > draft.teams.length) draft.teams.push(...Array.from({ length: count - draft.teams.length }, (_, i) => makeTeam(draft.teams.length + i))); else draft.teams = draft.teams.slice(0, count); })}>{Array.from({ length: 6 }, (_, i) => i + 3).map((count) => <option key={count} value={count}>{count}팀</option>)}</select></label><div className="team-settings">{state.teams.map((team) => <div key={team.id}><input type="color" aria-label={`${team.name} 색상`} value={team.color} onChange={(event) => commit(`${team.name} 색상 변경`, (draft) => { const target = draft.teams.find((item) => item.id === team.id); if (target) target.color = event.target.value; })} /><input aria-label={`${team.name} 이름`} value={team.name} onChange={(event) => commit(`${team.name} 팀명 변경`, (draft) => { const target = draft.teams.find((item) => item.id === team.id); if (target) target.name = event.target.value; })} /></div>)}</div></div><div className="side-stack"><section className="panel settings-panel"><p className="section-kicker">SCORE SETTINGS</p><h3>게임별 최대점수</h3>{(['tele','pac','hunt'] as GameKey[]).map((key) => <label key={key}><span>{scoreLabel(key)}</span><input type="number" min={1} max={100} value={state.maxScores[key]} onChange={(event) => commit(`${scoreLabel(key)} 최대점수 변경`, (draft) => { draft.maxScores[key] = Math.max(1, Number(event.target.value)); })} /></label>)}<label><span>보물 개수</span><select value={state.teams[0]?.treasures.length ?? 5} onChange={(event) => commit(`보물 개수를 ${event.target.value}개로 변경`, (draft) => { const count = Number(event.target.value); draft.teams.forEach((team) => { if (count > team.treasures.length) team.treasures.push(...Array.from({ length: count - team.treasures.length }, () => ({ found:false,answer:false,mission:false,hint:false }))); else team.treasures = team.treasures.slice(0, count); }); })}>{Array.from({ length: 8 }, (_, i) => i + 1).map((count) => <option key={count}>{count}</option>)}</select></label></section><section className="panel danger-panel"><p className="section-kicker">DANGER ZONE</p><h3>전체 점수 초기화</h3><p>팀명과 행사 설정은 유지하고 모든 게임 기록만 0점으로 되돌립니다.</p><button onClick={() => setResetStep(1)}>전체 점수 초기화</button></section></div></section>}

    {resetStep > 0 && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="confirm-modal"><div className="warning-icon">!</div><p className="section-kicker">{resetStep === 1 ? '첫 번째 확인' : '마지막 확인'}</p><h2>{resetStep === 1 ? '모든 점수를 초기화할까요?' : '정말 모든 점수를 초기화하시겠습니까?'}</h2><p>{resetStep === 1 ? '팀명과 행사 설정은 그대로 유지됩니다.' : '이 작업은 변경 기록에 남으며, 직후 Undo로 한 번 복구할 수 있습니다.'}</p><div><button className="secondary-button" onClick={() => setResetStep(0)}>취소</button>{resetStep === 1 ? <button className="danger-button" onClick={() => setResetStep(2)}>계속</button> : <button className="danger-button" onClick={() => { commit('전체 점수 초기화', (draft) => { draft.teams = draft.teams.map((team, index) => ({ ...makeTeam(index, team.treasures.length), id: team.id, name: team.name, color: team.color })); draft.resultReveal = 0; draft.lionRevealed = false; }); setResetStep(0); }}>초기화 실행</button>}</div></div></div>}
  </main>;
}

function DisplayApp({ state, forceResults = false }: { state: EventState; forceResults?: boolean }) {
  const view = forceResults ? 'results' : state.displayView;
  const ranked = rankTeams(state.teams);
  const maxTotal = state.maxScores.tele + state.maxScores.pac + state.maxScores.hunt;
  const program = PROGRAMS[state.programIndex];
  const currentGame = program.game;
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const handler = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', handler); return () => document.removeEventListener('fullscreenchange', handler); }, []);
  const requestFullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();

  if (!state.scoresVisible && view !== 'results') return <main className="display-shell hidden-scores"><header className="display-header"><div><p>{state.eventDate.replaceAll('-', '.')}</p><h1>{state.eventName}</h1></div><button onClick={requestFullscreen}>{fullscreen ? '전체화면 종료' : '전체화면'} ⛶</button></header><section><span className="pulse-orb">●</span><p className="section-kicker">SCORING IN PROGRESS</p><h2>현재 점수 집계 중!</h2><p>{program.name} · 열심히 기록하고 있어요</p></section></main>;

  if (view === 'results') {
    const revealed = ranked.slice(Math.max(0, ranked.length - state.resultReveal));
    const winner = state.resultReveal >= ranked.length ? ranked[0]?.team : null;
    const lion = state.teams.find((team) => team.id === state.lionAwardId);
    return <main className={winner ? 'display-shell result-display winner-revealed' : 'display-shell result-display'}><header className="display-header"><div><p>{state.eventDate.replaceAll('-', '.')}</p><h1>{state.eventName}</h1></div><button onClick={requestFullscreen}>{fullscreen ? '전체화면 종료' : '전체화면'} ⛶</button></header>{winner && <div className="confetti" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} />)}</div>}<section className="result-stage"><p className="section-kicker">FINAL RESULTS</p><h2>{state.resultReveal === 0 ? '잠시 후, 결과를 공개합니다' : winner ? '게임 종합 1등' : '최종 순위 발표'}</h2>{state.resultReveal === 0 ? <div className="result-wait">?</div> : <div className="revealed-list">{revealed.map(({team,rank}) => <article key={team.id} className={rank === 1 ? 'champion' : ''} style={{'--team':team.color} as React.CSSProperties}><span className="rank-medal">{formatRank(rank, ranked, true)}</span><TeamBadge team={team} /><strong>{totalScore(team)} <small>/ {maxTotal}</small></strong></article>)}</div>}{state.lionRevealed && lion && <div className="lion-reveal"><span>♛</span><div><p>사자왕상</p><h3>{lion.name}</h3></div><small>배려 · 협동 · 응원 · 참여 · 질서</small></div>}</section></main>;
  }

  if (view === 'current') {
    const currentTeams = currentGame ? (currentGame === 'pac' ? rankPacman(state.teams) : [...state.teams].sort((a,b) => gameScore(b,currentGame)-gameScore(a,currentGame))) : state.teams;
    return <main className="display-shell"><header className="display-header"><div><p>{state.eventDate.replaceAll('-', '.')}</p><h1>{state.eventName}</h1></div><div className="display-now"><i />{program.name} 진행 중</div><button onClick={requestFullscreen}>{fullscreen ? '전체화면 종료' : '전체화면'} ⛶</button></header><section className="display-content"><div className="display-title"><div><p className="section-kicker">NOW PLAYING · {state.programIndex + 1} / {PROGRAMS.length}</p><h2>{program.name}</h2></div><span>{program.meta}</span></div>{currentGame ? <div className="game-progress-list">{currentTeams.map((team,index) => <article key={team.id} style={{'--team':team.color} as React.CSSProperties}><span className="place">{index + 1}</span><TeamBadge team={team} /><div className="display-bar"><i style={{width:`${gameScore(team,currentGame) / gameMax(state,currentGame) * 100}%`}} /></div>{isGameStarted(team,currentGame) ? <strong>{gameScore(team,currentGame)}<small> / {gameMax(state,currentGame)}</small></strong> : <em>아직 진행 전</em>}</article>)}</div> : <div className="no-score-game"><span>{state.programIndex === 0 ? '🙌' : state.programIndex === 4 ? '🛡️' : '→'}</span><h3>{program.name}</h3><p>{program.meta}</p>{state.programIndex === 0 && <strong>{state.charadesComplete ? '✓ 워밍업 완료' : '점수 없음 · 즐겁게 몸을 풀어요!'}</strong>}{state.programIndex === 4 && <div><b>진행 상태: {state.avalonStatus}</b><b>A조 {state.avalonA} · B조 {state.avalonB}</b></div>}</div>}</section></main>;
  }

  return <main className="display-shell"><header className="display-header"><div><p>{state.eventDate.replaceAll('-', '.')}</p><h1>{state.eventName}</h1></div><div className="display-now"><i />{program.name} 진행 중</div><button onClick={requestFullscreen}>{fullscreen ? '전체화면 종료' : '전체화면'} ⛶</button></header><section className="display-content"><div className="display-title"><div><p className="section-kicker">LIVE LEADERBOARD</p><h2>현재 종합 순위</h2></div><span>70점 만점 · 실시간 반영</span></div><div className="leaderboard">{ranked.map(({team,rank}) => <article key={team.id} className={rank <= 3 && ranked.filter((entry) => entry.rank === rank).length === 1 ? `podium rank-${rank}` : ''} style={{'--team':team.color} as React.CSSProperties}><span className="rank-medal">{formatRank(rank, ranked, true)}</span><TeamBadge team={team} /><div className="display-bar"><i style={{width:`${Math.min(100,totalScore(team)/maxTotal*100)}%`}} /></div><strong>{totalScore(team)}<small> / {maxTotal}</small></strong></article>)}</div></section></main>;
}

export function ScoreApp({ mode }: { mode: 'admin' | 'display' | 'results' }) {
  const store = useEventStore();
  if (!store.ready) return <main className="loading-screen"><div className="loading-mark">GS</div><p>행사 데이터를 불러오는 중…</p></main>;
  if (mode === 'admin') return <PinGate state={store.state}><AdminApp store={store} /></PinGate>;
  return <DisplayApp state={store.state} forceResults={mode === 'results'} />;
}
