// Backend API origin used by the static frontend.
// Update this value to point to your live backend (e.g., https://api.example.com).
const hostname = window.location.hostname.toLowerCase();
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
const isNetlify = /\.netlify\.app$/i.test(hostname);

const defaultBackendUrls =
  isLocal
    ? ['http://localhost:3000']
    : isNetlify
    ? ['/.netlify/functions/relay']
    : ['https://scintillating-dasik-bc2b84.netlify.app/.netlify/functions/relay'];

window.JETTIC_CONFIG = {
  // Optional: provide multiple relay URLs. The frontend races these on startup.
  // backendUrls: ['https://relay-a.netlify.app/.netlify/functions/relay', 'https://relay-b.netlify.app/.netlify/functions/relay'],
  backendUrls: defaultBackendUrls,
  backendUrl: defaultBackendUrls[0]
};
