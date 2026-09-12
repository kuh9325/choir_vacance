import assert from 'node:assert/strict';
import {
  DEFAULT_TELESTRATION_STATE,
  TELESTRATION_PROMPTS,
  buildTelestrationPlan,
  memberForStep,
  normalizeTelestrationState,
  promptFor,
  roleOrder,
  stepDuration,
  stepKind,
} from '../lib/telestration';

const tests: Array<[string, () => void]> = [];
const test = (name: string, run: () => void) => tests.push([name, run]);

const fiveTeams = ['team-1', 'team-2', 'team-3', 'team-4', 'team-5'];
const eightTeams = Array.from({ length: 8 }, (_, index) => `team-${index + 1}`);

test('텔레스트레이션은 4라운드 × 최대 8팀 = 32개 고유 제시어를 가진다', () => {
  assert.equal(TELESTRATION_PROMPTS.length, 4);
  assert.ok(TELESTRATION_PROMPTS.every((round) => round.length === 8));
  const words = TELESTRATION_PROMPTS.flat().map((prompt) => prompt.text);
  assert.equal(words.length, 32);
  assert.equal(new Set(words).size, 32);
});

test('기본 5팀×4명×15분은 라운드당 4단계, 그림 50초, 추측 30초로 자동 배정된다', () => {
  const plan = buildTelestrationPlan(fiveTeams, Object.fromEntries(fiveTeams.map((id) => [id, 4])), 900);
  assert.equal(plan.rounds, 4);
  assert.equal(plan.teamCount, 5);
  assert.equal(plan.maxMembers, 4);
  assert.equal(plan.chainSteps, 4);
  assert.equal(plan.drawSeconds, 50);
  assert.equal(plan.guessSeconds, 30);
  assert.equal(plan.timedSeconds + plan.reserveSeconds, 900);
});

test('최대 인원이 5·6명이면 6단계, 7·8명이면 8단계로 확장된다', () => {
  assert.equal(buildTelestrationPlan(fiveTeams, { 'team-1': 5 }, 900).chainSteps, 6);
  assert.equal(buildTelestrationPlan(fiveTeams, { 'team-1': 6 }, 900).chainSteps, 6);
  assert.equal(buildTelestrationPlan(fiveTeams, { 'team-1': 7 }, 900).chainSteps, 8);
  assert.equal(buildTelestrationPlan(fiveTeams, { 'team-1': 8 }, 900).chainSteps, 8);
});

test('8팀으로 늘리면 제시어·판정 여유를 확보하기 위해 단계 시간이 자동으로 줄어든다', () => {
  const five = buildTelestrationPlan(fiveTeams, Object.fromEntries(fiveTeams.map((id) => [id, 4])), 900);
  const eight = buildTelestrationPlan(eightTeams, Object.fromEntries(eightTeams.map((id) => [id, 4])), 900);
  assert.equal(eight.teamCount, 8);
  assert.ok(eight.drawSeconds < five.drawSeconds);
  assert.ok(eight.guessSeconds < five.guessSeconds);
});

test('8명 팀은 모든 전달 단계에서 담당 번호가 팀 인원 범위 안에서 순환한다', () => {
  assert.deepEqual(roleOrder(0, 8, 8), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(roleOrder(1, 8, 8), [2, 3, 4, 5, 6, 7, 8, 1]);
});

test('3명 팀도 4단계 전달에서 안전하게 순환한다', () => {
  assert.deepEqual(roleOrder(0, 3, 4), [1, 2, 3, 1]);
  assert.equal(memberForStep(3, 3, 3), 1);
});

test('그림/추측은 번갈아 진행되고 자동 계획 시간을 사용한다', () => {
  const plan = buildTelestrationPlan(fiveTeams, {}, DEFAULT_TELESTRATION_STATE.sessionSeconds);
  assert.equal(stepKind(0), 'draw');
  assert.equal(stepKind(1), 'guess');
  assert.equal(stepDuration(plan, 0), plan.drawSeconds);
  assert.equal(stepDuration(plan, 1), plan.guessSeconds);
});

test('8번째 팀까지 각 라운드에서 제시어를 안전하게 받는다', () => {
  assert.equal(promptFor(0, 7).text, '우주선');
  assert.equal(promptFor(3, 7).text, '구름을 먹는 기린');
  assert.ok(promptFor(99, 99).text.length > 0);
});

test('구형 draw/guess 저장상태는 새 chain 단계와 step 인덱스로 자동 마이그레이션된다', () => {
  const migrated = normalizeTelestrationState({ currentRound: 2, stage: 'draw2' });
  assert.equal(migrated.currentRound, 2);
  assert.equal(migrated.stage, 'chain');
  assert.equal(migrated.chainStep, 2);
  assert.equal(normalizeTelestrationState({ currentRound: 99 }).currentRound, 3);
});

for (const [name, run] of tests) {
  run();
  console.log(`✓ ${name}`);
}
console.log(`\n${tests.length}개 텔레스트레이션 테스트 통과`);
