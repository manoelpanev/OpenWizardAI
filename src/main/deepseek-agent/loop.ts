/**
 * The agent turn: send the conversation to DeepSeek, run the tools it asks for,
 * feed the results back, and repeat until it answers without tool calls.
 * Sessions are stored as JSON so a later turn can resume the conversation.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	streamCompletion,
	type ChatMessage,
	type ReasoningEffort,
	type Usage,
} from './deepseek-client';
import { executeTool, toolSchemas } from './tools';

/** Upper bound on model round trips per turn, so a confused model cannot loop forever. */
const MAX_STEPS = 60;

/** USD per 1M tokens at peak prices. Cache-hit input is billed at its own rate. */
const PRICES: Record<string, { input: number; cacheHit: number; output: number }> = {
	'deepseek-flash': { input: 0.3, cacheHit: 0.006, output: 1.2 },
	'deepseek-v4-pro': { input: 1.32, cacheHit: 0.044, output: 3.96 },
};

export interface StoredSession {
	id: string;
	model: string;
	cwd: string;
	/** ISO-8601 */
	createdAt: string;
	/** ISO-8601 */
	updatedAt: string;
	messages: ChatMessage[];
}

export type AgentEvent =
	| { type: 'init'; session_id: string; model: string; cwd: string }
	| { type: 'reasoning'; text: string }
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: unknown }
	| { type: 'tool_result'; id: string; name: string; output: string; is_error: boolean }
	| {
			type: 'result';
			session_id: string;
			text: string;
			usage: Usage;
			cost_usd: number;
			steps: number;
	  }
	| { type: 'error'; message: string; code: string; session_id?: string };

export interface TurnOptions {
	apiKey: string;
	prompt: string;
	cwd: string;
	model: string;
	effort: ReasoningEffort;
	thinking: boolean;
	readOnly: boolean;
	sessionId?: string;
	systemPrompt?: string;
	signal?: AbortSignal;
	emit: (event: AgentEvent) => void;
}

function appDataDir(): string {
	if (process.env.OPENWIZARDAI_USER_DATA) return process.env.OPENWIZARDAI_USER_DATA;
	const home = os.homedir();
	if (process.platform === 'darwin') {
		return path.join(home, 'Library', 'Application Support', 'OpenWizardAI');
	}
	if (process.platform === 'win32') {
		return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'OpenWizardAI');
	}
	return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'OpenWizardAI');
}

export function sessionsDir(): string {
	return path.join(appDataDir(), 'deepseek-sessions');
}

function isValidSessionId(id: string): boolean {
	return /^[\w-]{1,128}$/.test(id);
}

export function loadSession(id: string): StoredSession | null {
	if (!isValidSessionId(id)) return null;
	try {
		return JSON.parse(
			fs.readFileSync(path.join(sessionsDir(), `${id}.json`), 'utf8')
		) as StoredSession;
	} catch {
		return null;
	}
}

function saveSession(session: StoredSession): void {
	fs.mkdirSync(sessionsDir(), { recursive: true });
	session.updatedAt = new Date().toISOString();
	const file = path.join(sessionsDir(), `${session.id}.json`);
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(session), 'utf8');
	fs.renameSync(tmp, file);
}

/**
 * A turn that died between a tool request and its results leaves tool calls
 * without answers, which the API rejects. Answer them so the session resumes.
 */
function closeDanglingToolCalls(messages: ChatMessage[]): void {
	const answered = new Set(
		messages
			.filter((m) => m.role === 'tool')
			.map((m) => (m as { tool_call_id: string }).tool_call_id)
	);
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role !== 'assistant' || !m.tool_calls) continue;
		for (const call of m.tool_calls) {
			if (!answered.has(call.id)) {
				messages.push({
					role: 'tool',
					tool_call_id: call.id,
					content: 'Interrupted before this tool finished. Run it again if it is still needed.',
				});
			}
		}
		break;
	}
}

export function defaultSystemPrompt(cwd: string, readOnly: boolean): string {
	return [
		'You are the OpenWizardAI coding agent, powered by DeepSeek.',
		`You work inside the project folder ${cwd} on ${process.platform}.`,
		'',
		'You have real tools and you must use them:',
		'- list_dir, read_file and search let you inspect any file. You CAN read and evaluate file contents; never claim you cannot.',
		readOnly
			? '- This turn is read-only: you may inspect files but must not change anything. Describe the changes instead.'
			: '- write_file, edit_file and run_command let you change files and run tests, builds and git inside the project folder.',
		'',
		'Working rules:',
		'1. Look before you answer: read the relevant files instead of guessing.',
		'2. Make the smallest change that solves the task, matching the style of the surrounding code.',
		'3. After changing code, run the tests or build when the project has them, and report the real result.',
		'4. Never invent file contents, command output or test results. If something failed, say so plainly.',
		'5. Finish with a short summary: what changed, where, and anything left to do.',
	].join('\n');
}

