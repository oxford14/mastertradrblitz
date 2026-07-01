/** Notify when SPA history changes (pushState / replaceState / popstate). */
export function onSpaNavigation(callback: () => void): () => void {
  const notify = () => callback();

  window.addEventListener('popstate', notify);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    notify();
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    notify();
  };

  return () => {
    window.removeEventListener('popstate', notify);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}
