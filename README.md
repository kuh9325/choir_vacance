# GAME SCORE

2026년 9월 5일 초등학교 고학년 실내 게임 행사를 위한 실시간 점수 입력·전시 웹앱입니다.

## 주요 화면

- `/admin` — 운영자 점수 입력 및 행사 제어 (초기 PIN: `0905`)
- `/display` — 프로젝터/TV 전광판
- `/results` — 순위 단계 공개 및 시상 화면

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 빌드

```bash
npm run build
```

## 데이터와 오프라인 동작

- Cloudflare D1의 `event_state` 단일 레코드가 서버 원본 데이터입니다.
- 모든 변경은 같은 기기의 `localStorage`에도 즉시 백업됩니다.
- 같은 브라우저의 운영자/전광판 탭은 `BroadcastChannel`로 즉시 갱신됩니다.
- 다른 기기는 서버 상태를 0.8초 간격으로 가져옵니다.
- 네트워크가 끊기면 로컬 입력을 계속 받고, 연결 복구 시 자동 업로드합니다.

## Cloudflare 배포

독립 Cloudflare Workers 배포 설정은 `wrangler.jsonc`에 있습니다. 연결된 D1 데이터베이스의 바인딩 이름은 `DB`입니다.

```bash
npm run deploy
```

GitHub 기반 Cloudflare Workers Builds에서는 빌드 명령을 `npm run build`, 배포 명령을 `npx wrangler deploy`로 설정합니다. 새 D1 데이터베이스를 사용할 때는 `drizzle/0000_lethal_black_crow.sql`을 먼저 적용해야 합니다.

## 점수 규칙

- 텔레스트레이션: 성공 라운드당 5점, 20점 만점
- 바닥팩맨: 일반 먹이 1점, 황금 먹이 5점, 20점 만점
- 팀전 보물찾기: 발견 1점 + 정답 3점 + 미션 2점 − 힌트 1점, 30점 만점
- 종합 동점: 보물찾기 → 텔레스트레이션 → 보물찾기 완주시간 순
- 위 조건까지 같으면 공동순위

## 현장 운영 권장사항

행사 전 운영자 휴대폰과 프로젝터 기기에서 URL을 한 번씩 열어 두고, 전광판을 전체화면으로 전환해 주세요. 운영자 화면의 CSV/JSON 내보내기로 종료 후 결과를 보관할 수 있습니다.
