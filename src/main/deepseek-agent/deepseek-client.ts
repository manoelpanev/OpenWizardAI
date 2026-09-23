/**
 * Minimal streaming client for the DeepSeek Chat Completions API (OpenAI format).
 *
 * Thinking mode with tools requires every earlier assistant turn to be sent back
 * with its `reasoning_content`, otherwise the API answers 400. Messages built by
 * this module always keep it.
 */

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/** Fast default model (DeepSeek V4.1 Flash) */
export const DEEPSEEK_FLASH = 'deepseek-flash';
/** Deeper model for large or tricky tasks (DeepSeek V4 Pro) */
export const DEEPSEEK_PRO = 'deepseek-v4-pro';

export type ReasoningEffort = 'low' | 'high' | 'max';

export interface ToolCall {
	id: string;
	type: 'function';
	function: { name: string; arguments: string };
}

export type ChatMessage =
	| { role: 'system'; content: string }
	| { role: 'user'; content: string }
	| {
			role: 'assistant';
			content: string | null;
			reasoning_content?: string;
			tool_calls?: ToolCall[];
	  }
	| { role: 'tool'; tool_call_id: string; content: string };

export interface ToolSchema {
	type: 'function';
	function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface Usage {
	inputTokens: number;
	outputTokens: number;
	cacheHitTokens: number;
	reasoningTokens: number;
}

export interface CompletionResult {
	message: Extract<ChatMessage, { role: 'assistant' }>;
	finishReason: string | null;
	usage: Usage;
}

export interface StreamHandlers {
	onText?: (delta: string) => void;
	onReasoning?: (delta: string) => void;
}

export class DeepSeekApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: 'auth' | 'rate_limit' | 'balance' | 'server' | 'bad_request' | 'network'
	) {
		super(message);
		this.name = 'DeepSeekApiError';
	}
}

function classifyStatus(status: number): DeepSeekApiError['code'] {
	if (status === 401 || status === 403) return 'auth';
	if (status === 402) return 'balance';
	if (status === 429) return 'rate_limit';
	if (status >= 500) return 'server';
	return 'bad_request';
}

export interface CompletionRequest {
	apiKey: string;
	model: string;
	messages: ChatMessage[];
	tools?: ToolSchema[];
	thinking: boolean;
	effort: ReasoningEffort;
	signal?: AbortSignal;
	baseUrl?: string;
}

interface StreamChunk {
	choices?: Array<{
		delta?: {
			content?: string | null;
			reasoning_content?: string | null;
			tool_calls?: Array<{
				index: number;
				id?: string;
				function?: { name?: string; arguments?: string };
			}>;
		};
		finish_reason?: string | null;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		prompt_cache_hit_tokens?: number;
		completion_tokens_details?: { reasoning_tokens?: number };
	} | null;
}

/** Stream one completion and assemble the assistant message it produced. */
export async function streamCompletion(
	req: CompletionRequest,
	handlers: StreamHandlers = {}
): Promise<CompletionResult> {
	const body: Record<string, unknown> = {
		model: req.model,
		messages: req.messages,
		stream: true,
		stream_options: { include_usage: true },
		thinking: { type: req.thinking ? 'enabled' : 'disabled' },
	};
	if (req.thinking) body.reasoning_effort = req.effort;
	if (req.tools && req.tools.length > 0) body.tools = req.tools;

	let response: Response;
	try {
		response = await fetch(`${req.baseUrl ?? DEEPSEEK_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${req.apiKey}`,
			},
			body: JSON.stringify(body),
			signal: req.signal,
		});
	} catch (error) {
		throw new DeepSeekApiError(
			`Could not reach DeepSeek: ${error instanceof Error ? error.message : String(error)}`,
			0,
			'network'
		);
	}

	if (!response.ok || !response.body) {
		const text = await response.text().catch(() => '');
		let detail = text;
		try {
			detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
		} catch {
			// keep raw text
		}
		throw new DeepSeekApiError(
			`DeepSeek API error ${response.status}: ${detail || response.statusText}`,
			response.status,
			classifyStatus(response.status)
		);
	}

	let content = '';
	let reasoning = '';
	let finishReason: string | null = null;
	const toolCalls: ToolCall[] = [];
	const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, reasoningTokens: 0 };

	const handleData = (data: string) => {
		if (data === '[DONE]') return;
		let chunk: StreamChunk;
		try {
			chunk = JSON.parse(data) as StreamChunk;
		} catch {
			return;
		}
		const choice = chunk.choices?.[0];
		const delta = choice?.delta;
		if (delta?.reasoning_content) {
			reasoning += delta.reasoning_content;
			handlers.onReasoning?.(delta.reasoning_content);
		}
		if (delta?.content) {
			content += delta.content;
			handlers.onText?.(delta.content);
		}
		for (const tc of delta?.tool_calls ?? []) {
			const slot =
				toolCalls[tc.index] ??
				(toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } });
			if (tc.id) slot.id = tc.id;
			if (tc.function?.name) slot.function.name += tc.function.name;
			if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
		}
		if (choice?.finish_reason) finishReason = choice.finish_reason;
		if (chunk.usage) {
			usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
			usage.outputTokens = chunk.usage.completion_tokens ?? 0;
			usage.cacheHitTokens = chunk.usage.prompt_cache_hit_tokens ?? 0;
			usage.reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0;
		}
	};

	const decoder = new TextDecoder();
	const reader = response.body.getReader();
	let buffer = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let newline: number;
		while ((newline = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (line.startsWith('data:')) handleData(line.slice(5).trim());
		}
	}
	const rest = buffer.trim();
	if (rest.startsWith('data:')) handleData(rest.slice(5).trim());

	const calls = toolCalls.filter((c) => c && c.function.name);
	calls.forEach((c, i) => {
		if (!c.id) c.id = `call_${i}`;
	});
	return {
		message: {
			role: 'assistant',
			content: content || null,
			...(reasoning ? { reasoning_content: reasoning } : {}),
			...(calls.length > 0 ? { tool_calls: calls } : {}),
		},
		finishReason,
		usage,
	};
}

/** Cheap authenticated call used to validate an API key before saving it. */
export async function verifyApiKey(
	apiKey: string,
	baseUrl: string = DEEPSEEK_BASE_URL
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const res = await fetch(`${baseUrl}/models`, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (res.ok) return { ok: true };
		if (res.status === 401 || res.status === 403) {
			return { ok: false, error: 'DeepSeek rejected this API key.' };
		}
		return { ok: false, error: `DeepSeek answered ${res.status} ${res.statusText}.` };
	} catch (error) {
		return {
			ok: false,
			error: `Could not reach DeepSeek: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
