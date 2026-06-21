import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Token storage abstraction.
// NOTE: localStorage is used for the JWT for SPA simplicity. The XSS attack surface is minimized
// because we never render untrusted HTML (all user content goes through React text nodes).
// For production hardening, switch to httpOnly+SameSite=strict cookies with CSRF tokens.
const TOKEN_KEY = 'tj_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* noop */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ } },
};

export const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      tokenStore.clear();
    }
    return Promise.reject(err);
  },
);
