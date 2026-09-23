import { describe, it, expect } from 'vitest';
import {
	resolveClaudeSpawnMode,
	applyClaudeSpawnDecision,
	buildRemoteInteractiveSpawn,
	REMOTE_OPENWIZARDAI_P_COMMAND,
	type ResolveClaudeSpawnModeDeps,
} from '../../../main/agents/resolveClaudeSpawnMode';
import type { UsageSnapshot } from '../../../main/agents/claude-mode-selector';

const claudeAgent = {
	id: 'claude-code',
	interactiveCommand: 'openwizardai-p',
	interactiveModeArgs: ['--dangerously-skip-permissions'],
	defaultEnvVars: {},
};

const NOW = new Date('2026-06-02T12:00:00Z');

/** A snapshot whose windows are open (resets in the future) and under threshold. */
function healthySnapshot(): UsageSnapshot {
	const future = new Date('2026-06-02T18:00:00Z').toISOString();
	return {
		sampledAt: NOW.toISOString(),
		configDirKey: 'key',
		session: { percent: 10, resetsAt: future },
		weekAllModels: { percent: 10, resetsAt: future },
		weekSonnetOnly: { percent: 10, resetsAt: future },
	};
}

/** A snapshot whose 5-hour window is maxed out (still open). */
function limitedSnapshot(): UsageSnapshot {
	const future = new Date('2026-06-02T18:00:00Z').toISOString();
	return {
		sampledAt: NOW.toISOString(),
		configDirKey: 'key',
		session: { percent: 100, resetsAt: future },
		weekAllModels: { percent: 10, resetsAt: future },
		weekSonnetOnly: { percent: 10, resetsAt: future },
	};
}

function makeDeps(
	over: Partial<ResolveClaudeSpawnModeDeps> = {}
): Partial<ResolveClaudeSpawnModeDeps> {
	return {
		getOpenWizardAIPBinPath: () => '/bundled/openwizardai-p.js',
		isOpenWizardAIPBinaryPath: (p) => !!p && p.includes('openwizardai-p'),
		resolveConfigDirKey: () => 'key',
		getUsageSnapshot: () => healthySnapshot(),
		fileExists: () => true,
		// Default to "unknown" so remote interactive stays optimistic unless a test
		// pins a probe result.
		getRemoteOpenWizardAIPAvailable: () => undefined,
		...over,
	};
}

