'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHARADES_CATEGORIES, CharadesCategoryKey, CharadesState, DEFAULT_CHARADES_STATE, normalizeCharadesState } from '@/lib/charades';
import styles from './CharadesThemePicker.module.css';

const STORAGE_KEY = 'charades-live-state-v1';
const CHANNEL_KEY = 'charades-live';
const OVERRIDE_SLOTS = 128;

type Theme = 'mix' | CharadesCategoryKey;

function selectedTheme(state: CharadesState): Theme {
  const values = Object.values(state.categoryOverrides);
  if (!values.length) return 'mix';
  const first = values[0];
  return values.every((value) => value === first) ? first : 'mix';
}

function useCharadesThemeState() {
  const [state, setState] = useState<CharadesState>(() => structuredClone(DEFAULT_CHARADES_STATE));
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const local = normalizeCharadesState(JSON.parse(raw));
        stateRef.current = local;
        setState(local);
      }
    } catch { /* ignore cache */ }

    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.onmessage = (event) => {
      const incoming = normalizeCharadesState(event.data as CharadesState);
      if (incoming.updatedAt >= stateRef.current.updatedAt) {
        stateRef.current = incoming;
        setState(incoming);
      }
    };

    const pull = async () => {
      try {
        const response = await fetch('/api/charades', { cache: 'no-store' });
        if (!response.ok) return;
        const incoming = normalizeCharadesState(await response.json() as CharadesState);
        if (incoming.updatedAt >= stateRef.current.updatedAt) {
          stateRef.current = incoming;
          setState(incoming);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
        }
      } catch { /* keep last known state */ }
    };

    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 900);
    return () => { clearInterval(timer); channel.close(); };
  }, []);

  return { state, setState, stateRef };
}

export function CharadesThemePicker() {
  const { state, setState, stateRef } = useCharadesThemeState();
  const [saving, setSaving] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const theme = useMemo(() => selectedTheme(state), [state]);

  useEffect(() => {
    const check = () => setUnlocked(sessionStorage.getItem('game-score-admin') === 'yes');
    check();
    const timer = window.setInterval(check, 400);
    return () => clearInterval(timer);
  }, []);

  if (!unlocked || (state.phase !== 'setup' && state.phase !== 'ready')) return null;

  const choose = async (nextTheme: Theme) => {
    const next = structuredClone(stateRef.current);
    next.categoryOverrides = nextTheme === 'mix'
      ? {}
      : Object.fromEntries(Array.from({ length: OVERRIDE_SLOTS }, (_, index) => [String(index), nextTheme]));
    next.currentWord = null;
    next.revealed = false;
    next.updatedAt = Date.now();
    stateRef.current = next;
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.postMessage(next);
    channel.close();
    setSaving(true);
    try {
      await fetch('/api/charades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } finally {
      setSaving(false);
    }
  };

  return <section className={styles.picker} aria-label="몸으로 말해요 테마 선택">
    <div className={styles.head}>
      <div><p>THEME CONTROL</p><h2>몸으로 말해요 테마 선택</h2></div>
      <span>관리자 전용 · 선택 결과는 전광판에 표시만 됩니다</span>
    </div>
    <div className={styles.themes}>
      <button className={theme === 'mix' ? styles.active : ''} onClick={() => void choose('mix')}><b>🎲</b><span>자동 믹스</span></button>
      {CHARADES_CATEGORIES.map((category) => <button key={category.id} className={theme === category.id ? styles.active : ''} onClick={() => void choose(category.id)}><b>{category.emoji}</b><span>{category.label}</span></button>)}
    </div>
    <div className={styles.saving}>{saving ? '테마 저장 중…' : theme === 'mix' ? '현재: 자동 믹스' : `현재: ${CHARADES_CATEGORIES.find((category) => category.id === theme)?.label ?? ''}`}</div>
  </section>;
}

export function CharadesThemeDisplay() {
  const { state } = useCharadesThemeState();
  const theme = useMemo(() => selectedTheme(state), [state]);
  if (state.phase !== 'setup' && state.phase !== 'ready') return null;
  const category = theme === 'mix' ? null : CHARADES_CATEGORIES.find((item) => item.id === theme);

  return <aside className={styles.displayTheme} aria-label="몸으로 말해요 선택 테마">
    <span>오늘의 테마</span>
    <strong>{category ? `${category.emoji} ${category.label}` : '🎲 자동 믹스'}</strong>
    <small>{category ? '모든 팀 동일 테마' : '턴마다 주제가 바뀝니다'}</small>
  </aside>;
}
