/** Browser lifecycle hint; timers remain the fallback on other platforms. */
export function onPageResume(
  callback: (reason: 'resume' | 'pageshow' | 'online') => void,
  listenForNetworkRecovery = false
): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  let wasHidden = document.visibilityState === 'hidden';
  const onVisible = () => {
    const hidden = document.visibilityState === 'hidden';
    const resumed = wasHidden && !hidden;
    wasHidden = hidden;
    if (resumed) callback('resume');
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (document.visibilityState === 'visible') callback(event.persisted ? 'resume' : 'pageshow');
  };
  const onOnline = () => callback('online');
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  if (listenForNetworkRecovery) window.addEventListener('online', onOnline);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
    if (listenForNetworkRecovery) window.removeEventListener('online', onOnline);
  };
}