describe('resolveClaudeSpawnMode', () => {
	it('non-claude agents always resolve to API', () => {
		const r = resolveClaudeSpawnMode({
			agent: { id: 'codex', defaultEnvVars: {} } as never,
			tokenMode: 'dynamic',
			sshEnabled: false,
			command: 'codex',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('api');
		expect(r.openwizardaiPBinPath).toBeNull();
	});

	it('SSH-enabled claude with api token mode stays on API', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'api',
			sshEnabled: true,
			command: 'claude',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('api');
		expect(r.remote).toBeFalsy();
	});

	it('SSH-enabled claude with interactive token mode resolves to remote interactive', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			command: 'claude',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('interactive');
		expect(r.remote).toBe(true);
		// No LOCAL openwizardai-p script is used for remote spawns; openwizardai-p runs on
		// the remote host.
		expect(r.openwizardaiPBinPath).toBeNull();
	});

	it('SSH-enabled claude with dynamic token mode falls back to API (no remote quota signal)', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'dynamic',
			sshEnabled: true,
			command: 'claude',
			// Dynamic is not a valid remote choice (the selector hides it); the
			// local snapshot says nothing about the remote account, so dynamic must
			// NOT silently drive the remote TUI / spend Max quota - it resolves api.
			deps: makeDeps({ getUsageSnapshot: () => healthySnapshot() }),
			now: NOW,
		});
		expect(r.mode).toBe('api');
		expect(r.remote).toBeFalsy();
	});

	it('SSH-enabled interactive falls back to API when the remote has no openwizardai-p (known-absent)', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			sshRemoteId: 'remote-1',
			command: 'claude',
			now: NOW,
			// Probe determined openwizardai-p is NOT on the remote PATH: spawning it would
			// exit 127 on every turn, so the resolver must fall back to API.
			deps: makeDeps({ getRemoteOpenWizardAIPAvailable: () => false }),
		});
		expect(r.mode).toBe('api');
		expect(r.remote).toBeFalsy();
		expect(r.openwizardaiPBinPath).toBeNull();
	});

	it('SSH-enabled interactive stays remote when the remote has openwizardai-p (known-present)', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			sshRemoteId: 'remote-1',
			command: 'claude',
			now: NOW,
			deps: makeDeps({ getRemoteOpenWizardAIPAvailable: () => true }),
		});
		expect(r.mode).toBe('interactive');
		expect(r.remote).toBe(true);
	});

	it('SSH-enabled interactive stays remote when remote openwizardai-p availability is unknown (optimistic)', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			sshRemoteId: 'remote-1',
			command: 'claude',
			now: NOW,
			deps: makeDeps({ getRemoteOpenWizardAIPAvailable: () => undefined }),
		});
		expect(r.mode).toBe('interactive');
		expect(r.remote).toBe(true);
	});

	it('SSH-enabled remote interactive carries a custom remote claude path as the real bin', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			command: 'claude',
			sessionCustomPath: '/remote/bin/claude',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.remote).toBe(true);
		expect(r.claudeRealBinPath).toBe('/remote/bin/claude');
	});

	it('SSH remote interactive does NOT forward a openwizardai-p custom path as the real bin (self-spawn guard)', () => {
		// Regression: when the agent's binary IS openwizardai-p, forwarding it as
		// OPENWIZARDAI_CLAUDE_BIN makes the remote openwizardai-p drive itself in the PTY -
		// the claude child exits instantly and the turn dies as `tui_exited`.
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: true,
			command: 'claude',
			sessionCustomPath: '/usr/local/bin/openwizardai-p',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.remote).toBe(true);
		// Undefined → remote openwizardai-p defaults to `claude` on its PATH.
		expect(r.claudeRealBinPath).toBeUndefined();
	});

	it('local interactive does NOT use a openwizardai-p custom path as the real bin (self-spawn guard)', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: false,
			command: 'claude',
			sessionCustomPath: '/custom/openwizardai-p',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('interactive');
		// Falls back to the resolved command (real claude), not the openwizardai-p path.
		expect(r.claudeRealBinPath).toBe('claude');
	});

	it('local interactive with openwizardai-p as BOTH command and custom path leaves the real bin unset', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: false,
			command: '/custom/openwizardai-p',
			sessionCustomPath: '/custom/openwizardai-p',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('interactive');
		// Both are openwizardai-p → undefined so openwizardai-p defaults to `claude` on PATH.
		expect(r.claudeRealBinPath).toBeUndefined();
	});

	it('api mode resolves to api', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'api',
			sshEnabled: false,
			command: 'claude',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('api');
		expect(r.openwizardaiPBinPath).toBeNull();
	});

	it('interactive mode always resolves to interactive regardless of usage', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: false,
			command: '/bin/claude',
			now: NOW,
			deps: makeDeps({ getUsageSnapshot: () => limitedSnapshot() }),
		});
		expect(r.mode).toBe('interactive');
		expect(r.openwizardaiPBinPath).toBe('/bundled/openwizardai-p.js');
		expect(r.claudeRealBinPath).toBe('/bin/claude');
	});

	it('dynamic mode picks interactive when under the usage threshold', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'dynamic',
			sshEnabled: false,
			command: 'claude',
			now: NOW,
			deps: makeDeps({ getUsageSnapshot: () => healthySnapshot() }),
		});
		expect(r.mode).toBe('interactive');
		expect(r.reason).toBe('auto');
	});

	it('dynamic mode falls back to api when a window is at the limit', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'dynamic',
			sshEnabled: false,
			command: 'claude',
			now: NOW,
			deps: makeDeps({ getUsageSnapshot: () => limitedSnapshot() }),
		});
		expect(r.mode).toBe('api');
		expect(r.reason).toBe('limit');
	});

	it('dynamic mode holds the api fallback stickily while a window stays open', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'dynamic',
			sshEnabled: false,
			command: 'claude',
			persisted: { mode: 'api', modeReason: 'limit' },
			now: NOW,
			deps: makeDeps({ getUsageSnapshot: () => healthySnapshot() }),
		});
		expect(r.mode).toBe('api');
		expect(r.reason).toBe('limit');
	});

	it('falls back to api when the openwizardai-p binary cannot be found', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'interactive',
			sshEnabled: false,
			command: 'claude',
			now: NOW,
			deps: makeDeps({ getOpenWizardAIPBinPath: () => null, fileExists: () => false }),
		});
		expect(r.mode).toBe('api');
		expect(r.openwizardaiPBinPath).toBeNull();
	});

	it('detects a openwizardai-p binary wired directly into the Path under api mode', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'api',
			sshEnabled: false,
			command: '/custom/openwizardai-p',
			sessionCustomPath: '/custom/openwizardai-p',
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('interactive');
		expect(r.directBinary).toBe(true);
		expect(r.openwizardaiPBinPath).toBeNull();
		expect(r.configDirKey).toBe('key');
	});

	it('surfaces a config-dir key in api mode when clearing a stale interactive state', () => {
		const r = resolveClaudeSpawnMode({
			agent: claudeAgent,
			tokenMode: 'api',
			sshEnabled: false,
			command: 'claude',
			persisted: { mode: 'interactive' },
			now: NOW,
			deps: makeDeps(),
		});
		expect(r.mode).toBe('api');
		expect(r.configDirKey).toBe('key');
	});
});

