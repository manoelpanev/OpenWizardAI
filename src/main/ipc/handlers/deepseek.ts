/**
 * DeepSeek IPC handlers: connect, inspect and remove the DeepSeek API key.
 * The key itself only ever travels renderer -> main when the user saves it;
 * nothing sends it back.
 */

import { ipcMain } from 'electron';
import { withIpcErrorLogging, type CreateHandlerOptions } from '../../utils/ipcHandler';
import {
	clearDeepSeekApiKey,
	getDeepSeekStatus,
	saveDeepSeekApiKey,
} from '../../deepseek/credentials';

const LOG_CONTEXT = '[DeepSeek]';

const handlerOpts = (
	operation: string
): Pick<CreateHandlerOptions, 'context' | 'operation' | 'logSuccess'> => ({
	context: LOG_CONTEXT,
	operation,
	logSuccess: false,
});

export function registerDeepSeekHandlers(): void {
	ipcMain.handle(
		'deepseek:getStatus',
		withIpcErrorLogging(handlerOpts('getStatus'), async () => getDeepSeekStatus())
	);
	ipcMain.handle(
		'deepseek:saveApiKey',
		withIpcErrorLogging(handlerOpts('saveApiKey'), async (apiKey: string) =>
			saveDeepSeekApiKey(typeof apiKey === 'string' ? apiKey : '')
		)
	);
	ipcMain.handle(
		'deepseek:clearApiKey',
		withIpcErrorLogging(handlerOpts('clearApiKey'), async () => clearDeepSeekApiKey())
	);
}
