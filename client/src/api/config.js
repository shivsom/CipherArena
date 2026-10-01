// Same-origin '/api' when Express serves the build (Render single service).
// Set VITE_API_URL (e.g. https://cipherarena-api.onrender.com/api) when the
// React build is hosted separately on Vercel or Netlify.
export const API_URL = import.meta.env.VITE_API_URL || '/api'
