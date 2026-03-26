const isLocalHost = (hostname: string) => {
	const value = hostname.toLowerCase();
	return value === 'localhost' || value === '127.0.0.1' || value === '[::1]';
};

const envBase = import.meta.env.VITE_API_BASE_URL;
const fallbackBase = isLocalHost(window.location.hostname)
	? 'http://localhost:3000'
	: `${window.location.origin}/.netlify/functions/relay`;
const rawBase = (envBase || fallbackBase).trim();
const normalizedBase = rawBase.replace(/\/$/, '');

export const API_BASE_URL = normalizedBase || fallbackBase;
export const APP_NAME = 'Jettic';
