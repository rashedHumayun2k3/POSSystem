"use client";

import { useCallback, useRef } from "react";

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 100;

// Tap = one step. Press and hold past HOLD_DELAY_MS = repeats every HOLD_REPEAT_MS until
// released. firedRef distinguishes the two: once the hold has actually repeated at least once,
// the click event that fires on release is suppressed — otherwise every hold would end with one
// extra, unwanted step on top of whatever the repeat already applied.
export function usePressAndHold(onStep: () => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const onPointerDown = useCallback(() => {
    firedRef.current = false;
    timeoutRef.current = setTimeout(() => {
      firedRef.current = true;
      onStep();
      intervalRef.current = setInterval(onStep, HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }, [onStep]);

  const onClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onStep();
  }, [onStep]);

  return { onPointerDown, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear, onClick };
}
