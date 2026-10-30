/** Browser lifecycle hint; timers remain the fallback on other platforms. */
export function onPageResume(callback: () => void): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const onVisible = () => { if (document.visibilityState === 'visible') callback(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
  };
}
