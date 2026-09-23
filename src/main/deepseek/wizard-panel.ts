/**
 * Wizard panel: a DeepSeek companion that chats with the user about the current
 * project and walks them through creating it, step by step.
 *
 * Each project folder keeps its own conversation (a DeepSeek agent session),
 * remembered across restarts. Turns run in the main process through the same
 * agent loop as the DeepSeek agent; their events stream to the renderer on
 * `wizardPanel:event`.
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { randomUUID } from 'crypto';
import { runAgentTurn, loadSession, type AgentEvent } from '../deepseek-agent/loop';
import { DEEPSEEK_FLASH } from '../deepseek-agent/deepseek-client';
import { getDeepSeekApiKey } from './credentials';
import { withIpcErrorLogging, type CreateHandlerOptions } from '../utils/ipcHandler';
import { logger } from '../utils/logger';

const LOG_CONTEXT = '[WizardPanel]';

interface WizardPanelStoreData {
	/** Project folder -> DeepSeek session id of its wizard conversation */
	sessions: Record<string, string>;
}

export interface WizardMessage {
	role: 'user' | 'assistant';
	text: string;
}

let _store: Store<WizardPanelStoreData> | null = null;
const running = new Map<string, AbortController>();

function getStore(): Store<WizardPanelStoreData> {
	if (_store === null) {
		_store = new Store<WizardPanelStoreData>({
			name: 'wizard-panel',
			defaults: { sessions: {} },
		});
	}
	return _store;
}

function sessionFor(projectPath: string): string | undefined {
	return getStore().get('sessions', {})[projectPath];
}

export function wizardSystemPrompt(projectPath: string): string {
	return [
		'You are the OpenWizardAI Wizard: a calm, practical companion who guides the user through creating and building this project, step by step.',
		`The project folder is ${projectPath}.`,
		'',
		'How you work with the user:',
		'- Answer in the language the user writes in.',
		'- Keep replies short and concrete. Lead with the next action. Use numbered steps for anything with more than one step, at most five.',
		'- Ask at most one or two focused questions at a time, only when the answer changes what to do next.',
		'- End every reply with ONE concrete next step the user can do now.',
		'',
		'Your tools:',
		'- list_dir, read_file and search let you read the project. You CAN read and evaluate files; look before you advise instead of guessing.',
		'- write_file and edit_file let you create planning files. Keep the project plan in .openwizardai/PROJECT.md (goal, decisions, open questions).',
		'- When the user is ready to build, write an Auto Run playbook: a Markdown file in .openwizardai/playbooks/ made of "- [ ] task" checkboxes. OpenWizardAI runs each checkbox in a fresh agent session, so every task must be self-contained and testable. Tell the user to open the Auto Run tab to start it.',
		'- run_command can run tests, builds and git. Only change source code or run commands that modify things when the user asked for it.',
		'',
		'Honesty rules:',
		'- Never claim something works or was checked unless you saw the evidence (file contents, command output).',
		'- Mark guesses as assumptions. If a tool failed, say so plainly.',
	].join('\n');
}

/** Visible conversation for a project: user prompts and assistant replies only. */
export function getWizardHistory(projectPath: string): WizardMessage[] {
	const id = sessionFor(projectPath);
	const session = id ? loadSession(id) : null;
	if (!session) return [];
	const messages: WizardMessage[] = [];
	for (const m of session.messages) {
		if (m.role === 'user') messages.push({ role: 'user', text: m.content });
		if (m.role === 'assistant' && m.content) messages.push({ role: 'assistant', text: m.content });
	}
	return messages;
}

const handlerOpts = (
	operation: string
): Pick<CreateHandlerOptions, 'context' | 'operation' | 'logSuccess'> => ({
	context: LOG_CONTEXT,
	operation,
	logSuccess: false,
});

export function registerWizardPanelHandlers(): void {
	ipcMain.handle(
		'wizardPanel:getHistory',
		withIpcErrorLogging(handlerOpts('getHistory'), async (projectPath: string) =>
			getWizardHistory(projectPath)
		)
	);

	ipcMain.handle(
		'wizardPanel:reset',
		withIpcErrorLogging(handlerOpts('reset'), async (projectPath: string) => {
			const sessions = { ...getStore().get('sessions', {}) };
			delete sessions[projectPath];
			getStore().set('sessions', sessions);
			return true;
		})
	);

	ipcMain.handle(
		'wizardPanel:stop',
		withIpcErrorLogging(handlerOpts('stop'), async (requestId: string) => {
			running.get(requestId)?.abort();
			return true;
		})
	);

	ipcMain.handle(
		'wizardPanel:send',
		async (event, requestId: string, projectPath: string, text: string) => {
			const sender = event.sender;
			const emit = (e: AgentEvent) => {
				if (!sender.isDestroyed()) sender.send('wizardPanel:event', requestId, e);
			};
			const apiKey = getDeepSeekApiKey();
			if (!apiKey) {
				emit({
					type: 'error',
					message: 'Connect DeepSeek first (Cmd+K > Connect DeepSeek).',
					code: 'auth',
				});
				return { ok: false };
			}
			const controller = new AbortController();
			running.set(requestId, controller);
			try {
				const result = await runAgentTurn({
					apiKey,
					prompt: text,
					cwd: projectPath,
					model: DEEPSEEK_FLASH,
					effort: 'high',
					thinking: true,
					readOnly: false,
					sessionId: sessionFor(projectPath) ?? `wizard-${randomUUID()}`,
					systemPrompt: wizardSystemPrompt(projectPath),
					signal: controller.signal,
					emit,
				});
				getStore().set('sessions', {
					...getStore().get('sessions', {}),
					[projectPath]: result.sessionId,
				});
				return { ok: result.ok };
			} catch (error) {
				logger.error('Wizard turn failed', LOG_CONTEXT, { error: String(error) });
				emit({ type: 'error', message: String(error), code: 'unknown' });
				return { ok: false };
			} finally {
				running.delete(requestId);
			}
		}
	);
}
