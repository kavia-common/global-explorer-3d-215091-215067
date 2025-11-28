import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * useGestureWS connects to a gesture WebSocket server and exposes live gesture state.
 *
 * - Connects to VITE_WS_URL or ws://localhost:8765 with reconnect/backoff.
 * - Parses standardized payloads:
 *   { type: 'gesture', name, phase, data, timestamp }
 * - Supports legacy messages like 'zoom_in' and 'zoom_out'.
 * - Coalesces repeated "hold" events and debounces bursts (50–75ms window).
 * - Exposes:
 *    - status: 'connecting' | 'connected' | 'disconnected'
 *    - lastEvent: most recent normalized event {name, phase, data, ts}
 *    - gestureStateRef: mutable ref with recent buffered events (for frame-safe consumption)
 *    - enabled: boolean (runtime toggle)
 *    - setEnabled: setter
 */
export function useGestureWS({ enabledDefault = true, debounceMs = 60 } = {}) {
  const url = (import.meta?.env?.VITE_WS_URL || 'ws://localhost:8765');

  const [enabled, setEnabled] = useState(enabledDefault);
  const [status, setStatus] = useState('disconnected');
  const [lastEvent, setLastEvent] = useState(null);

  // Internal refs for WS and timing
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const backoffRef = useRef(1000); // start 1s
  const destroyedRef = useRef(false);

  // Gesture buffer ref for frame-safe polling (GlobeCanvas reads it in useFrame)
  const gestureStateRef = useRef({
    buffer: [], // array of { name, phase, data, ts }
    // lastProcessedTs for coalescing
    lastTsByKey: new Map(), // key: `${name}:${phase}`
  });

  const enqueueGesture = useCallback(
    (evt) => {
      // Debounce / coalesce holds and bursts
      const now = evt.ts || Date.now();
      const key = `${evt.name}:${evt.phase || 'unknown'}`;
      const last = gestureStateRef.current.lastTsByKey.get(key) || 0;

      if (evt.phase === 'hold' || evt.phase === 'start') {
        if (now - last < debounceMs) {
          // Coalesce within debounce window
          gestureStateRef.current.lastTsByKey.set(key, now);
          return;
        }
      }
      gestureStateRef.current.lastTsByKey.set(key, now);
      gestureStateRef.current.buffer.push(evt);
      setLastEvent(evt);
    },
    [debounceMs]
  );

  const normalizeMessage = useCallback(
    (raw) => {
      // Accept already-structured gesture objects
      if (raw && typeof raw === 'object' && raw.type === 'gesture') {
        const { name, phase, data, timestamp } = raw;
        return {
          name,
          phase: phase || 'start',
          data: data || {},
          ts: timestamp || Date.now(),
        };
      }

      // Legacy string messages, e.g., 'zoom_in', 'zoom_out'
      if (typeof raw === 'string') {
        if (raw === 'zoom_in') {
          return { name: 'thumbs_up', phase: 'start', data: { legacy: true }, ts: Date.now() };
        }
        if (raw === 'zoom_out') {
          return { name: 'thumbs_down', phase: 'start', data: { legacy: true }, ts: Date.now() };
        }
        // Unknown strings are ignored
        return null;
      }

      // Unknown message
      return null;
    },
    []
  );

  const cleanupWS = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {
        // ignore close errors
      }
    }
    wsRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (destroyedRef.current) return;
    globalThis.clearTimeout?.(reconnectTimerRef.current);
    const delay = Math.min(backoffRef.current, 15000);
    reconnectTimerRef.current = globalThis.setTimeout?.(() => {
      if (!destroyedRef.current && enabled) {
        connect();
        // Exponential backoff increase with jitter
        backoffRef.current = Math.min(backoffRef.current * 1.7 + Math.random() * 250, 20000);
      }
    }, delay);
  }, [enabled]);

  const connect = useCallback(() => {
    if (!enabled || destroyedRef.current) return;
    try {
      setStatus('connecting');
      const WS = globalThis.WebSocket;
      if (!WS) {
        setStatus('disconnected');
        scheduleReconnect();
        return;
      }
      const ws = new WS(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        backoffRef.current = 1000;
      };
      ws.onclose = () => {
        setStatus('disconnected');
        cleanupWS();
        scheduleReconnect();
      };
      ws.onerror = () => {
        setStatus('disconnected');
        cleanupWS();
        scheduleReconnect();
      };
      ws.onmessage = (evt) => {
        if (!enabled) return;
        try {
          const raw = (() => {
            try {
              return JSON.parse(evt.data);
            } catch {
              return evt.data;
            }
          })();
          const normalized = normalizeMessage(raw);
          if (normalized) {
            enqueueGesture(normalized);
          }
        } catch {
          // ignore malformed
        }
      };
    } catch {
      setStatus('disconnected');
      scheduleReconnect();
    }
  }, [cleanupWS, enqueueGesture, enabled, normalizeMessage, scheduleReconnect, url]);

  // Lifecycle: connect on mount and when enabled changes
  useEffect(() => {
    destroyedRef.current = false;
    if (enabled) {
      connect();
    } else {
      setStatus('disconnected');
      cleanupWS();
    }
    return () => {
      destroyedRef.current = true;
      globalThis.clearTimeout?.(reconnectTimerRef.current);
      cleanupWS();
    };
  }, [enabled, connect, cleanupWS]);

  return {
    status,
    lastEvent,
    gestureStateRef,
    enabled,
    setEnabled,
  };
}

export default useGestureWS;
