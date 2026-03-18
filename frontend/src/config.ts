type JetticWindowConfig = {
	JETTIC_CONFIG?: {
		backendUrl?: string;
	};
};

const globalBase = (window as Window & JetticWindowConfig).JETTIC_CONFIG?.backendUrl;
const envBase = import.meta.env.VITE_API_BASE_URL;
const fallbackBase = `${window.location.origin}/relay`;
const rawBase = (globalBase || envBase || fallbackBase).trim();
const normalizedBase = rawBase.replace(/\/$/, '');

export const API_BASE_URL = normalizedBase || fallbackBase;
export const APP_NAME = 'Jettic';
