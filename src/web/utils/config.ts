/**
 * OpenWizardAI Web Config
 *
 * Configuration injected by the server into window.__OPENWIZARDAI_CONFIG__
 * This tells the React app about the security token and current context.
 */
import { webLogger } from './logger';

/**
 * Configuration injected by the server
 */
export interface OpenWizardAIConfig {
	/** Security token (UUID) - required in all API/WS URLs */
	securityToken: string;
	/** Session ID if viewing a specific session, null for dashboard */
	sessionId: string | null;
	/** Tab ID if viewing a specific tab within a session, null for default tab */
	tabId: string | null;
	/** Base path for API requests (e.g., "/$TOKEN/api") */
	apiBase: string;
	/** WebSocket URL path (e.g., "/$TOKEN/ws") */
	wsUrl: string;
}

// Extend Window interface
declare global {
	interface Window {
		__OPENWIZARDAI_CONFIG__?: OpenWizardAIConfig;
	}
}

/**
 * Get the OpenWizardAI config from window
 * Returns default values if not injected (for development)
 */
export function getOpenWizardAIConfig(): OpenWizardAIConfig {
	if (window.__OPENWIZARDAI_CONFIG__) {
		return window.__OPENWIZARDAI_CONFIG__;
	}

	// Development fallback - use current URL structure
	// In dev mode, you'd need to manually set the token
	webLogger.warn('No __OPENWIZARDAI_CONFIG__ found, using development defaults', 'Config');

	// Try to extract token from URL path (e.g., /abc123-def456/...)
	const pathParts = window.location.pathname.split('/').filter(Boolean);
	const token = pathParts[0] || 'dev-token';

	// Check if we're on a session route (e.g., /$TOKEN/session/$SESSION_ID)
	const sessionId = pathParts[1] === 'session' ? pathParts[2] || null : null;

	// Extract tabId from query parameter (e.g., ?tabId=abc123)
	const urlParams = new URLSearchParams(window.location.search);
	const tabId = urlParams.get('tabId');

	return {
		securityToken: token,
		sessionId,
		tabId,
		apiBase: `/${token}/api`,
		wsUrl: `/${token}/ws`,
	};
}

/**
 * Check if we're in dashboard mode (viewing all sessions)
 */
export function isDashboardMode(): boolean {
	const config = getOpenWizardAIConfig();
	return config.sessionId === null;
}

/**
 * Check if we're in session mode (viewing a specific session)
 */
export function isSessionMode(): boolean {
	const config = getOpenWizardAIConfig();
	return config.sessionId !== null;
}

/**
 * Get the current session ID (if in session mode)
 */
export function getCurrentSessionId(): string | null {
	return getOpenWizardAIConfig().sessionId;
}

/**
 * Build the full API URL for a given endpoint
 */
export function buildApiUrl(endpoint: string): string {
	const config = getOpenWizardAIConfig();
	const base = config.apiBase.endsWith('/') ? config.apiBase.slice(0, -1) : config.apiBase;
	const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	return `${window.location.origin}${base}${path}`;
}

/**
 * Build the full WebSocket URL
 */
export function buildWebSocketUrl(sessionId?: string): string {
	const config = getOpenWizardAIConfig();
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const host = window.location.host;
	let url = `${protocol}//${host}${config.wsUrl}`;

	// Add sessionId as query param if provided (for session-specific subscription)
	if (sessionId) {
		url += `?sessionId=${encodeURIComponent(sessionId)}`;
	}

	return url;
}

/**
 * Get the dashboard URL
 */
export function getDashboardUrl(): string {
	const config = getOpenWizardAIConfig();
	return `${window.location.origin}/${config.securityToken}`;
}

/**
 * Get the URL for a specific session
 */
export function getSessionUrl(sessionId: string, tabId?: string | null): string {
	const config = getOpenWizardAIConfig();
	const baseUrl = `${window.location.origin}/${config.securityToken}/session/${sessionId}`;
	if (tabId) {
		return `${baseUrl}?tabId=${encodeURIComponent(tabId)}`;
	}
	return baseUrl;
}

/**
 * Get the current tab ID from URL (if specified)
 */
export function getCurrentTabId(): string | null {
	return getOpenWizardAIConfig().tabId;
}

/**
 * Update the URL to reflect current session and tab without page reload
 * Uses history.replaceState to update the URL bar without navigation
 */
export function updateUrlForSessionTab(sessionId: string, tabId?: string | null): void {
	const newUrl = getSessionUrl(sessionId, tabId);
	// Only update if URL actually changed
	if (window.location.href !== newUrl) {
		window.history.replaceState({ sessionId, tabId }, '', newUrl);
	}
}
