export type CharadesCategoryKey = 'animal' | 'job' | 'food' | 'sport' | 'action' | 'transport' | 'proverb';

export type CharadesCategory = {
  id: CharadesCategoryKey;
  label: string;
  emoji: string;
  weight: number;
  words: readonly string[];
};

export type CharadesTeam = {
  id: string;
  name: string;
  color: string;
};

export type CharadesPhase = 'setup' | 'ready' | 'running' | 'paused' | 'expired' | 'finished';

export type CharadesState = {
  totalSeconds: number;
  introSeconds: number;
  outroSeconds: number;
  transitionSeconds: number;
  targetTurnSeconds: number;
  minTurnSeconds: number;
  maxTurnSeconds: number;
  memberCounts: Record<string, number>;
  categoryOverrides: Record<string, CharadesCategoryKey>;
  currentTurnIndex: number;
  phase: CharadesPhase;
  revealed: boolean;
  currentWord: string | null;
  usedWords: string[];
  turnEndsAt: number | null;
  pausedRemainingSeconds: number | null;
  sessionStartedAt: number | null;
  revision: number;
  updatedAt: number;
};

export type CharadesTurn = {
  index: number;
  teamId: string;
  teamName: string;
  teamColor: string;
  round: number;
  categoryId: CharadesCategoryKey;
  categoryLabel: string;
  categoryEmoji: string;
  durationSeconds: number;
  memberNumbers: number[];
  plannedStartSeconds: number;
  plannedEndSeconds: number;
};

export const CHARADES_CATEGORIES: readonly CharadesCategory[] = [
  {
    id: 'animal', label: '동물', emoji: '🐾', weight: 1,
    words: ['강아지','고양이','원숭이','코끼리','사자','호랑이','토끼','캥거루','펭귄','뱀','악어','거북이','개구리','닭','오리','돼지','말','소','양','고릴라','기린','얼룩말','코알라','판다','곰','여우','늑대','상어','문어','돌고래'],
  },
  {
    id: 'job', label: '직업', emoji: '🧑‍🚒', weight: 1.05,
    words: ['소방관','경찰관','의사','간호사','선생님','요리사','가수','배우','축구선수','야구선수','농부','어부','미용사','화가','사진작가','기자','과학자','우주비행사','조종사','승무원','택배기사','운전기사','빵집 사장님','경찰특공대','수의사','마술사','만화가','유튜버','발레리나','환경미화원'],
  },
  {
    id: 'food', label: '음식', emoji: '🍕', weight: 1,
    words: ['피자','치킨','햄버거','김밥','떡볶이','라면','짜장면','만두','김치','비빔밥','삼겹살','햄','소시지','계란','아이스크림','케이크','도넛','붕어빵','호떡','수박','바나나','사과','딸기','포도','오렌지','초콜릿','사탕','팝콘','감자튀김','핫도그'],
  },
  {
    id: 'sport', label: '스포츠', emoji: '⚽', weight: 1.05,
    words: ['축구','야구','농구','배구','피구','배드민턴','탁구','테니스','골프','볼링','수영','스키','스케이트','스노보드','줄넘기','달리기','씨름','태권도','유도','복싱','양궁','역도','체조','다이빙','서핑','자전거 타기','암벽등반','말타기','줄다리기','숨바꼭질'],
  },
  {
    id: 'action', label: '행동', emoji: '🏃', weight: 1,
    words: ['양치하기','세수하기','샤워하기','머리 감기','잠자기','코골기','하품하기','재채기하기','기침하기','울기','웃기','화내기','놀라기','춤추기','노래하기','박수치기','뛰기','걷기','넘어지기','수영하기','운전하기','전화하기','사진 찍기','요리하기','청소하기','빨래하기','설거지하기','선물 포장하기','문 열기','무거운 것 들기'],
  },
  {
    id: 'transport', label: '교통수단', emoji: '🚀', weight: 1.05,
    words: ['자동차','버스','택시','기차','지하철','비행기','헬리콥터','배','잠수함','자전거','오토바이','킥보드','트럭','소방차','경찰차','구급차','견인차','굴착기','불도저','트랙터','경운기','열기구','요트','카누','유람선','우주선','로켓','스케이트보드','썰매','마차'],
  },
  {
    id: 'proverb', label: '속담', emoji: '💬', weight: 1.25,
    words: ['꿩 먹고 알 먹기','티끌 모아 태산','세 살 버릇 여든까지 간다','원숭이도 나무에서 떨어진다','소 잃고 외양간 고친다','닭 쫓던 개 지붕 쳐다본다','개구리 올챙이 적 생각 못 한다','호랑이도 제 말 하면 온다','하늘의 별 따기','누워서 떡 먹기','그림의 떡','금강산도 식후경','남의 떡이 더 커 보인다','가는 말이 고와야 오는 말이 곱다','말 한마디에 천 냥 빚도 갚는다','발 없는 말이 천 리 간다','백지장도 맞들면 낫다','돌다리도 두들겨 보고 건너라','세월이 약이다','시작이 반이다','천 리 길도 한 걸음부터','공든 탑이 무너지랴','고래 싸움에 새우 등 터진다','등잔 밑이 어둡다','우물 안 개구리','쥐구멍에도 볕 들 날 있다','하룻강아지 범 무서운 줄 모른다','아니 땐 굴뚝에 연기 나랴','엎질러진 물은 다시 주워 담을 수 없다','웃는 얼굴에 침 못 뱉는다'],
  },
] as const;

