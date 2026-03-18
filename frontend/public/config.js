// Backend API origin used by the static frontend.
// Update this value to point to your live backend (e.g., https://api.example.com).
window.JETTIC_CONFIG = {
  backendUrl:
    /\.netlify\.app$/i.test(window.location.hostname)
      ? '/.netlify/functions/relay'
      : 'https://scintillating-dasik-bc2b84.netlify.app/.netlify/functions/relay',
  minRequestIntervalMs: 2000,
  authDebug: true
};
