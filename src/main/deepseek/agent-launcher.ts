/**
 * Launcher for the bundled DeepSeek agent (dist/cli/openwizardai-agent.js).
 *
 * Agents are spawned as executables, so the app writes a tiny script into its
 * data folder that runs the bundled agent with Electron's own Node runtime
 * (ELECTRON_RUN_AS_NODE). Nothing is installed on the user's PATH.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '../../shared/platformDetection';
import { logger } from '../utils/logger';

const LOG_CONTEXT = 'DeepSeek';
const SCRIPT_NAME = 'openwizardai-agent.js';

function findBundledScript(): string | null {
	const candidates = [
		path.join(process.resourcesPath ?? '', SCRIPT_NAME),
		path.resolve(app.getAppPath(), 'dist', 'cli', SCRIPT_NAME),
		path.resolve(__dirname, '..', '..', 'cli', SCRIPT_NAME),
	];
	return candidates.find((c) => fs.existsSync(c)) ?? null;
}

/**
 * Write (or refresh) the launcher and return its path, or null when the bundled
 * agent script is missing from this build.
 */
export function ensureDeepSeekAgentLauncher(): string | null {
	const script = findBundledScript();
	if (!script) {
		logger.warn(`Bundled ${SCRIPT_NAME} not found; DeepSeek agent unavailable`, LOG_CONTEXT);
		return null;
	}
	const binDir = path.join(app.getPath('userData'), 'bin');
	fs.mkdirSync(binDir, { recursive: true });

	const runtime = process.execPath;
	let launcher: string;
	let content: string;
	if (isWindows()) {
		launcher = path.join(binDir, 'openwizardai-agent.cmd');
		content = `@echo off\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"${runtime}" "${script}" %*\r\n`;
	} else {
		const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
		launcher = path.join(binDir, 'openwizardai-agent');
		content = `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${q(runtime)} ${q(script)} "$@"\n`;
	}

	const current = fs.existsSync(launcher) ? fs.readFileSync(launcher, 'utf8') : null;
	if (current !== content) {
		fs.writeFileSync(launcher, content, 'utf8');
		if (!isWindows()) fs.chmodSync(launcher, 0o755);
		logger.info('DeepSeek agent launcher written', LOG_CONTEXT, { launcher, script });
	}
	return launcher;
}