function costOf(model: string, usage: Usage): number {
	const price = PRICES[model] ?? PRICES['deepseek-flash'];
	const missed = Math.max(usage.inputTokens - usage.cacheHitTokens, 0);
	return (
		(missed * price.input +
			usage.cacheHitTokens * price.cacheHit +
			usage.outputTokens * price.output) /
		1_000_000
	);
}

function errorCode(error: unknown): string {
	if (error && typeof error === 'object' && 'code' in error) {
		return String((error as { code: unknown }).code);
	}
	return 'unknown';
}

/** Run one user turn to completion. Errors are emitted as events, never thrown. */
export async function runAgentTurn(opts: TurnOptions): Promise<{ sessionId: string; ok: boolean }> {
	const existing = opts.sessionId ? loadSession(opts.sessionId) : null;
	const now = new Date().toISOString();
	const session: StoredSession = existing ?? {
		id: opts.sessionId && isValidSessionId(opts.sessionId) ? opts.sessionId : `ds-${randomUUID()}`,
		model: opts.model,
		cwd: opts.cwd,
		createdAt: now,
		updatedAt: now,
		messages: [
			{
				role: 'system',
				content: opts.systemPrompt ?? defaultSystemPrompt(opts.cwd, opts.readOnly),
			},
		],
	};
	session.model = opts.model;
	closeDanglingToolCalls(session.messages);
	session.messages.push({ role: 'user', content: opts.prompt });
	opts.emit({ type: 'init', session_id: session.id, model: opts.model, cwd: opts.cwd });

	const total: Usage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, reasoningTokens: 0 };
	const tools = toolSchemas(opts.readOnly);
	let finalText = '';

	try {
		for (let step = 1; step <= MAX_STEPS; step++) {
			const { message, usage } = await streamCompletion(
				{
					apiKey: opts.apiKey,
					model: opts.model,
					messages: session.messages,
					tools,
					thinking: opts.thinking,
					effort: opts.effort,
					signal: opts.signal,
				},
				{
					onReasoning: (text) => opts.emit({ type: 'reasoning', text }),
					onText: (text) => opts.emit({ type: 'text', text }),
				}
			);
			total.inputTokens += usage.inputTokens;
			total.outputTokens += usage.outputTokens;
			total.cacheHitTokens += usage.cacheHitTokens;
			total.reasoningTokens += usage.reasoningTokens;
			session.messages.push(message);
			if (message.content) finalText = message.content;

			if (!message.tool_calls || message.tool_calls.length === 0) {
				saveSession(session);
				opts.emit({
					type: 'result',
					session_id: session.id,
					text: finalText,
					usage: total,
					cost_usd: costOf(opts.model, total),
					steps: step,
				});
				return { sessionId: session.id, ok: true };
			}

			for (const call of message.tool_calls) {
				let input: unknown = call.function.arguments;
				try {
					input = JSON.parse(call.function.arguments || '{}');
				} catch {
					// pass the raw string through; executeTool reports the parse error
				}
				opts.emit({ type: 'tool_use', id: call.id, name: call.function.name, input });
				const outcome = await executeTool(
					{ cwd: opts.cwd, readOnly: opts.readOnly, signal: opts.signal },
					call.function.name,
					call.function.arguments
				);
				opts.emit({
					type: 'tool_result',
					id: call.id,
					name: call.function.name,
					output: outcome.output,
					is_error: outcome.isError,
				});
				session.messages.push({ role: 'tool', tool_call_id: call.id, content: outcome.output });
			}
			saveSession(session);
		}
		saveSession(session);
		opts.emit({
			type: 'error',
			message: `Stopped after ${MAX_STEPS} steps without a final answer. Send "continue" to keep going.`,
			code: 'max_steps',
			session_id: session.id,
		});
		return { sessionId: session.id, ok: false };
	} catch (error) {
		saveSession(session);
		opts.emit({
			type: 'error',
			message: error instanceof Error ? error.message : String(error),
			code: opts.signal?.aborted ? 'aborted' : errorCode(error),
			session_id: session.id,
		});
		return { sessionId: session.id, ok: false };
	}
}
