/**
 * Output parser for OpenWizardAI's own DeepSeek agent (`openwizardai-agent`).
 *
 * The agent writes one JSON object per line (see src/main/deepseek-agent/loop.ts):
 * - { type: 'init', session_id, model, cwd }
 * - { type: 'reasoning', text }                  streamed chain of thought
 * - { type: 'text', text }                       streamed answer text
 * - { type: 'tool_use', id, name, input }
 * - { type: 'tool_result', id, name, output, is_error }
 * - { type: 'result', session_id, text, usage, cost_usd, steps }
 * - { type: 'error', message, code, session_id? }
 */

import type { ToolType, AgentError } from '../../shared/types';
import type { AgentOutputParser, ParsedEvent } from './agent-output-parser';
import { getErrorPatterns, matchErrorPattern } from './error-patterns';

/** DeepSeek V4 context window (1M tokens) */
export const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;

interface DeepSeekRawEvent {
	type?: string;
	session_id?: string;
	text?: string;
	id?: string;
	name?: string;
	input?: unknown;
	output?: string;
	is_error?: boolean;
	message?: string;
	code?: string;
	cost_usd?: number;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		cacheHitTokens?: number;
		reasoningTokens?: number;
	};
}

const ERROR_TYPES: Record<string, AgentError['type']> = {
	auth: 'auth_expired',
	balance: 'rate_limited',
	rate_limit: 'rate_limited',
	network: 'network_error',
	server: 'network_error',
};

export class DeepSeekOutputParser implements AgentOutputParser {
	readonly agentId: ToolType = 'deepseek';

	parseJsonLine(line: string): ParsedEvent | null {
		if (!line.trim()) return null;
		try {
			return this.parseJsonObject(JSON.parse(line));
		} catch {
			return { type: 'text', text: line, raw: line };
		}
	}

	parseJsonObject(parsed: unknown): ParsedEvent | null {
		if (!parsed || typeof parsed !== 'object') return null;
		const msg = parsed as DeepSeekRawEvent;
		switch (msg.type) {
			case 'init':
				return { type: 'init', sessionId: msg.session_id, raw: msg };
			case 'reasoning':
				return {
					type: 'text',
					text: msg.text ?? '',
					isPartial: true,
					isReasoning: true,
					raw: msg,
				};
			case 'text':
				return { type: 'text', text: msg.text ?? '', isPartial: true, raw: msg };
			case 'tool_use':
				return {
					type: 'tool_use',
					toolName: msg.name,
					toolCallId: msg.id,
					toolState: { status: 'running', input: msg.input },
					raw: msg,
				};
			case 'tool_result':
				return {
					type: 'tool_use',
					toolName: msg.name,
					toolCallId: msg.id,
					toolState: { status: msg.is_error ? 'failed' : 'completed', output: msg.output },
					raw: msg,
				};
			case 'result':
				return {
					type: 'result',
					text: msg.text ?? '',
					sessionId: msg.session_id,
					usage: this.usageOf(msg),
					raw: msg,
				};
			case 'error':
				return { type: 'error', text: msg.message ?? '', sessionId: msg.session_id, raw: msg };
			default:
				return { type: 'system', sessionId: msg.session_id, raw: msg };
		}
	}

	private usageOf(msg: DeepSeekRawEvent): ParsedEvent['usage'] | undefined {
		if (!msg.usage) return undefined;
		return {
			inputTokens: msg.usage.inputTokens ?? 0,
			outputTokens: msg.usage.outputTokens ?? 0,
			cacheReadTokens: msg.usage.cacheHitTokens ?? 0,
			reasoningTokens: msg.usage.reasoningTokens ?? 0,
			contextWindow: DEEPSEEK_CONTEXT_WINDOW,
			costUsd: msg.cost_usd ?? 0,
		};
	}

	isResultMessage(event: ParsedEvent): boolean {
		return event.type === 'result';
	}

	extractSessionId(event: ParsedEvent): string | null {
		return event.sessionId || null;
	}

	extractUsage(event: ParsedEvent): ParsedEvent['usage'] | null {
		return event.usage || null;
	}

	extractSlashCommands(_event: ParsedEvent): string[] | null {
		return null;
	}

	detectErrorFromLine(line: string): AgentError | null {
		if (!line.trim().startsWith('{')) return null;
		try {
			return this.detectErrorFromParsed(JSON.parse(line));
		} catch {
			return null;
		}
	}

	detectErrorFromParsed(parsed: unknown): AgentError | null {
		if (!parsed || typeof parsed !== 'object') return null;
		const msg = parsed as DeepSeekRawEvent;
		if (msg.type !== 'error' || msg.code === 'aborted') return null;
		const type = ERROR_TYPES[msg.code ?? ''] ?? 'unknown';
		return {
			type,
			message:
				msg.code === 'balance'
					? 'Your DeepSeek account balance is used up. Top it up at platform.deepseek.com.'
					: msg.message || 'DeepSeek agent error',
			recoverable: type !== 'auth_expired',
			agentId: this.agentId,
			timestamp: Date.now(),
			parsedJson: msg,
		};
	}

	detectErrorFromExit(exitCode: number, stderr: string, stdout: string): AgentError | null {
		if (exitCode === 0) return null;
		// An error event on stdout already produced a specific AgentError.
		if (stdout.includes('"type":"error"')) return null;
		const match = matchErrorPattern(getErrorPatterns(this.agentId), stderr);
		if (match) {
			return {
				type: match.type,
				message: match.message,
				recoverable: match.recoverable,
				agentId: this.agentId,
				timestamp: Date.now(),
				raw: { exitCode, stderr, stdout },
			};
		}
		const lastLine = stderr.trim().split('\n').pop() || `Exited with code ${exitCode}`;
		return {
			type: 'agent_crashed',
			message: `DeepSeek agent stopped: ${lastLine}`,
			recoverable: true,
			agentId: this.agentId,
			timestamp: Date.now(),
			raw: { exitCode, stderr, stdout },
		};
	}
}