describe('applyClaudeSpawnDecision (batch surfaces)', () => {
	it('runs openwizardai-p via execPath, prepends its flags, preserves the prompt args, and injects OPENWIZARDAI_CLAUDE_BIN + ELECTRON_RUN_AS_NODE', () => {
		const result = applyClaudeSpawnDecision({
			decision: {
				mode: 'interactive',
				reason: 'auto',
				openwizardaiPBinPath: '/bundled/openwizardai-p.js',
				claudeRealBinPath: '/bin/claude',
			},
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			command: 'claude',
			args: ['--print', '--verbose', '--output-format', 'stream-json', '--', 'hello there'],
			customEnvVars: { FOO: 'bar' },
			execPath: '/usr/bin/node',
		});
		expect(result.command).toBe('/usr/bin/node');
		// openwizardai-p script + its flags prepended; the original args (incl. the
		// prompt after `--`) are forwarded verbatim for openwizardai-p to parse.
		expect(result.args).toEqual([
			'/bundled/openwizardai-p.js',
			'--dangerously-skip-permissions',
			'--print',
			'--verbose',
			'--output-format',
			'stream-json',
			'--',
			'hello there',
		]);
		// ELECTRON_RUN_AS_NODE=1 is mandatory: command is `process.execPath` (the
		// Electron binary in a packaged app), which would otherwise launch a GUI
		// instead of running openwizardai-p.js as Node. NODE_PATH is only added when
		// `process.resourcesPath` is set (packaged); in the test env it is not, so
		// it must be absent here.
		expect(result.customEnvVars).toEqual({
			FOO: 'bar',
			OPENWIZARDAI_CLAUDE_BIN: '/bin/claude',
			ELECTRON_RUN_AS_NODE: '1',
		});
	});

	it('injects --max-wait (rounded up) before the openwizardai-p flags when maxWaitSeconds is given', () => {
		const result = applyClaudeSpawnDecision({
			decision: {
				mode: 'interactive',
				reason: 'auto',
				openwizardaiPBinPath: '/bundled/openwizardai-p.js',
				claudeRealBinPath: '/bin/claude',
			},
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			command: 'claude',
			args: ['--print', '--', 'hello there'],
			execPath: '/usr/bin/node',
			maxWaitSeconds: 3599.4,
		});
		// --max-wait must land AFTER the script but BEFORE the batch args, which
		// terminate with `-- <prompt>` (anything after `--` is read as the prompt
		// positional, not a flag). Value is ceil()'d to a whole second.
		expect(result.args).toEqual([
			'/bundled/openwizardai-p.js',
			'--max-wait',
			'3600',
			'--dangerously-skip-permissions',
			'--print',
			'--',
			'hello there',
		]);
	});

	it('omits --max-wait when maxWaitSeconds is absent or non-positive', () => {
		const base = {
			decision: {
				mode: 'interactive' as const,
				reason: 'auto' as const,
				openwizardaiPBinPath: '/bundled/openwizardai-p.js',
				claudeRealBinPath: '/bin/claude',
			},
			interactiveModeArgs: [],
			command: 'claude',
			args: ['--print', '--', 'hi'],
			execPath: '/usr/bin/node',
		};
		expect(applyClaudeSpawnDecision(base).args).toEqual([
			'/bundled/openwizardai-p.js',
			'--print',
			'--',
			'hi',
		]);
		expect(applyClaudeSpawnDecision({ ...base, maxWaitSeconds: 0 }).args).toEqual([
			'/bundled/openwizardai-p.js',
			'--print',
			'--',
			'hi',
		]);
	});

	it('adds NODE_PATH to the unpacked modules dir when running packaged (resourcesPath set)', () => {
		const original = process.resourcesPath;
		try {
			// Simulate a packaged app: resourcesPath points at the app Resources dir.
			Object.defineProperty(process, 'resourcesPath', {
				value: '/Applications/OpenWizardAI.app/Contents/Resources',
				configurable: true,
			});
			const result = applyClaudeSpawnDecision({
				decision: {
					mode: 'interactive',
					reason: 'auto',
					openwizardaiPBinPath: '/res/openwizardai-p.js',
					claudeRealBinPath: '/bin/claude',
				},
				interactiveModeArgs: [],
				command: 'claude',
				args: ['--print', '--', 'hi'],
				execPath: '/Applications/OpenWizardAI.app/Contents/MacOS/OpenWizardAI',
			});
			expect(result.customEnvVars?.ELECTRON_RUN_AS_NODE).toBe('1');
			// NODE_PATH must point at the IN-ASAR node_modules, not the unpacked
			// copy: node-pty rewrites 'app.asar' -> 'app.asar.unpacked' for its
			// spawn-helper, so handing it the unpacked path double-applies and the
			// helper exec fails (posix_spawn ENOENT).
			expect(result.customEnvVars?.NODE_PATH).toBe(
				'/Applications/OpenWizardAI.app/Contents/Resources/app.asar/node_modules'
			);
		} finally {
			Object.defineProperty(process, 'resourcesPath', {
				value: original,
				configurable: true,
			});
		}
	});

	it('passes through unchanged for api mode', () => {
		const result = applyClaudeSpawnDecision({
			decision: { mode: 'api', reason: 'auto', openwizardaiPBinPath: null },
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			command: 'claude',
			args: ['--print', '--', 'hi'],
		});
		expect(result.command).toBe('claude');
		expect(result.args).toEqual(['--print', '--', 'hi']);
	});

	it('passes through unchanged for direct-binary interactive (no execPath wrap)', () => {
		const result = applyClaudeSpawnDecision({
			decision: {
				mode: 'interactive',
				reason: 'auto',
				openwizardaiPBinPath: null,
				directBinary: true,
			},
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			command: '/custom/openwizardai-p',
			args: ['--print', '--', 'hi'],
		});
		expect(result.command).toBe('/custom/openwizardai-p');
		expect(result.args).toEqual(['--print', '--', 'hi']);
	});
});