export const CATEGORY_ORDER: readonly CharadesCategoryKey[] = ['animal', 'food', 'action', 'job', 'sport', 'transport', 'proverb'];

export const DEFAULT_CHARADES_STATE: CharadesState = {
  totalSeconds: 600,
  introSeconds: 30,
  outroSeconds: 20,
  transitionSeconds: 8,
  targetTurnSeconds: 45,
  minTurnSeconds: 35,
  maxTurnSeconds: 60,
  memberCounts: {},
  categoryOverrides: {},
  currentTurnIndex: 0,
  phase: 'setup',
  revealed: false,
  currentWord: null,
  usedWords: [],
  turnEndsAt: null,
  pausedRemainingSeconds: null,
  sessionStartedAt: null,
  revision: 0,
  updatedAt: 0,
};

export function normalizeCharadesState(raw: Partial<CharadesState> | null | undefined): CharadesState {
  const base = structuredClone(DEFAULT_CHARADES_STATE);
  if (!raw) return base;
  const normalized: CharadesState = {
    ...base,
    ...raw,
    memberCounts: { ...base.memberCounts, ...(raw.memberCounts ?? {}) },
    categoryOverrides: { ...base.categoryOverrides, ...(raw.categoryOverrides ?? {}) },
    usedWords: Array.isArray(raw.usedWords) ? raw.usedWords.filter((value): value is string => typeof value === 'string').slice(-500) : [],
  };
  normalized.totalSeconds = clampInt(normalized.totalSeconds, 180, 1800);
  normalized.introSeconds = clampInt(normalized.introSeconds, 0, 180);
  normalized.outroSeconds = clampInt(normalized.outroSeconds, 0, 180);
  normalized.transitionSeconds = clampInt(normalized.transitionSeconds, 0, 30);
  normalized.targetTurnSeconds = clampInt(normalized.targetTurnSeconds, 15, 120);
  normalized.minTurnSeconds = clampInt(normalized.minTurnSeconds, 10, 120);
  normalized.maxTurnSeconds = clampInt(normalized.maxTurnSeconds, normalized.minTurnSeconds, 180);
  normalized.currentTurnIndex = Math.max(0, Math.floor(normalized.currentTurnIndex || 0));
  return normalized;
}

export function categoryById(id: CharadesCategoryKey) {
  return CHARADES_CATEGORIES.find((category) => category.id === id) ?? CHARADES_CATEGORIES[0];
}

function clampInt(value: number, min: number, max: number) {
  const safe = Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(max, safe));
}

function chooseRounds(teamCount: number, maxMembers: number, state: CharadesState) {
  if (teamCount <= 0) return 1;
  const candidates: Array<{ rounds: number; average: number; valid: boolean; distance: number }> = [];
  for (let rounds = 1; rounds <= Math.max(1, maxMembers); rounds += 1) {
    const turns = teamCount * rounds;
    const active = state.totalSeconds - state.introSeconds - state.outroSeconds - state.transitionSeconds * Math.max(0, turns - 1);
    const average = active / turns;
    const valid = average >= state.minTurnSeconds && average <= state.maxTurnSeconds;
    candidates.push({ rounds, average, valid, distance: Math.abs(average - state.targetTurnSeconds) });
  }
  const valid = candidates.filter((candidate) => candidate.valid).sort((a, b) => a.distance - b.distance || b.rounds - a.rounds);
  if (valid.length) return valid[0].rounds;
  return candidates.sort((a, b) => a.distance - b.distance || b.rounds - a.rounds)[0]?.rounds ?? 1;
}

