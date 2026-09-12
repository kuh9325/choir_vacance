'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_STATE, EventState, normalizeState } from '@/lib/game';
import { normalizeCharadesState } from '@/lib/charades';
import { DEFAULT_TELESTRATION_STATE, TelestrationState, normalizeTelestrationState } from '@/lib/telestration';

const LIVE_STORAGE_KEY = 'telestration-live-state-v1';
const LIVE_CHANNEL_KEY = 'telestration-live';
const SCORE_STORAGE_KEY = 'game-score-state-v1';
const SCORE_CHANNEL_KEY = 'game-score-live';
const CHARADES_STORAGE_KEY = 'charades-live-state-v1';
const CHARADES_CHANNEL_KEY = 'charades-live';

export type LiveStore = {
  state: TelestrationState;
  ready: boolean;
  online: boolean;
  syncing: boolean;
  commit: (mutate: (draft: TelestrationState) => void) => void;
};

export type ScoreStore = {
  state: EventState;
  ready: boolean;
  online: boolean;
  setRoundResult: (teamId: string, roundIndex: number, success: boolean) => void;
};

export function useTelestrationLive(): LiveStore {
  const [state, setState] = useState<TelestrationState>(() => structuredClone(DEFAULT_TELESTRATION_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: TelestrationState) => {
    localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);
  const pushRemote = useCallback(async (next: TelestrationState) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/telestration', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      const result = await response.json() as { revision: number; updatedAt: number };
      setOnline(true);
      setState((current) => current.updatedAt === next.updatedAt ? { ...current, ...result } : current);
    } catch { setOnline(false); }
    finally { setSyncing(false); }
  }, []);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(LIVE_CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeTelestrationState(event.data as TelestrationState);
      if (incoming.updatedAt > stateRef.current.updatedAt) { stateRef.current = incoming; setState(incoming); }
    };
    let local = structuredClone(DEFAULT_TELESTRATION_STATE);
    try { local = normalizeTelestrationState(JSON.parse(localStorage.getItem(LIVE_STORAGE_KEY) ?? 'null')); } catch { /* ignore */ }
    stateRef.current = local; setState(local);

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/telestration', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeTelestrationState(await response.json() as TelestrationState);
        setOnline(true);
        if (remote.updatedAt > stateRef.current.updatedAt || (initial && stateRef.current.updatedAt === 0)) {
          stateRef.current = remote; setState(remote); saveLocal(remote);
        } else if (initial && stateRef.current.updatedAt > remote.updatedAt) {
          void pushRemote(stateRef.current);
        }
      } catch { setOnline(false); }
      finally { if (initial) setReady(true); }
    };
    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 800);
    const handleOnline = () => { setOnline(true); void pushRemote(stateRef.current); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      channelRef.current?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushRemote, saveLocal]);

  const commit = useCallback((mutate: (draft: TelestrationState) => void) => {
    const next = structuredClone(stateRef.current);
    mutate(next);
    next.updatedAt = Date.now();
    stateRef.current = next;
    setState(next);
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  return { state, ready, online, syncing, commit };
}

export function useTelestrationScore(): ScoreStore {
  const [state, setState] = useState<EventState>(() => structuredClone(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveLocal = useCallback((next: EventState) => {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);
  }, []);
  const pushRemote = useCallback(async (next: EventState) => {
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error('save failed');
      setOnline(true);
    } catch { setOnline(false); }
  }, []);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(SCORE_CHANNEL_KEY);
    channelRef.current.onmessage = (event) => {
      const incoming = normalizeState(event.data as EventState);
      if (incoming.updatedAt > stateRef.current.updatedAt) { stateRef.current = incoming; setState(incoming); }
    };
    let local = structuredClone(DEFAULT_STATE);
    try { local = normalizeState(JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? 'null')); } catch { /* ignore */ }
    stateRef.current = local; setState(local);

    const pull = async (initial = false) => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('load failed');
        const remote = normalizeState(await response.json() as EventState);
        setOnline(true);
        if (remote.updatedAt > stateRef.current.updatedAt || (initial && stateRef.current.updatedAt === 0)) {
          stateRef.current = remote; setState(remote); saveLocal(remote);
        } else if (initial && stateRef.current.updatedAt > remote.updatedAt) void pushRemote(stateRef.current);
      } catch { setOnline(false); }
      finally { if (initial) setReady(true); }
    };
    void pull(true);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(false); }, 900);
    const handleOnline = () => { setOnline(true); void pushRemote(stateRef.current); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      channelRef.current?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushRemote, saveLocal]);

  const setRoundResult = useCallback((teamId: string, roundIndex: number, success: boolean) => {
    const next = structuredClone(stateRef.current);
    const team = next.teams.find((entry) => entry.id === teamId);
    if (!team) return;
    while (team.teleRounds.length < 4) team.teleRounds.push(false);
    team.teleRounds[roundIndex] = success;
    team.teleManual = null;
    const now = Date.now();
    next.updatedAt = now;
    next.logs = [{ id: crypto.randomUUID(), at: now, text: `${team.name} 텔레스트레이션 R${roundIndex + 1} ${success ? '정답 +5점' : '0점'}` }, ...next.logs].slice(0, 100);
    stateRef.current = next;
    setState(next);
    saveLocal(next);
    void pushRemote(next);
  }, [pushRemote, saveLocal]);

  return { state, ready, online, setRoundResult };
}

export function useTelestrationMemberCounts() {
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const apply = (raw: unknown) => setMemberCounts(normalizeCharadesState(raw as Parameters<typeof normalizeCharadesState>[0]).memberCounts);
    try { const raw = localStorage.getItem(CHARADES_STORAGE_KEY); if (raw) apply(JSON.parse(raw)); } catch { /* ignore */ }
    const channel = new BroadcastChannel(CHARADES_CHANNEL_KEY);
    channel.onmessage = (event) => apply(event.data);
    const pull = async () => {
      try { const response = await fetch('/api/charades', { cache: 'no-store' }); if (response.ok) apply(await response.json()); } catch { /* keep cached counts */ }
    };
    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 1200);
    return () => { clearInterval(timer); channel.close(); };
  }, []);
  return memberCounts;
}

export function useTelestrationClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer); }, []);
  return now;
}
