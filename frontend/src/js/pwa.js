// Registers the service worker and shows an offline notice.
export function initPwa() {
  const notice = document.getElementById('net-status');
  const update = () => { if (notice) notice.hidden = navigator.onLine !== false; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => navigator.serviceWorker.register('./sw.js')
      .catch((error) => console.error('StepStack service worker registration failed:', error));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
}