function splitMembers(count: number, rounds: number, roundIndex: number) {
  const safeCount = Math.max(1, Math.floor(count || 1));
  const start = Math.floor((roundIndex * safeCount) / rounds) + 1;
  const end = Math.max(start, Math.floor(((roundIndex + 1) * safeCount) / rounds));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index).filter((value) => value <= safeCount);
}

function allocateDurations(categoryIds: CharadesCategoryKey[], activeSeconds: number, min: number, max: number) {
  if (!categoryIds.length) return [];
  const weights = categoryIds.map((id) => categoryById(id).weight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const feasibleBounds = activeSeconds >= min * categoryIds.length && activeSeconds <= max * categoryIds.length;
  const effectiveMin = feasibleBounds ? min : 1;
  const effectiveMax = feasibleBounds ? max : Math.max(1, activeSeconds);
  const durations = weights.map((weight) => clampInt((activeSeconds * weight) / totalWeight, effectiveMin, effectiveMax));
  let difference = Math.max(0, activeSeconds) - durations.reduce((sum, value) => sum + value, 0);
  let guard = 0;
  while (difference !== 0 && guard < 10000) {
    const direction = difference > 0 ? 1 : -1;
    let changed = false;
    for (let index = 0; index < durations.length && difference !== 0; index += 1) {
      const next = durations[index] + direction;
      if (next < effectiveMin || next > effectiveMax) continue;
      durations[index] = next;
      difference -= direction;
      changed = true;
    }
    if (!changed) break;
    guard += 1;
  }
  return durations;
}

export function buildCharadesSchedule(teams: CharadesTeam[], rawState: CharadesState): CharadesTurn[] {
  const state = normalizeCharadesState(rawState);
  if (!teams.length) return [];
  const maxMembers = Math.max(...teams.map((team) => Math.max(1, state.memberCounts[team.id] ?? 4)));
  const rounds = chooseRounds(teams.length, maxMembers, state);
  const draft = Array.from({ length: rounds * teams.length }, (_, index) => {
    const round = Math.floor(index / teams.length);
    const team = teams[index % teams.length];
    const override = state.categoryOverrides[String(index)];
    const categoryId = override ?? CATEGORY_ORDER[index % CATEGORY_ORDER.length];
    return {
      index,
      team,
      round,
      categoryId,
      memberNumbers: splitMembers(state.memberCounts[team.id] ?? 4, rounds, round),
    };
  });
  const activeSeconds = Math.max(0, state.totalSeconds - state.introSeconds - state.outroSeconds - state.transitionSeconds * Math.max(0, draft.length - 1));
  const durations = allocateDurations(draft.map((turn) => turn.categoryId), activeSeconds, state.minTurnSeconds, state.maxTurnSeconds);
  let cursor = state.introSeconds;
  return draft.map((turn, index) => {
    const category = categoryById(turn.categoryId);
    const durationSeconds = durations[index] ?? state.targetTurnSeconds;
    const plannedStartSeconds = cursor;
    const plannedEndSeconds = plannedStartSeconds + durationSeconds;
    cursor = plannedEndSeconds + (index < draft.length - 1 ? state.transitionSeconds : 0);
    return {
      index,
      teamId: turn.team.id,
      teamName: turn.team.name,
      teamColor: turn.team.color,
      round: turn.round + 1,
      categoryId: turn.categoryId,
      categoryLabel: category.label,
      categoryEmoji: category.emoji,
      durationSeconds,
      memberNumbers: turn.memberNumbers,
      plannedStartSeconds,
      plannedEndSeconds,
    };
  });
}

export function pickCharadesWord(categoryId: CharadesCategoryKey, usedWords: readonly string[], random = Math.random) {
  const category = categoryById(categoryId);
  const available = category.words.filter((word) => !usedWords.includes(`${categoryId}:${word}`));
  const pool = available.length ? available : category.words;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * pool.length));
  const word = pool[index];
  return { word, key: `${categoryId}:${word}` };
}

export function formatShortTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function plannedSlotLabel(turn: CharadesTurn) {
  return `${formatShortTime(turn.plannedStartSeconds)}–${formatShortTime(turn.plannedEndSeconds)}`;
}
