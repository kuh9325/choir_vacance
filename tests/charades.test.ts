import assert from 'node:assert/strict';
import { CHARADES_CATEGORIES, DEFAULT_CHARADES_STATE, buildCharadesSchedule, pickCharadesWord } from '../lib/charades';

const teams = Array.from({ length: 5 }, (_, index) => ({ id: `team-${index + 1}`, name: `${index + 1}팀`, color: '#000' }));

assert.equal(CHARADES_CATEGORIES.length, 7);
assert.equal(CHARADES_CATEGORIES.reduce((sum, category) => sum + category.words.length, 0), 210);

const schedule = buildCharadesSchedule(teams, DEFAULT_CHARADES_STATE);
assert.equal(schedule.length, 10);
assert.equal(Math.max(...schedule.map((turn) => turn.round)), 2);
assert.deepEqual(schedule[0].memberNumbers, [1, 2]);
assert.deepEqual(schedule[5].memberNumbers, [3, 4]);
assert.equal(schedule.at(-1)!.plannedEndSeconds + DEFAULT_CHARADES_STATE.outroSeconds, 600);

const animalTurn = schedule.find((turn) => turn.categoryId === 'animal')!;
const proverbTurn = schedule.find((turn) => turn.categoryId === 'proverb')!;
assert.ok(proverbTurn.durationSeconds > animalTurn.durationSeconds);

const first = pickCharadesWord('animal', [], () => 0);
const second = pickCharadesWord('animal', [first.key], () => 0);
assert.notEqual(first.word, second.word);

console.log('✓ 몸으로 말해요 7개 주제 / 210개 제시어');
console.log('✓ 5팀 × 4명 × 10분은 팀당 2회, 총 10턴으로 자동 배정');
console.log('✓ 1·2번 / 3·4번으로 담당 인원이 균등 분배');
console.log('✓ 속담에 더 긴 시간이 자동 배정');
console.log('✓ 사용 제시어는 가능한 한 중복 없이 선택');
