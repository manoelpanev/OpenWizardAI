/**
 * Per-SSH-remote cache of whether `openwizardai-p` is available on the remote host's
 * PATH.
 *
 * Over SSH, a Claude agent on TUI (Max-plan) token mode runs `openwizardai-p` on the
 * remote to drive the claude TUI. If the user never installed openwizardai-p there,
 * the spawn exits 127 (command not found) on every turn. Probing the remote
 * once (an SSH `command -v openwizardai-p`, see `detectRemoteOpenWizardAIP` in the agents
 * IPC handler) and caching the result here lets two surfaces avoid that trap:
 *
 *   - `resolveClaudeSpawnMode`'s SSH branch falls a remote TUI spawn back to API
 *     when openwizardai-p is known-absent (mirrors the local `fileExists` fallback);
 *   - `AgentConfigPanel` (via IPC) disables the TUI token-source option, and
 *     defaults an unconfigured remote agent to API, when the remote can't run it.
 *
 * `undefined` means "never probed" (unknown). Callers stay optimistic on unknown
 * and let a probe resolve it, so a cold cache never silently downgrades a
 * correctly-configured remote.
 */

interface RemoteOpenWizardAIPEntry {
	available: boolean;
	probedAt: number;
}

/** How long a probe result stays fresh before a re-probe is warranted. */
export const REMOTE_OPENWIZARDAI_P_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, RemoteOpenWizardAIPEntry>();

/** Record the outcome of a remote openwizardai-p probe, keyed by the SSH remote id. */
export function setRemoteOpenWizardAIPAvailable(
	remoteId: string,
	available: boolean,
	now: number = Date.now()
): void {
	if (!remoteId) {
		return;
	}
	cache.set(remoteId, { available, probedAt: now });
}

/** Latest known availability for a remote, or `undefined` if never probed. */
export function getRemoteOpenWizardAIPAvailable(remoteId?: string | null): boolean | undefined {
	if (!remoteId) {
		return undefined;
	}
	return cache.get(remoteId)?.available;
}

/** True when there is no cached result, or the cached one is older than the TTL. */
export function isRemoteOpenWizardAIPProbeStale(
	remoteId?: string | null,
	now: number = Date.now()
): boolean {
	if (!remoteId) {
		return true;
	}
	const entry = cache.get(remoteId);
	return !entry || now - entry.probedAt > REMOTE_OPENWIZARDAI_P_TTL_MS;
}

/** Test seam: drop all cached results. */
export function __clearRemoteOpenWizardAIPCache(): void {
	cache.clear();
}
