export type TelestrationStage = 'setup' | 'ready' | 'chain' | 'judge' | 'finished';
export type TelestrationTimerStatus = 'idle' | 'running' | 'paused' | 'expired';
export type TelestrationStepKind = 'draw' | 'guess';

export type TelestrationState = {
  currentRound: number;
  stage: TelestrationStage;
  chainStep: number;
  timerStatus: TelestrationTimerStatus;
  stageEndsAt: number | null;
  pausedRemainingSeconds: number | null;
  sessionStartedAt: number | null;
  sessionSeconds: number;
  revision: number;
  updatedAt: number;
};

export type TelestrationPrompt = {
  text: string;
  accepted: string[];
};

export type TelestrationPlan = {
  rounds: 4;
  teamCount: number;
  maxMembers: number;
  chainSteps: number;
  drawSeconds: number;
  guessSeconds: number;
  timedSeconds: number;
  reserveSeconds: number;
};

export const TELESTRATION_PROMPTS: TelestrationPrompt[][] = [
  [
    { text: '눈사람', accepted: ['눈사람'] },
    { text: '보물상자', accepted: ['보물상자', '보물 상자'] },
    { text: '생일 케이크', accepted: ['생일 케이크', '생일케이크', '생일 축하 케이크'] },
    { text: '모래성', accepted: ['모래성', '모래 성'] },
    { text: '풍선다발', accepted: ['풍선다발', '풍선 다발', '풍선 묶음'] },
    { text: '로봇', accepted: ['로봇'] },
    { text: '화산', accepted: ['화산', '폭발하는 화산'] },
    { text: '우주선', accepted: ['우주선'] },
  ],
  [
    { text: '뒤집힌 우산', accepted: ['뒤집힌 우산', '뒤집어진 우산', '우산이 뒤집힘'] },
    { text: '녹아내리는 아이스크림', accepted: ['녹아내리는 아이스크림', '녹는 아이스크림', '아이스크림이 녹음'] },
    { text: '깨진 안경', accepted: ['깨진 안경', '부러진 안경'] },
    { text: '넘어진 화분', accepted: ['넘어진 화분', '쓰러진 화분', '엎어진 화분'] },
    { text: '터진 풍선', accepted: ['터진 풍선', '풍선이 터짐'] },
    { text: '날아가는 모자', accepted: ['날아가는 모자', '바람에 날아간 모자'] },
    { text: '물에 빠진 휴대폰', accepted: ['물에 빠진 휴대폰', '물에 빠진 핸드폰'] },
    { text: '불타는 토스트', accepted: ['불타는 토스트', '탄 토스트', '불붙은 토스트'] },
  ],
  [
    { text: '피아노 치는 문어', accepted: ['피아노 치는 문어', '피아노를 치는 문어', '피아노 연주하는 문어'] },
    { text: '책 읽는 로봇', accepted: ['책 읽는 로봇', '책을 읽는 로봇'] },
    { text: '요리하는 공룡', accepted: ['요리하는 공룡', '요리 중인 공룡'] },
    { text: '기타 치는 원숭이', accepted: ['기타 치는 원숭이', '기타를 치는 원숭이', '기타 연주하는 원숭이'] },
    { text: '스케이트 타는 펭귄', accepted: ['스케이트 타는 펭귄', '스케이트를 타는 펭귄'] },
    { text: '샤워하는 코끼리', accepted: ['샤워하는 코끼리', '씻는 코끼리'] },
    { text: '수영하는 로봇', accepted: ['수영하는 로봇'] },
    { text: '케이크 먹는 토끼', accepted: ['케이크 먹는 토끼', '케이크를 먹는 토끼'] },
  ],
  [
    { text: '냉장고 속 펭귄', accepted: ['냉장고 속 펭귄', '냉장고 안 펭귄', '냉장고에 있는 펭귄'] },
    { text: '우산 쓰는 해바라기', accepted: ['우산 쓰는 해바라기', '우산을 쓴 해바라기'] },
    { text: '풍선에 매달린 강아지', accepted: ['풍선에 매달린 강아지', '풍선에 매달려 있는 강아지', '풍선을 타는 강아지'] },
    { text: '달에서 축구하는 우주인', accepted: ['달에서 축구하는 우주인', '달에서 축구하는 우주비행사'] },
    { text: '구름 위에서 자는 사람', accepted: ['구름 위에서 자는 사람', '구름에서 자는 사람'] },
    { text: '선글라스 쓴 눈사람', accepted: ['선글라스 쓴 눈사람', '선글라스를 쓴 눈사람'] },
    { text: '우주선 타는 고양이', accepted: ['우주선 타는 고양이', '우주선을 타는 고양이'] },
    { text: '구름을 먹는 기린', accepted: ['구름을 먹는 기린', '구름 먹는 기린'] },
  ],
];

export const TELESTRATION_STAGE_META: Record<TelestrationStage, { title: string; instruction: string; timed: boolean }> = {
  setup: { title: '시작 전', instruction: '팀 구성과 자동 시간 배정을 확인해 주세요.', timed: false },
  ready: { title: '제시어 확인', instruction: '이번 라운드의 첫 그림 담당만 제시어를 확인하세요.', timed: false },
  chain: { title: '전달 진행', instruction: '전광판에 표시된 담당자가 그림 또는 추측을 진행합니다.', timed: true },
  judge: { title: '정답 확인', instruction: '처음 제시어와 최종 답을 비교합니다.', timed: false },
  finished: { title: '게임 종료', instruction: '4개 채점 라운드가 모두 끝났습니다.', timed: false },
};

