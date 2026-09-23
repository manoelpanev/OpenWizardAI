/**
 * Preload API for the DeepSeek connection (API key status, save, remove).
 */

import { ipcRenderer } from 'electron';

export interface DeepSeekStatus {
	configured: boolean;
	encryptionAvailable: boolean;
	/** Last four characters of the saved key */
	keyHint: string | null;
}

export type DeepSeekSaveResult =
	| { success: true; status: DeepSeekStatus }
	| { success: false; error: string };

export function createDeepSeekApi() {
	return {
		getStatus: (): Promise<DeepSeekStatus> => ipcRenderer.invoke('deepseek:getStatus'),
		saveApiKey: (apiKey: string): Promise<DeepSeekSaveResult> =>
			ipcRenderer.invoke('deepseek:saveApiKey', apiKey),
		clearApiKey: (): Promise<DeepSeekStatus> => ipcRenderer.invoke('deepseek:clearApiKey'),
	};
}

export type DeepSeekApi = ReturnType<typeof createDeepSeekApi>;
