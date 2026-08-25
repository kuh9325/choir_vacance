import assert from 'node:assert/strict';
import { huntScore, makeTeam, pacScore, rankPacman, rankTeams, teleScore, totalScore, treasureItemScore } from '../lib/game';

const tests: Array<[string, () => void]> = [];
const test = (name: string, run: () => void) => tests.push([name, run]);

test('5개 팀이 모두 0점이면 공동 1위다', () => {
  const ranked = rankTeams(Array.from({ length: 5 }, (_, index) => makeTeam(index)));
  assert.deepEqual(ranked.map((entry) => entry.rank), [1, 1, 1, 1, 1]);
  assert.ok(ranked.every(({ team }) => totalScore(team) === 0));
});

test('한 팀은 정확히 70점 만점을 기록할 수 있다', () => {
  const team = makeTeam(0);
  team.teleRounds = [true, true, true, true];
  team.pacFood = 15;
  team.pacGold = true;
  team.treasures = team.treasures.map(() => ({ found: true, answer: true, mission: true, hint: false }));
  assert.equal(teleScore(team), 20);
  assert.equal(pacScore(team), 20);
  assert.equal(huntScore(team), 30);
  assert.equal(totalScore(team), 70);
});

test('총점 동점은 보물찾기 점수가 높은 팀이 앞선다', () => {
  const a = makeTeam(0); const b = makeTeam(1);
  a.teleManual = 20; a.pacFood = 10;
  b.teleManual = 16; b.pacFood = 15; b.pacGold = true;
  a.treasures[0] = { found: true, answer: true, mission: true, hint: false };
  assert.equal(totalScore(a), totalScore(b));
  assert.equal(rankTeams([b, a])[0].team.id, a.id);
});

test('총점과 보물찾기 점수가 같으면 텔레스트레이션 점수가 높은 팀이 앞선다', () => {
  const a = makeTeam(0); const b = makeTeam(1);
  a.teleManual = 15; a.pacFood = 5;
  b.teleManual = 10; b.pacFood = 10;
  assert.equal(totalScore(a), totalScore(b));
  assert.equal(huntScore(a), huntScore(b));
  assert.equal(rankTeams([b, a])[0].team.id, a.id);
});

test('점수 항목까지 같으면 더 빠른 보물찾기 완주시간이 앞선다', () => {
  const a = makeTeam(0); const b = makeTeam(1);
  a.finishSeconds = 700; b.finishSeconds = 760;
  assert.equal(rankTeams([b, a])[0].team.id, a.id);
});

test('모든 동점 조건이 같으면 공동순위다', () => {
  const a = makeTeam(0); const b = makeTeam(1);
  a.finishSeconds = 700; b.finishSeconds = 700;
  assert.deepEqual(rankTeams([a, b]).map((entry) => entry.rank), [1, 1]);
});

test('팩맨 황금 먹이는 획득 시에만 5점이 더해진다', () => {
  const team = makeTeam(0); team.pacFood = 15;
  assert.equal(pacScore(team), 15);
  team.pacGold = true;
  assert.equal(pacScore(team), 20);
});

test('팩맨 내부 동점은 잡힌 횟수, 황금 먹이 순으로 판정한다', () => {
  const a = makeTeam(0); const b = makeTeam(1); const c = makeTeam(2);
  a.pacFood = 10; a.pacCaught = 2;
  b.pacFood = 5; b.pacGold = true; b.pacCaught = 1;
  c.pacFood = 10; c.pacCaught = 1;
  assert.deepEqual(rankPacman([a, b, c]).map((team) => team.id), [b.id, c.id, a.id]);
});

test('보물찾기 힌트는 보물별 1점 감점하고 0점 아래로 내려가지 않는다', () => {
  assert.equal(treasureItemScore({ found: true, answer: true, mission: true, hint: true }), 5);
  assert.equal(treasureItemScore({ found: false, answer: false, mission: false, hint: true }), 0);
});

test('텔레스트레이션 직접 수정 점수가 라운드 자동 합산을 덮어쓴다', () => {
  const team = makeTeam(0); team.teleRounds = [true, true, true, false]; team.teleManual = 12;
  assert.equal(teleScore(team), 12);
  team.teleManual = null;
  assert.equal(teleScore(team), 15);
});

for (const [name, run] of tests) {
  run();
  console.log(`✓ ${name}`);
}
console.log(`\n${tests.length}개 점수 규칙 테스트 통과`);
