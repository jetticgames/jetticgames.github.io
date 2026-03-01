const rawBase = (import.meta.env.VITE_API_BASE_URL || window.location.origin).trim();
const normalizedBase = rawBase.replace(/\/$/, '');

export const API_BASE_URL = normalizedBase || window.location.origin;
export const APP_NAME = 'Jettic';
