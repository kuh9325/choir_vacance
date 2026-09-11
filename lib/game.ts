export type GameKey = 'tele' | 'pac' | 'hunt';
export type ActiveMode = 'score' | 'charades' | 'telestration';

export type Treasure = {
  found: boolean;
  answer: boolean;
  mission: boolean;
  hint: boolean;
};

export type Team = {
  id: string;
  name: string;
  color: string;
  teleRounds: boolean[];
  teleManual: number | null;
  pacFood: number;
  pacGold: boolean;
  pacCaught: number;
  treasures: Treasure[];
  finishSeconds: number | null;
  timerStartedAt: number | null;
};

export type ChangeLog = {
  id: string;
  at: number;
  text: string;
};

export type EventState = {
  eventName: string;
  eventDate: string;
  adminPin: string;
  teams: Team[];
  programIndex: number;
  programStartedAt: number | null;
  activeMode: ActiveMode;
  scoresVisible: boolean;
  displayView: 'overall' | 'current' | 'results';
  resultReveal: number;
  lionAwardId: string | null;
  lionRevealed: boolean;
  charadesComplete: boolean;
  avalonStatus: '예정' | '진행 중' | '종료';
  avalonA: '미정' | '선 진영' | '악 진영';
  avalonB: '미정' | '선 진영' | '악 진영';
  soundEnabled: boolean;
  maxScores: { tele: number; pac: number; hunt: number };
  logs: ChangeLog[];
  revision: number;
  updatedAt: number;
};

export const PROGRAMS = [
  { time: '13:00', name: '몸으로 말해요', meta: '워밍업 · 10분', game: null },
  { time: '13:10', name: '텔레스트레이션', meta: '20점 · 15분', game: 'tele' as GameKey },
  { time: '13:25', name: '바닥팩맨', meta: '20점 · 15분', game: 'pac' as GameKey },
  { time: '13:40', name: '이동', meta: '정리 및 이동 · 5분', game: null },
  { time: '13:45', name: '아발론', meta: '점수 없음 · 40분', game: null },
  { time: '14:25', name: '팀전 보물찾기', meta: '30점 · 20분', game: 'hunt' as GameKey },
  { time: '14:45', name: '결과 발표 및 시상', meta: '최종 결과', game: null },
] as const;

const COLORS = ['#ef5350', '#4f7cff', '#20a66a', '#f0b429', '#8b5cf6', '#ed6bcb', '#0ea5b7', '#f97316'];

export function makeTeam(index: number, treasureCount = 5): Team {
  return {
    id: `team-${index + 1}`,
    name: `${index + 1}팀`,
    color: COLORS[index % COLORS.length],
    teleRounds: [false, false, false, false],
    teleManual: null,
    pacFood: 0,
    pacGold: false,
    pacCaught: 0,
    treasures: Array.from({ length: treasureCount }, () => ({ found: false, answer: false, mission: false, hint: false })),
    finishSeconds: null,
    timerStartedAt: null,
  };
}

export const DEFAULT_STATE: EventState = {
  eventName: '2026 가을 실내 게임데이',
  eventDate: '2026-09-12',
  adminPin: '0912',
  teams: Array.from({ length: 5 }, (_, index) => makeTeam(index)),
  programIndex: 0,
  programStartedAt: null,
  activeMode: 'score',
  scoresVisible: true,
  displayView: 'overall',
  resultReveal: 0,
  lionAwardId: null,
  lionRevealed: false,
  charadesComplete: false,
  avalonStatus: '예정',
  avalonA: '미정',
  avalonB: '미정',
  soundEnabled: false,
  maxScores: { tele: 20, pac: 20, hunt: 30 },
  logs: [],
  revision: 0,
  updatedAt: 0,
};

export function normalizeState(raw: Partial<EventState> | null | undefined): EventState {
  if (!raw) return structuredClone(DEFAULT_STATE);
  const base = structuredClone(DEFAULT_STATE);
  const activeMode: ActiveMode = raw.activeMode === 'charades' || raw.activeMode === 'telestration' || raw.activeMode === 'score'
    ? raw.activeMode
    : 'score';
  return {
    ...base,
    ...raw,
    activeMode,
    maxScores: { ...base.maxScores, ...(raw.maxScores ?? {}) },
    teams: (raw.teams?.length ? raw.teams : base.teams).map((team, index) => ({
      ...makeTeam(index),
      ...team,
      teleRounds: [...(team.teleRounds ?? [false, false, false, false])].slice(0, 4),
      treasures: team.treasures?.length ? team.treasures : makeTeam(index).treasures,
    })),
    logs: raw.logs ?? [],
  };
}

export function teleScore(team: Team) {
  return team.teleManual ?? team.teleRounds.filter(Boolean).length * 5;
}

export function pacScore(team: Team) {
  return Math.min(20, team.pacFood + (team.pacGold ? 5 : 0));
}

export function treasureItemScore(item: Treasure) {
  const earned = (item.found ? 1 : 0) + (item.answer ? 3 : 0) + (item.mission ? 2 : 0);
  return Math.max(0, earned - (item.hint ? 1 : 0));
}

export function huntScore(team: Team) {
  return team.treasures.reduce((sum, item) => sum + treasureItemScore(item), 0);
}

export function totalScore(team: Team) {
  return teleScore(team) + pacScore(team) + huntScore(team);
}

function overallTieKey(team: Team) {
  return [totalScore(team), huntScore(team), teleScore(team), team.finishSeconds ?? Number.POSITIVE_INFINITY];
}

export function rankTeams(teams: Team[]) {
  const sorted = [...teams].sort((a, b) =>
    totalScore(b) - totalScore(a) ||
    huntScore(b) - huntScore(a) ||
    teleScore(b) - teleScore(a) ||
    (a.finishSeconds ?? Number.POSITIVE_INFINITY) - (b.finishSeconds ?? Number.POSITIVE_INFINITY),
  );
  const ranked: Array<{ team: Team; rank: number }> = [];
  sorted.forEach((team, index) => {
    const previous = ranked[index - 1];
    const tied = previous && overallTieKey(previous.team).every((value, keyIndex) => value === overallTieKey(team)[keyIndex]);
    ranked.push({ team, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}

export function rankPacman(teams: Team[]) {
  return [...teams].sort((a, b) => pacScore(b) - pacScore(a) || a.pacCaught - b.pacCaught || Number(b.pacGold) - Number(a.pacGold));
}

export function formatTime(seconds: number | null) {
  if (seconds == null) return '미기록';
  return `${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, '0')}초`;
}

export function isGameStarted(team: Team, game: GameKey) {
  if (game === 'tele') return team.teleManual !== null || team.teleRounds.some(Boolean);
  if (game === 'pac') return team.pacFood > 0 || team.pacGold || team.pacCaught > 0;
  return team.treasures.some((item) => item.found || item.answer || item.mission || item.hint) || team.finishSeconds !== null;
}

export function gameScore(team: Team, game: GameKey) {
  return game === 'tele' ? teleScore(team) : game === 'pac' ? pacScore(team) : huntScore(team);
}

export function gameMax(state: EventState, game: GameKey) {
  return state.maxScores[game];
}
