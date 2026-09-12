'use client';

import { useState } from 'react';
import styles from './TelestrationApp.module.css';
import { TelestrationDynamicAdmin } from './telestration/TelestrationDynamicAdmin';
import { TelestrationDynamicDisplay } from './telestration/TelestrationDynamicDisplay';
import { useTelestrationLive, useTelestrationMemberCounts, useTelestrationScore } from './telestration/TelestrationRuntime';

function PinGate({ pin, children }: { pin: string; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('game-score-admin') === 'yes');
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  if (unlocked) return children;
  return <main className={styles.pin}><section><div>텔</div><p>OPERATOR ACCESS</p><h1>텔레스트레이션</h1><form onSubmit={(event) => { event.preventDefault(); if (value === pin) { sessionStorage.setItem('game-score-admin', 'yes'); setUnlocked(true); } else { setError(true); setValue(''); } }}><input aria-label="관리자 PIN" type="password" inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value); setError(false); }} autoFocus /><button>진행 화면 열기</button>{error && <span>PIN이 일치하지 않습니다.</span>}</form><a href="/admin">← 점수판으로 돌아가기</a></section></main>;
}

export function TelestrationDynamicApp({ mode }: { mode: 'admin' | 'display' }) {
  const live = useTelestrationLive();
  const score = useTelestrationScore();
  const memberCounts = useTelestrationMemberCounts();

  if (mode === 'admin' && (!live.ready || !score.ready)) return <main className={styles.loading}>텔레스트레이션 상태를 불러오는 중…</main>;
  if (mode === 'display') return <TelestrationDynamicDisplay live={live} score={score} memberCounts={memberCounts} />;
  return <PinGate pin={score.state.adminPin}><TelestrationDynamicAdmin live={live} score={score} memberCounts={memberCounts} /></PinGate>;
}
