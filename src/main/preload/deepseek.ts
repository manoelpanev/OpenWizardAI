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

export interface WizardPanelMessage {
	role: 'user' | 'assistant';
	text: string;
}

/** Events streamed during a wizard turn (same shape as the DeepSeek agent's JSONL events). */
export type WizardPanelEvent =
	| { type: 'init'; session_id: string; model: string; cwd: string }
	| { type: 'reasoning'; text: string }
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: unknown }
	| { type: 'tool_result'; id: string; name: string; output: string; is_error: boolean }
	| { type: 'result'; session_id: string; text: string; cost_usd: number; steps: number }
	| { type: 'error'; message: string; code: string };

export function createWizardPanelApi() {
	return {
		getHistory: (projectPath: string): Promise<WizardPanelMessage[]> =>
			ipcRenderer.invoke('wizardPanel:getHistory', projectPath),
		send: (requestId: string, projectPath: string, text: string): Promise<{ ok: boolean }> =>
			ipcRenderer.invoke('wizardPanel:send', requestId, projectPath, text),
		stop: (requestId: string): Promise<boolean> =>
			ipcRenderer.invoke('wizardPanel:stop', requestId),
		reset: (projectPath: string): Promise<boolean> =>
			ipcRenderer.invoke('wizardPanel:reset', projectPath),
		onEvent: (callback: (requestId: string, event: WizardPanelEvent) => void): (() => void) => {
			const handler = (_e: Electron.IpcRendererEvent, requestId: string, event: WizardPanelEvent) =>
				callback(requestId, event);
			ipcRenderer.on('wizardPanel:event', handler);
			return () => ipcRenderer.removeListener('wizardPanel:event', handler);
		},
	};
}

export type WizardPanelApi = ReturnType<typeof createWizardPanelApi>;