describe('buildRemoteInteractiveSpawn (SSH remote surfaces)', () => {
	it('returns null for an API decision (leave SSH config untouched)', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: { mode: 'api', reason: 'auto', openwizardaiPBinPath: null },
			interactiveModeArgs: ['--dangerously-skip-permissions'],
		});
		expect(result).toBeNull();
	});

	it('returns null for a LOCAL interactive decision (not remote)', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: {
				mode: 'interactive',
				reason: 'auto',
				openwizardaiPBinPath: '/bundled/openwizardai-p.js',
			},
			interactiveModeArgs: ['--dangerously-skip-permissions'],
		});
		expect(result).toBeNull();
	});

	it('swaps the command to openwizardai-p and prepends the interactive flags for a remote decision', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: { mode: 'interactive', reason: 'auto', openwizardaiPBinPath: null, remote: true },
			interactiveModeArgs: ['--dangerously-skip-permissions'],
		});
		expect(result).not.toBeNull();
		expect(result!.command).toBe(REMOTE_OPENWIZARDAI_P_COMMAND);
		expect(result!.prependArgs).toEqual(['--dangerously-skip-permissions']);
		// No OPENWIZARDAI_CLAUDE_BIN when no custom remote claude path: openwizardai-p
		// defaults to `claude` on the remote PATH.
		expect(result!.env).toEqual({});
	});

	it('points OPENWIZARDAI_CLAUDE_BIN at a custom remote claude path when provided', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: {
				mode: 'interactive',
				reason: 'auto',
				openwizardaiPBinPath: null,
				remote: true,
				claudeRealBinPath: '/remote/bin/claude',
			},
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			remoteClaudeBin: '/remote/bin/claude',
		});
		expect(result!.env).toEqual({ OPENWIZARDAI_CLAUDE_BIN: '/remote/bin/claude' });
	});

	it('injects --max-wait ahead of the interactive flags for background surfaces', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: { mode: 'interactive', reason: 'auto', openwizardaiPBinPath: null, remote: true },
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			maxWaitSeconds: 600,
		});
		expect(result!.prependArgs).toEqual(['--max-wait', '600', '--dangerously-skip-permissions']);
	});

	it('omits --max-wait when no positive budget is given', () => {
		const result = buildRemoteInteractiveSpawn({
			decision: { mode: 'interactive', reason: 'auto', openwizardaiPBinPath: null, remote: true },
			interactiveModeArgs: ['--dangerously-skip-permissions'],
			maxWaitSeconds: 0,
		});
		expect(result!.prependArgs).toEqual(['--dangerously-skip-permissions']);
	});
});
