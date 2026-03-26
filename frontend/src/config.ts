type JetticWindowConfig = {
	JETTIC_CONFIG?: {
		backendUrl?: string;
	};
};

const isLocalHost = (hostname: string) => {
	const value = hostname.toLowerCase();
	return value === 'localhost' || value === '127.0.0.1' || value === '[::1]';
};

const globalBase = (window as Window & JetticWindowConfig).JETTIC_CONFIG?.backendUrl;
const envBase = import.meta.env.VITE_API_BASE_URL;
const fallbackBase = isLocalHost(window.location.hostname)
	? 'http://localhost:3000'
	: `${window.location.origin}/.netlify/functions/relay`;
const rawBase = (globalBase || envBase || fallbackBase).trim();
const normalizedBase = rawBase.replace(/\/$/, '');

export const API_BASE_URL = normalizedBase || fallbackBase;
export const APP_NAME = 'Jettic';
