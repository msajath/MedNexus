// API base URL – in development Vite's proxy handles /api → localhost:5000.
// In production we need the full Render URL.
export const API_BASE = import.meta.env.VITE_API_URL || '';
