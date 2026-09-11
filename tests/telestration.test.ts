import assert from 'node:assert/strict';
import { DEFAULT_TELESTRATION_STATE, TELESTRATION_PROMPTS, nextStage, normalizeTelestrationState, promptFor, roleOrder, stageDuration, stageRoleNumber } from '../lib/telestration';

const tests: Array<[string, () => void]> = [];
const test = (name: string, run: () => void) => tests.push([name, run]);

test('텔레스트레이션은 4라운드 × 5팀 = 20개 제시어다', () => {
  assert.equal(TELESTRATION_PROMPTS.length, 4);
  assert.ok(TELESTRATION_PROMPTS.every((round) => round.length === 5));
  assert.equal(TELESTRATION_PROMPTS.flat().length, 20);
});

test('확정 제시어 20개는 서로 중복되지 않는다', () => {
  const words = TELESTRATION_PROMPTS.flat().map((prompt) => prompt.text);
  assert.equal(new Set(words).size, 20);
});

test('기본 단계 시간은 그림 35초, 추측 20초다', () => {
  assert.equal(stageDuration(DEFAULT_TELESTRATION_STATE, 'draw1'), 35);
  assert.equal(stageDuration(DEFAULT_TELESTRATION_STATE, 'guess1'), 20);
  assert.equal(stageDuration(DEFAULT_TELESTRATION_STATE, 'draw2'), 35);
  assert.equal(stageDuration(DEFAULT_TELESTRATION_STATE, 'finalGuess'), 20);
});

test('단계 순서가 준비 → 그림 → 추측 → 그림 → 최종답 → 판정 순이다', () => {
  assert.equal(nextStage('ready'), 'draw1');
  assert.equal(nextStage('draw1'), 'guess1');
  assert.equal(nextStage('guess1'), 'draw2');
  assert.equal(nextStage('draw2'), 'finalGuess');
  assert.equal(nextStage('finalGuess'), 'judge');
});

test('4개 라운드에서 첫 그림 담당이 1·2·3·4번으로 한 번씩 회전한다', () => {
  assert.deepEqual(roleOrder(0), [1, 2, 3, 4]);
  assert.deepEqual(roleOrder(1), [2, 3, 4, 1]);
  assert.deepEqual(roleOrder(2), [3, 4, 1, 2]);
  assert.deepEqual(roleOrder(3), [4, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map((round) => stageRoleNumber(round, 'draw1')), [1, 2, 3, 4]);
});

test('라운드와 팀 인덱스가 범위를 벗어나도 안전하게 제시어를 반환한다', () => {
  assert.equal(promptFor(-1, -1).text, '눈사람');
  assert.equal(promptFor(99, 99).text, '구름 위에서 자는 사람');
});

test('저장 상태를 읽을 때 라운드를 0~3 범위로 정규화한다', () => {
  assert.equal(normalizeTelestrationState({ currentRound: 99 }).currentRound, 3);
  assert.equal(normalizeTelestrationState({ currentRound: -4 }).currentRound, 0);
});

for (const [name, run] of tests) {
  run();
  console.log(`✓ ${name}`);
}
console.log(`\n${tests.length}개 텔레스트레이션 테스트 통과`);
