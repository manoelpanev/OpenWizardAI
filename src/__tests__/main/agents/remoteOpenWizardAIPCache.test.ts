import { describe, it, expect, beforeEach } from 'vitest';
import {
	setRemoteOpenWizardAIPAvailable,
	getRemoteOpenWizardAIPAvailable,
	isRemoteOpenWizardAIPProbeStale,
	REMOTE_OPENWIZARDAI_P_TTL_MS,
	__clearRemoteOpenWizardAIPCache,
} from '../../../main/agents/remoteOpenWizardAIPCache';

describe('remoteOpenWizardAIPCache', () => {
	beforeEach(() => {
		__clearRemoteOpenWizardAIPCache();
	});

	it('returns undefined for a never-probed remote', () => {
		expect(getRemoteOpenWizardAIPAvailable('remote-1')).toBeUndefined();
	});

	it('returns undefined for a missing/empty remote id', () => {
		expect(getRemoteOpenWizardAIPAvailable(undefined)).toBeUndefined();
		expect(getRemoteOpenWizardAIPAvailable(null)).toBeUndefined();
		expect(getRemoteOpenWizardAIPAvailable('')).toBeUndefined();
	});

	it('records and reads back availability keyed by remote id', () => {
		setRemoteOpenWizardAIPAvailable('remote-1', true);
		setRemoteOpenWizardAIPAvailable('remote-2', false);
		expect(getRemoteOpenWizardAIPAvailable('remote-1')).toBe(true);
		expect(getRemoteOpenWizardAIPAvailable('remote-2')).toBe(false);
	});

	it('ignores a set with an empty remote id', () => {
		setRemoteOpenWizardAIPAvailable('', true);
		expect(getRemoteOpenWizardAIPAvailable('')).toBeUndefined();
	});

	it('treats a never-probed (or empty) remote as stale', () => {
		expect(isRemoteOpenWizardAIPProbeStale('remote-1')).toBe(true);
		expect(isRemoteOpenWizardAIPProbeStale(undefined)).toBe(true);
	});

	it('treats a fresh result as not stale and an expired one as stale', () => {
		const t0 = 1_000_000;
		setRemoteOpenWizardAIPAvailable('remote-1', true, t0);
		expect(isRemoteOpenWizardAIPProbeStale('remote-1', t0 + REMOTE_OPENWIZARDAI_P_TTL_MS - 1)).toBe(
			false
		);
		expect(isRemoteOpenWizardAIPProbeStale('remote-1', t0 + REMOTE_OPENWIZARDAI_P_TTL_MS + 1)).toBe(
			true
		);
	});
});