export const DEFAULT_TELESTRATION_STATE: TelestrationState = {
  currentRound: 0,
  stage: 'setup',
  chainStep: 0,
  timerStatus: 'idle',
  stageEndsAt: null,
  pausedRemainingSeconds: null,
  sessionStartedAt: null,
  sessionSeconds: 15 * 60,
  revision: 0,
  updatedAt: 0,
};

function clampInt(value: number, min: number, max: number) {
  const safe = Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(max, safe));
}

export function normalizeTelestrationState(raw: Partial<TelestrationState> | null | undefined): TelestrationState {
  const base = structuredClone(DEFAULT_TELESTRATION_STATE);
  if (!raw) return base;

  const source = raw as Partial<TelestrationState> & { stage?: string };
  const legacyStepByStage: Record<string, number> = { draw1: 0, guess1: 1, draw2: 2, finalGuess: 3 };
  const rawStage = typeof source.stage === 'string' ? source.stage : 'setup';
  const legacyStep = legacyStepByStage[rawStage];
  const validStages: TelestrationStage[] = ['setup', 'ready', 'chain', 'judge', 'finished'];
  const validTimer: TelestrationTimerStatus[] = ['idle', 'running', 'paused', 'expired'];

  return {
    currentRound: clampInt(Number(source.currentRound ?? 0), 0, 3),
    stage: legacyStep !== undefined ? 'chain' : validStages.includes(rawStage as TelestrationStage) ? rawStage as TelestrationStage : 'setup',
    chainStep: legacyStep !== undefined ? legacyStep : clampInt(Number(source.chainStep ?? 0), 0, 15),
    timerStatus: validTimer.includes(source.timerStatus as TelestrationTimerStatus) ? source.timerStatus as TelestrationTimerStatus : base.timerStatus,
    stageEndsAt: typeof source.stageEndsAt === 'number' ? source.stageEndsAt : null,
    pausedRemainingSeconds: typeof source.pausedRemainingSeconds === 'number' ? Math.max(0, Math.round(source.pausedRemainingSeconds)) : null,
    sessionStartedAt: typeof source.sessionStartedAt === 'number' ? source.sessionStartedAt : null,
    sessionSeconds: clampInt(Number(source.sessionSeconds ?? base.sessionSeconds), 600, 1800),
    revision: Number.isFinite(source.revision) ? Number(source.revision) : 0,
    updatedAt: Number.isFinite(source.updatedAt) ? Number(source.updatedAt) : 0,
  };
}

export function promptFor(roundIndex: number, teamIndex: number) {
  const round = TELESTRATION_PROMPTS[clampInt(roundIndex, 0, 3)];
  const safeIndex = Math.max(0, Math.floor(teamIndex || 0)) % round.length;
  return round[safeIndex];
}

export function memberCountFor(teamId: string, memberCounts: Record<string, number>) {
  return clampInt(memberCounts[teamId] ?? 4, 1, 8);
}

export function memberForStep(roundIndex: number, stepIndex: number, memberCount: number) {
  const count = clampInt(memberCount, 1, 8);
  const round = clampInt(roundIndex, 0, 3);
  const step = Math.max(0, Math.floor(stepIndex || 0));
  return ((round + step) % count) + 1;
}

export function roleOrder(roundIndex: number, memberCount = 4, stepCount = 4) {
  return Array.from({ length: Math.max(1, stepCount) }, (_, step) => memberForStep(roundIndex, step, memberCount));
}

export function stepKind(stepIndex: number): TelestrationStepKind {
  return Math.max(0, Math.floor(stepIndex || 0)) % 2 === 0 ? 'draw' : 'guess';
}

export function stepTitle(stepIndex: number) {
  const kind = stepKind(stepIndex);
  const ordinal = Math.floor(Math.max(0, stepIndex) / 2) + 1;
  return kind === 'draw' ? `그림 ${ordinal}` : `추측 ${ordinal}`;
}

export function buildTelestrationPlan(teamIds: readonly string[], memberCounts: Record<string, number>, sessionSeconds = 15 * 60): TelestrationPlan {
  const safeSession = clampInt(sessionSeconds, 600, 1800);
  const teamCount = clampInt(teamIds.length || 1, 1, 8);
  const maxMembers = teamIds.length
    ? Math.max(...teamIds.map((teamId) => memberCountFor(teamId, memberCounts)))
    : 4;
  const chainSteps = Math.max(2, maxMembers + (maxMembers % 2));
  const drawSteps = chainSteps / 2;
  const guessSteps = chainSteps / 2;

  // 팀이 많을수록 제시어 공개/판정에 여유를 더 확보한다.
  const overheadSeconds = Math.min(safeSession - 120, 180 + teamCount * 16);
  const targetTimedSeconds = Math.max(120, safeSession - overheadSeconds);
  const weightedUnits = 4 * (drawSteps * 1.7 + guessSteps);
  const unit = targetTimedSeconds / weightedUnits;
  const drawSeconds = clampInt(unit * 1.7, 20, 60);
  const guessSeconds = clampInt(unit, 12, 35);
  const timedSeconds = 4 * (drawSteps * drawSeconds + guessSteps * guessSeconds);

  return {
    rounds: 4,
    teamCount,
    maxMembers,
    chainSteps,
    drawSeconds,
    guessSeconds,
    timedSeconds,
    reserveSeconds: Math.max(0, safeSession - timedSeconds),
  };
}

export function stepDuration(plan: TelestrationPlan, stepIndex: number) {
  return stepKind(stepIndex) === 'draw' ? plan.drawSeconds : plan.guessSeconds;
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
