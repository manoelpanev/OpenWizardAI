/**
 * Tests for claudeTokenMode.ts - the canonical collapse of the persisted
 * `(enableOpenWizardAIP, openwizardaiPMode)` pair into the tri-state token mode, and its
 * inverse. This pair is read by every Claude Code spawn surface, so the
 * migration semantics (legacy Adaptive toggle -> 'dynamic') must stay exact.
 */

import { describe, it, expect } from 'vitest';
import {
	getClaudeTokenMode,
	toClaudeTokenModeSource,
	getClaudeTokenSourceFields,
	type ClaudeTokenMode,
} from '../../shared/claudeTokenMode';

describe('getClaudeTokenMode', () => {
	it('returns api for null/undefined source', () => {
		expect(getClaudeTokenMode(null)).toBe('api');
		expect(getClaudeTokenMode(undefined)).toBe('api');
	});

	it('returns api when the opt-in is off (or absent)', () => {
		expect(getClaudeTokenMode({})).toBe('api');
		expect(getClaudeTokenMode({ enableOpenWizardAIP: false })).toBe('api');
		// Even an explicit refinement is ignored while the opt-in is off.
		expect(
			getClaudeTokenMode({ enableOpenWizardAIP: false, openwizardaiPMode: 'interactive' })
		).toBe('api');
	});

	it('migrates a legacy opt-in with no refinement to dynamic', () => {
		// A pre-refinement session that only had the Adaptive toggle on must read
		// as its historical behavior: dynamic auto-switching.
		expect(getClaudeTokenMode({ enableOpenWizardAIP: true })).toBe('dynamic');
	});

	it('honors an explicit refinement when the opt-in is on', () => {
		expect(
			getClaudeTokenMode({ enableOpenWizardAIP: true, openwizardaiPMode: 'interactive' })
		).toBe('interactive');
		expect(getClaudeTokenMode({ enableOpenWizardAIP: true, openwizardaiPMode: 'dynamic' })).toBe(
			'dynamic'
		);
	});

	describe('SSH default (sshEnabled option)', () => {
		it('defaults an UNCONFIGURED SSH agent to interactive (the remote TUI)', () => {
			// enableOpenWizardAIP unset over SSH => default to the Max-plan TUI, not API.
			expect(getClaudeTokenMode({}, { sshEnabled: true })).toBe('interactive');
			expect(getClaudeTokenMode(undefined, { sshEnabled: true })).toBe('interactive');
			expect(getClaudeTokenMode(null, { sshEnabled: true })).toBe('interactive');
			expect(getClaudeTokenMode({ openwizardaiPMode: 'dynamic' }, { sshEnabled: true })).toBe(
				'interactive'
			);
		});

		it('still honors an EXPLICIT api choice over SSH (false is not unset)', () => {
			expect(getClaudeTokenMode({ enableOpenWizardAIP: false }, { sshEnabled: true })).toBe('api');
			expect(
				getClaudeTokenMode(
					{ enableOpenWizardAIP: false, openwizardaiPMode: 'interactive' },
					{ sshEnabled: true }
				)
			).toBe('api');
		});

		it('honors an explicit opt-in over SSH unchanged', () => {
			expect(
				getClaudeTokenMode(
					{ enableOpenWizardAIP: true, openwizardaiPMode: 'interactive' },
					{ sshEnabled: true }
				)
			).toBe('interactive');
			// dynamic is still surfaced here; resolveClaudeSpawnMode falls it back to api on SSH.
			expect(
				getClaudeTokenMode(
					{ enableOpenWizardAIP: true, openwizardaiPMode: 'dynamic' },
					{ sshEnabled: true }
				)
			).toBe('dynamic');
		});

		it('does NOT change the local (non-SSH) default for an unconfigured agent', () => {
			expect(getClaudeTokenMode({}, { sshEnabled: false })).toBe('api');
			expect(getClaudeTokenMode(undefined)).toBe('api');
		});

		describe('remote openwizardai-p availability (sshOpenWizardAIPAvailable option)', () => {
			it('flips the unconfigured SSH default to api when the remote has no openwizardai-p', () => {
				expect(getClaudeTokenMode({}, { sshEnabled: true, sshOpenWizardAIPAvailable: false })).toBe(
					'api'
				);
				expect(
					getClaudeTokenMode(undefined, { sshEnabled: true, sshOpenWizardAIPAvailable: false })
				).toBe('api');
			});

			it('keeps the optimistic interactive default when availability is unknown or present', () => {
				expect(
					getClaudeTokenMode({}, { sshEnabled: true, sshOpenWizardAIPAvailable: undefined })
				).toBe('interactive');
				expect(getClaudeTokenMode({}, { sshEnabled: true, sshOpenWizardAIPAvailable: true })).toBe(
					'interactive'
				);
			});

			it('does not override an EXPLICIT opt-in even when the remote has no openwizardai-p', () => {
				// The selector / resolver enforce availability at spawn time; the stored
				// preference is left intact so it survives a transient probe miss.
				expect(
					getClaudeTokenMode(
						{ enableOpenWizardAIP: true, openwizardaiPMode: 'interactive' },
						{ sshEnabled: true, sshOpenWizardAIPAvailable: false }
					)
				).toBe('interactive');
			});
		});
	});
});

