export type TelestrationStage = 'setup' | 'ready' | 'draw1' | 'guess1' | 'draw2' | 'finalGuess' | 'judge' | 'finished';
export type TelestrationTimerStatus = 'idle' | 'running' | 'paused' | 'expired';

export type TelestrationState = {
  currentRound: number;
  stage: TelestrationStage;
  timerStatus: TelestrationTimerStatus;
  stageEndsAt: number | null;
  pausedRemainingSeconds: number | null;
  sessionStartedAt: number | null;
  sessionSeconds: number;
  durations: {
    draw1: number;
    guess1: number;
    draw2: number;
    finalGuess: number;
  };
  revision: number;
  updatedAt: number;
};

export type TelestrationPrompt = {
  text: string;
  accepted: string[];
};

export const TELESTRATION_PROMPTS: TelestrationPrompt[][] = [
  [
    { text: '눈사람', accepted: ['눈사람'] },
    { text: '보물상자', accepted: ['보물상자', '보물 상자'] },
    { text: '생일 케이크', accepted: ['생일 케이크', '생일케이크', '케이크'] },
    { text: '모래성', accepted: ['모래성', '모래 성'] },
    { text: '풍선다발', accepted: ['풍선다발', '풍선 다발', '풍선 묶음'] },
  ],
  [
    { text: '뒤집힌 우산', accepted: ['뒤집힌 우산', '뒤집어진 우산', '우산이 뒤집힘'] },
    { text: '녹아내리는 아이스크림', accepted: ['녹아내리는 아이스크림', '녹는 아이스크림', '아이스크림이 녹음'] },
    { text: '깨진 안경', accepted: ['깨진 안경', '부러진 안경'] },
    { text: '넘어진 화분', accepted: ['넘어진 화분', '쓰러진 화분', '엎어진 화분'] },
    { text: '터진 풍선', accepted: ['터진 풍선', '풍선이 터짐'] },
  ],
  [
    { text: '피아노 치는 문어', accepted: ['피아노 치는 문어', '피아노를 치는 문어', '피아노 연주하는 문어'] },
    { text: '책 읽는 로봇', accepted: ['책 읽는 로봇', '책을 읽는 로봇'] },
    { text: '요리하는 공룡', accepted: ['요리하는 공룡', '요리 중인 공룡'] },
    { text: '기타 치는 원숭이', accepted: ['기타 치는 원숭이', '기타를 치는 원숭이', '기타 연주하는 원숭이'] },
    { text: '스케이트 타는 펭귄', accepted: ['스케이트 타는 펭귄', '스케이트를 타는 펭귄'] },
  ],
  [
    { text: '냉장고 속 펭귄', accepted: ['냉장고 속 펭귄', '냉장고 안 펭귄', '냉장고에 있는 펭귄'] },
    { text: '우산 쓰는 해바라기', accepted: ['우산 쓰는 해바라기', '우산을 쓴 해바라기'] },
    { text: '풍선에 매달린 강아지', accepted: ['풍선에 매달린 강아지', '풍선에 매달려 있는 강아지', '풍선을 타는 강아지'] },
    { text: '달에서 축구하는 우주인', accepted: ['달에서 축구하는 우주인', '달에서 축구하는 우주비행사'] },
    { text: '구름 위에서 자는 사람', accepted: ['구름 위에서 자는 사람', '구름에서 자는 사람'] },
  ],
];

export const TELESTRATION_STAGE_META: Record<TelestrationStage, { title: string; instruction: string; timed: boolean }> = {
  setup: { title: '시작 전', instruction: '진행 설정을 확인해 주세요.', timed: false },
  ready: { title: '제시어 확인', instruction: '각 팀 1번만 진행자에게 제시어를 확인하세요.', timed: false },
  draw1: { title: '첫 번째 그림', instruction: '1번: 제시어를 그림으로 표현하세요. 글자와 숫자는 금지!', timed: true },
  guess1: { title: '첫 번째 추측', instruction: '2번: 그림만 보고 단어를 적으세요.', timed: true },
  draw2: { title: '두 번째 그림', instruction: '3번: 전달받은 단어를 다시 그림으로 표현하세요.', timed: true },
  finalGuess: { title: '최종 정답', instruction: '4번: 마지막 그림만 보고 최종 답을 적으세요.', timed: true },
  judge: { title: '정답 확인', instruction: '처음 제시어와 최종 답을 비교합니다.', timed: false },
  finished: { title: '게임 종료', instruction: '4개 라운드가 모두 끝났습니다.', timed: false },
};

export const DEFAULT_TELESTRATION_STATE: TelestrationState = {
  currentRound: 0,
  stage: 'setup',
  timerStatus: 'idle',
  stageEndsAt: null,
  pausedRemainingSeconds: null,
  sessionStartedAt: null,
  sessionSeconds: 15 * 60,
  durations: { draw1: 35, guess1: 20, draw2: 35, finalGuess: 20 },
  revision: 0,
  updatedAt: 0,
};

export function normalizeTelestrationState(raw: Partial<TelestrationState> | null | undefined): TelestrationState {
  const base = structuredClone(DEFAULT_TELESTRATION_STATE);
  if (!raw) return base;
  const currentRound = Number.isFinite(raw.currentRound) ? Math.max(0, Math.min(3, Number(raw.currentRound))) : 0;
  const validStages: TelestrationStage[] = ['setup', 'ready', 'draw1', 'guess1', 'draw2', 'finalGuess', 'judge', 'finished'];
  const validTimer: TelestrationTimerStatus[] = ['idle', 'running', 'paused', 'expired'];
  return {
    ...base,
    ...raw,
    currentRound,
    stage: validStages.includes(raw.stage as TelestrationStage) ? raw.stage as TelestrationStage : base.stage,
    timerStatus: validTimer.includes(raw.timerStatus as TelestrationTimerStatus) ? raw.timerStatus as TelestrationTimerStatus : base.timerStatus,
    durations: { ...base.durations, ...(raw.durations ?? {}) },
  };
}

export function promptFor(roundIndex: number, teamIndex: number) {
  return TELESTRATION_PROMPTS[Math.max(0, Math.min(3, roundIndex))][Math.max(0, Math.min(4, teamIndex))];
}

export function stageDuration(state: TelestrationState, stage: TelestrationStage) {
  if (stage === 'draw1' || stage === 'guess1' || stage === 'draw2' || stage === 'finalGuess') return state.durations[stage];
  return 0;
}

export function nextStage(stage: TelestrationStage): TelestrationStage {
  if (stage === 'setup') return 'ready';
  if (stage === 'ready') return 'draw1';
  if (stage === 'draw1') return 'guess1';
  if (stage === 'guess1') return 'draw2';
  if (stage === 'draw2') return 'finalGuess';
  if (stage === 'finalGuess') return 'judge';
  return stage;
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
