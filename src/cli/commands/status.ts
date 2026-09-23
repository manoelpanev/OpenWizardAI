// Status command - check if OpenWizardAI desktop app is running and reachable

import { readCliServerInfo, isCliServerRunning } from '../../shared/cli-server-discovery';
import { withOpenWizardAIClient } from '../services/openwizardai-client';
import { ExitCode } from '../exit-codes';

export async function status(): Promise<void> {
	const info = readCliServerInfo();
	if (!info) {
		console.log('OpenWizardAI desktop app is not running');
		process.exit(ExitCode.NotRunning);
	}

	if (!isCliServerRunning()) {
		console.log('OpenWizardAI discovery file is stale (app may have crashed)');
		process.exit(ExitCode.NotRunning);
	}

	try {
		// Ping to verify WebSocket connectivity
		await withOpenWizardAIClient(async (client) => {
			await client.sendCommand<{ type: string }>({ type: 'ping' }, 'pong');

			// Get session count
			const sessionsResult = await client.sendCommand<{ type: string; sessions: unknown[] }>(
				{ type: 'get_sessions' },
				'sessions_list'
			);

			const sessionCount = sessionsResult.sessions?.length ?? 0;
			console.log(
				`OpenWizardAI is running on port ${info.port} with ${sessionCount} agent${sessionCount !== 1 ? 's' : ''}`
			);
		});
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(ExitCode.NotRunning);
	}
}