describe('toClaudeTokenModeSource', () => {
	it('encodes each mode into the persisted pair, keeping the legacy boolean in sync', () => {
		expect(toClaudeTokenModeSource('api')).toEqual({
			enableOpenWizardAIP: false,
			openwizardaiPMode: 'dynamic',
		});
		expect(toClaudeTokenModeSource('interactive')).toEqual({
			enableOpenWizardAIP: true,
			openwizardaiPMode: 'interactive',
		});
		expect(toClaudeTokenModeSource('dynamic')).toEqual({
			enableOpenWizardAIP: true,
			openwizardaiPMode: 'dynamic',
		});
	});
});

describe('round-trip', () => {
	it('getClaudeTokenMode(toClaudeTokenModeSource(m)) === m for every mode', () => {
		const modes: ClaudeTokenMode[] = ['api', 'interactive', 'dynamic'];
		for (const mode of modes) {
			expect(getClaudeTokenMode(toClaudeTokenModeSource(mode))).toBe(mode);
		}
	});
});

describe('getClaudeTokenSourceFields', () => {
	// This extractor is the single source of truth every spawn surface that
	// can't hydrate from the persisted session (tab naming, background synopsis)
	// forwards. The contract: it always carries the COMPLETE triple so a Claude
	// turn resolves the same provider the chat would - a partial forward is the
	// bug class that silently downgrades Dynamic to TUI.
	const KEYS = ['enableOpenWizardAIP', 'openwizardaiPMode', 'openwizardaiPPath'] as const;

	it('carries all three fields verbatim for every mode', () => {
		expect(
			getClaudeTokenSourceFields({
				enableOpenWizardAIP: true,
				openwizardaiPMode: 'dynamic',
				openwizardaiPPath: '/opt/openwizardai-p',
			})
		).toEqual({
			enableOpenWizardAIP: true,
			openwizardaiPMode: 'dynamic',
			openwizardaiPPath: '/opt/openwizardai-p',
		});

		expect(
			getClaudeTokenSourceFields({ enableOpenWizardAIP: true, openwizardaiPMode: 'interactive' })
		).toEqual({
			enableOpenWizardAIP: true,
			openwizardaiPMode: 'interactive',
			openwizardaiPPath: undefined,
		});

		expect(getClaudeTokenSourceFields({ enableOpenWizardAIP: false })).toEqual({
			enableOpenWizardAIP: false,
			openwizardaiPMode: undefined,
			openwizardaiPPath: undefined,
		});
	});

	it('preserves an explicit API opt-out (false must NOT collapse to undefined)', () => {
		// An explicit `false` is "user picked API". If a forward dropped it to
		// undefined, an SSH agent would revert to the interactive default.
		const out = getClaudeTokenSourceFields({ enableOpenWizardAIP: false });
		expect(out.enableOpenWizardAIP).toBe(false);
	});

	it('returns the full key set (never a partial) for null/undefined/empty input', () => {
		for (const src of [null, undefined, {}]) {
			const out = getClaudeTokenSourceFields(src);
			expect(Object.keys(out).sort()).toEqual([...KEYS].sort());
			expect(out).toEqual({
				enableOpenWizardAIP: undefined,
				openwizardaiPMode: undefined,
				openwizardaiPPath: undefined,
			});
		}
	});

	it('ignores unrelated fields on the source object', () => {
		const out = getClaudeTokenSourceFields({
			enableOpenWizardAIP: true,
			openwizardaiPMode: 'dynamic',
			// @ts-expect-error - extra session fields must not leak through
			customModel: 'opus',
			cwd: '/tmp',
		});
		expect(Object.keys(out).sort()).toEqual([...KEYS].sort());
	});
});
