'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STATE, EventState, makeTeam, normalizeState } from '@/lib/game';
import { CharadesState, DEFAULT_CHARADES_STATE, normalizeCharadesState } from '@/lib/charades';
import styles from './TeamSetupDock.module.css';

const SCORE_STORAGE_KEY = 'game-score-state-v1';
const SCORE_CHANNEL_KEY = 'game-score-live';
const CHARADES_STORAGE_KEY = 'charades-live-state-v1';
const CHARADES_CHANNEL_KEY = 'charades-live';

export function TeamSetupDock() {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [charades, setCharades] = useState<CharadesState>(() => structuredClone(DEFAULT_CHARADES_STATE));
  const [saving, setSaving] = useState(false);
  const scoreRef = useRef(score);
  const charadesRef = useRef(charades);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { charadesRef.current = charades; }, [charades]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCORE_STORAGE_KEY);
      if (raw) {
        const parsed = normalizeState(JSON.parse(raw));
        scoreRef.current = parsed;
        setScore(parsed);
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(CHARADES_STORAGE_KEY);
      if (raw) {
        const parsed = normalizeCharadesState(JSON.parse(raw));
        charadesRef.current = parsed;
        setCharades(parsed);
      }
    } catch { /* ignore */ }

    const scoreChannel = new BroadcastChannel(SCORE_CHANNEL_KEY);
    const charadesChannel = new BroadcastChannel(CHARADES_CHANNEL_KEY);
    scoreChannel.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt >= scoreRef.current.updatedAt) {
        scoreRef.current = incoming;
        setScore(incoming);
      }
    };
    charadesChannel.onmessage = (event) => {
      const incoming = normalizeCharadesState(event.data as CharadesState);
      if (incoming.updatedAt >= charadesRef.current.updatedAt) {
        charadesRef.current = incoming;
        setCharades(incoming);
      }
    };

    const pull = async () => {
      try {
        const [scoreResponse, charadesResponse] = await Promise.all([
          fetch('/api/state', { cache: 'no-store' }),
          fetch('/api/charades', { cache: 'no-store' }),
        ]);
        if (scoreResponse.ok) {
          const incoming = normalizeState(await scoreResponse.json() as EventState);
          if (incoming.updatedAt >= scoreRef.current.updatedAt) {
            scoreRef.current = incoming;
            setScore(incoming);
            localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(incoming));
          }
        }
        if (charadesResponse.ok) {
          const incoming = normalizeCharadesState(await charadesResponse.json() as CharadesState);
          if (incoming.updatedAt >= charadesRef.current.updatedAt) {
            charadesRef.current = incoming;
            setCharades(incoming);
            localStorage.setItem(CHARADES_STORAGE_KEY, JSON.stringify(incoming));
          }
        }
      } catch { /* keep cached state */ }
    };

    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 1500);
    return () => {
      clearInterval(timer);
      scoreChannel.close();
      charadesChannel.close();
    };
  }, []);

  const saveScore = async (text: string, mutate: (draft: EventState) => void) => {
    const next = structuredClone(scoreRef.current);
    mutate(next);
    const now = Date.now();
    next.updatedAt = now;
    next.logs = [{ id: crypto.randomUUID(), at: now, text }, ...next.logs].slice(0, 100);
    scoreRef.current = next;
    setScore(next);
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    const channel = new BroadcastChannel(SCORE_CHANNEL_KEY);
    channel.postMessage(next);
    channel.close();
    setSaving(true);
    try {
      await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    } finally {
      setSaving(false);
    }
  };

  const saveCharades = async (mutate: (draft: CharadesState) => void) => {
    const next = structuredClone(charadesRef.current);
    mutate(next);
    next.updatedAt = Date.now();
    charadesRef.current = next;
    setCharades(next);
    localStorage.setItem(CHARADES_STORAGE_KEY, JSON.stringify(next));
    const channel = new BroadcastChannel(CHARADES_CHANNEL_KEY);
    channel.postMessage(next);
    channel.close();
    setSaving(true);
    try {
      await fetch('/api/charades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    } finally {
      setSaving(false);
    }
  };

  const changeTeamCount = (count: number) => {
    void saveScore(`참가팀 수를 ${count}팀으로 변경`, (draft) => {
      if (count > draft.teams.length) {
        draft.teams.push(...Array.from({ length: count - draft.teams.length }, (_, index) => makeTeam(draft.teams.length + index)));
      } else {
        draft.teams = draft.teams.slice(0, count);
      }
      draft.resultReveal = Math.min(draft.resultReveal, draft.teams.length);
      if (draft.lionAwardId && !draft.teams.some((team) => team.id === draft.lionAwardId)) draft.lionAwardId = null;
    });
  };

  return <>
    <button className={styles.trigger} onClick={() => setOpen(true)} aria-label="팀 구성 설정 열기">
      <span>👥</span><b>팀 구성</b><small>{score.teams.length}팀 · {score.teams.reduce((sum, team) => sum + (charades.memberCounts[team.id] ?? 4), 0)}명</small>
    </button>

    {open && <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="팀 구성 설정">
      <section className={styles.panel}>
        <header>
          <div><p>TEAM SETUP</p><h2>팀 구성 설정</h2><span>여기서 바꾸면 점수판과 게임 진행화면에 함께 반영됩니다.</span></div>
          <button onClick={() => setOpen(false)} aria-label="닫기">×</button>
        </header>

        <div className={styles.countRow}>
          <div><b>참가 팀 수</b><span>3~8팀</span></div>
          <div className={styles.stepper}>
            <button disabled={score.teams.length <= 3} onClick={() => changeTeamCount(score.teams.length - 1)}>−</button>
            <strong>{score.teams.length}팀</strong>
            <button disabled={score.teams.length >= 8} onClick={() => changeTeamCount(score.teams.length + 1)}>＋</button>
          </div>
        </div>

        {score.teams.length > 5 && <div className={styles.warning}>텔레스트레이션 전용 진행화면은 현재 5팀 기준으로 설계되어 있습니다. 6팀 이상이면 기본 점수판은 정상 동작하지만 텔레스트레이션 진행화면은 별도 조정이 필요합니다.</div>}

        <div className={styles.teamList}>
          {score.teams.map((team, index) => {
            const members = charades.memberCounts[team.id] ?? 4;
            return <article key={team.id} style={{ '--team': team.color } as React.CSSProperties}>
              <div className={styles.teamIndex}>{index + 1}</div>
              <label className={styles.colorLabel}><span>색상</span><input type="color" value={team.color} onChange={(event) => void saveScore(`${team.name} 색상 변경`, (draft) => { const target = draft.teams.find((item) => item.id === team.id); if (target) target.color = event.target.value; })} /></label>
              <label className={styles.nameLabel}><span>팀 이름</span><input value={team.name} onChange={(event) => void saveScore(`${team.name} 팀명 변경`, (draft) => { const target = draft.teams.find((item) => item.id === team.id); if (target) target.name = event.target.value; })} /></label>
              <div className={styles.members}>
                <span>인원</span>
                <div><button disabled={members <= 1} onClick={() => void saveCharades((draft) => { draft.memberCounts[team.id] = Math.max(1, members - 1); })}>−</button><strong>{members}명</strong><button disabled={members >= 8} onClick={() => void saveCharades((draft) => { draft.memberCounts[team.id] = Math.min(8, members + 1); })}>＋</button></div>
              </div>
            </article>;
          })}
        </div>

        <footer>
          <span>{saving ? '저장 중…' : '✓ 변경 즉시 자동 저장'}</span>
          <button onClick={() => setOpen(false)}>완료</button>
        </footer>
      </section>
    </div>}
  </>;
}
