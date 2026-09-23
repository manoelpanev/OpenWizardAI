/**
 * Tests for the bundle-safe Claude spawn-mode core (`claudeSpawnCore.ts`).
 *
 * The full decision matrix is exercised through the desktop wrapper in
 * `resolveClaudeSpawnMode.test.ts`. This file locks the pieces the CORE newly
 * exposes for the standalone `openwizardai-cli` to share - the pure helpers and the
 * behavior under the CLI's dependency shape (no SQLite usage snapshot) - so the
 * "one decision, honored across every surface" guarantee can't silently drift.
 */

import { describe, it, expect } from 'vitest';
import {
	resolveClaudeSpawnModeCore,
	isOpenWizardAIPBinaryPath,
	resolveConfigDirKeyFromEnv,
	defaultSelectMode,
	type ClaudeSpawnCoreDeps,
} from '../../../main/agents/claudeSpawnCore';

const CLAUDE_AGENT = {
	id: 'claude-code',
	interactiveCommand: 'openwizardai-p',
	interactiveModeArgs: ['--dangerously-skip-permissions'],
};

/**
 * Deps mirroring the CLI's `cliSpawnCoreDeps`: no SQLite usage snapshot, an
 * optimistic remote probe, and an injectable openwizardai-p presence flag.
 */
function cliShapedDeps(overrides?: Partial<ClaudeSpawnCoreDeps>): ClaudeSpawnCoreDeps {
	return {
		getOpenWizardAIPBinPath: () => '/bundle/openwizardai-p.js',
		isOpenWizardAIPBinaryPath,
		resolveConfigDirKey: resolveConfigDirKeyFromEnv,
		getUsageSnapshot: () => null,
		fileExists: () => true,
		getRemoteOpenWizardAIPAvailable: () => undefined,
		selectMode: defaultSelectMode,
		...overrides,
	};
}

describe('isOpenWizardAIPBinaryPath', () => {
	it('matches openwizardai-p by basename across path styles and variants', () => {
		expect(isOpenWizardAIPBinaryPath('/usr/local/bin/openwizardai-p')).toBe(true);
		expect(isOpenWizardAIPBinaryPath('/opt/app/openwizardai-p.js')).toBe(true);
		expect(isOpenWizardAIPBinaryPath('C:\\tools\\openwizardai-p.exe')).toBe(true);
		expect(isOpenWizardAIPBinaryPath('OPENWIZARDAI-P')).toBe(true);
	});

	it('does not match a plain claude binary or empty input', () => {
		expect(isOpenWizardAIPBinaryPath('/usr/local/bin/claude')).toBe(false);
		expect(isOpenWizardAIPBinaryPath('claude')).toBe(false);
		expect(isOpenWizardAIPBinaryPath(undefined)).toBe(false);
		expect(isOpenWizardAIPBinaryPath(null)).toBe(false);
		expect(isOpenWizardAIPBinaryPath('')).toBe(false);
	});
});

describe('resolveConfigDirKeyFromEnv', () => {
	it('uses CLAUDE_CONFIG_DIR when set (resolved to absolute)', () => {
		const key = resolveConfigDirKeyFromEnv({ CLAUDE_CONFIG_DIR: '/home/u/.claude' });
		expect(key).toBe('/home/u/.claude');
	});

	it('falls back to ~/.claude when unset', () => {
		const key = resolveConfigDirKeyFromEnv({});
		expect(key.endsWith('/.claude') || key.endsWith('\\.claude')).toBe(true);
	});
});

describe('resolveClaudeSpawnModeCore under CLI-shaped deps', () => {
	const NOW = new Date('2026-07-05T00:00:00.000Z');

	it('api token mode resolves to api (claude --print)', () => {
		const d = resolveClaudeSpawnModeCore(
			{ agent: CLAUDE_AGENT, tokenMode: 'api', sshEnabled: false, command: 'claude', now: NOW },
			cliShapedDeps()
		);
		expect(d.mode).toBe('api');
		expect(d.openwizardaiPBinPath).toBeNull();
	});

	it('interactive token mode resolves to the local openwizardai-p TUI when present', () => {
		const d = resolveClaudeSpawnModeCore(
			{
				agent: CLAUDE_AGENT,
				tokenMode: 'interactive',
				sshEnabled: false,
				command: 'claude',
				now: NOW,
			},
			cliShapedDeps()
		);
		expect(d.mode).toBe('interactive');
		expect(d.openwizardaiPBinPath).toBe('/bundle/openwizardai-p.js');
		expect(d.claudeRealBinPath).toBe('claude');
	});

	it('interactive falls back to api when no openwizardai-p binary is found', () => {
		const d = resolveClaudeSpawnModeCore(
			{
				agent: CLAUDE_AGENT,
				tokenMode: 'interactive',
				sshEnabled: false,
				command: 'claude',
				now: NOW,
			},
			cliShapedDeps({ getOpenWizardAIPBinPath: () => null })
		);
		expect(d.mode).toBe('api');
		expect(d.openwizardaiPBinPath).toBeNull();
	});

	it('dynamic with no usage snapshot resolves to interactive (CLI prefers the TUI it cannot rate-limit)', () => {
		// The standalone CLI has no SQLite snapshot, so getUsageSnapshot() => null;
		// selectMode(null) => interactive. This honors "start on TUI" for Dynamic.
		const d = resolveClaudeSpawnModeCore(
			{
				agent: CLAUDE_AGENT,
				tokenMode: 'dynamic',
				sshEnabled: false,
				command: 'claude',
				now: NOW,
			},
			cliShapedDeps()
		);
		expect(d.mode).toBe('interactive');
		expect(d.openwizardaiPBinPath).toBe('/bundle/openwizardai-p.js');
	});

	it('non-claude agents always resolve to api', () => {
		const d = resolveClaudeSpawnModeCore(
			{
				agent: { id: 'codex' },
				tokenMode: 'interactive',
				sshEnabled: false,
				command: 'codex',
				now: NOW,
			},
			cliShapedDeps()
		);
		expect(d.mode).toBe('api');
	});

	it('SSH interactive resolves to a remote openwizardai-p spawn (optimistic when unprobed)', () => {
		const d = resolveClaudeSpawnModeCore(
			{
				agent: CLAUDE_AGENT,
				tokenMode: 'interactive',
				sshEnabled: true,
				sshRemoteId: 'r1',
				command: 'claude',
				now: NOW,
			},
			cliShapedDeps()
		);
		expect(d.mode).toBe('interactive');
		expect(d.remote).toBe(true);
		expect(d.openwizardaiPBinPath).toBeNull();
	});

	it('SSH dynamic falls back to api (no remote quota signal)', () => {
		const d = resolveClaudeSpawnModeCore(
			{
				agent: CLAUDE_AGENT,
				tokenMode: 'dynamic',
				sshEnabled: true,
				sshRemoteId: 'r1',
				command: 'claude',
				now: NOW,
			},
			cliShapedDeps()
		);
		expect(d.mode).toBe('api');
	});
});
