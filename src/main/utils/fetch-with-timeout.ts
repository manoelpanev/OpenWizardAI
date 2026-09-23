/**
 * `fetch` with an abort deadline. Rejects with an AbortError once `timeoutMs`
 * elapses so a hung endpoint can never stall the caller.
 */
export async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timeoutId);
	}
}
