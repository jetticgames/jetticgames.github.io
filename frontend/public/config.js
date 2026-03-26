// Backend API origin used by the static frontend.
// Update this value to point to your live backend (e.g., https://api.example.com).
const hostname = window.location.hostname.toLowerCase();
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
const isNetlify = /\.netlify\.app$/i.test(hostname);

window.JETTIC_CONFIG = {
  backendUrl:
    isLocal
      ? 'http://localhost:3000'
      : isNetlify
      ? '/.netlify/functions/relay'
      : 'https://scintillating-dasik-bc2b84.netlify.app/.netlify/functions/relay'
};
