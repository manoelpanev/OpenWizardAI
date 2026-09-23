/**
 * openOpenWizardAILink - handle `openwizardai://` URLs clicked from inside the renderer
 * (markdown previews, AI output, etc.) without round-tripping through the OS
 * protocol handler.
 *
 * The renderer already listens for OS-delivered deep links via
 * `window.openwizardai.app.onDeepLink` (see useSessionSwitchCallbacks.ts). To avoid
 * duplicating navigation logic, in-app clicks fan out through the same handler
 * by dispatching a CustomEvent that the hook also subscribes to.
 */

import { parseOpenWizardAIDeepLink } from '../../shared/deep-link-urls';
import type { ParsedDeepLink } from '../../shared/types';

export const OPENWIZARDAI_LINK_EVENT = 'openwizardai:in-app-deep-link';

/**
 * Parse a `openwizardai://` URL and dispatch it to the in-renderer deep link
 * subscriber. Returns true if the URL was recognized and dispatched.
 */
export function openOpenWizardAILink(url: string): boolean {
	const parsed = parseOpenWizardAIDeepLink(url);
	if (!parsed) return false;
	window.dispatchEvent(
		new CustomEvent<ParsedDeepLink>(OPENWIZARDAI_LINK_EVENT, { detail: parsed })
	);
	return true;
}

/**
 * Subscribe to in-renderer `openwizardai://` link clicks. Returns an unsubscribe.
 */
export function subscribeToInAppDeepLinks(cb: (deepLink: ParsedDeepLink) => void): () => void {
	const handler = (event: Event) => {
		const detail = (event as CustomEvent<ParsedDeepLink>).detail;
		if (detail) cb(detail);
	};
	window.addEventListener(OPENWIZARDAI_LINK_EVENT, handler);
	return () => window.removeEventListener(OPENWIZARDAI_LINK_EVENT, handler);
}
