/**
 * @file loop.test.ts
 * @description Tests for the DeepSeek agent turn: tool round trips, reasoning
 * pass-back, session persistence and the project-folder write guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runAgentTurn, loadSession, type AgentEvent } from '../../../main/deepseek-agent/loop';
import { executeTool } from '../../../main/deepseek-agent/tools';

type Delta = Record<string, unknown>;

/** Build a Response whose body is an SSE stream of the given chunks. */
function sse(chunks: Array<{ delta?: Delta; finish?: string; usage?: Record<string, number> }>) {
	const lines = chunks.map((c) =>
		JSON.stringify({
			choices:
				c.delta || c.finish ? [{ delta: c.delta ?? {}, finish_reason: c.finish ?? null }] : [],
			usage: c.usage ?? null,
		})
	);
	const body = [...lines.map((l) => `data: ${l}\n\n`), 'data: [DONE]\n\n'].join('');
	return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('runAgentTurn', () => {
	let project: string;
	let userData: string;
	const fetchMock = vi.fn();

	beforeEach(() => {
		project = fs.mkdtempSync(path.join(os.tmpdir(), 'owai-project-'));
		userData = fs.mkdtempSync(path.join(os.tmpdir(), 'owai-userdata-'));
		fs.writeFileSync(path.join(project, 'notes.txt'), 'first line\nsecond line\n');
		process.env.OPENWIZARDAI_USER_DATA = userData;
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.OPENWIZARDAI_USER_DATA;
		fs.rmSync(project, { recursive: true, force: true });
		fs.rmSync(userData, { recursive: true, force: true });
	});

	it('runs a tool call, sends reasoning back, and reports the final answer', async () => {
		fetchMock
			.mockResolvedValueOnce(
				sse([
					{ delta: { reasoning_content: 'I should read the file.' } },
					{
						delta: {
							tool_calls: [
								{ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{"path":' } },
							],
						},
					},
					{ delta: { tool_calls: [{ index: 0, function: { arguments: '"notes.txt"}' } }] } },
					{ finish: 'tool_calls', usage: { prompt_tokens: 100, completion_tokens: 20 } },
				])
			)
			.mockResolvedValueOnce(
				sse([
					{ delta: { content: 'The file has ' } },
					{ delta: { content: 'two lines.' } },
					{
						finish: 'stop',
						usage: { prompt_tokens: 150, completion_tokens: 10, prompt_cache_hit_tokens: 100 },
					},
				])
			);

		const events: AgentEvent[] = [];
		const result = await runAgentTurn({
			apiKey: 'sk-test',
			prompt: 'How many lines does notes.txt have?',
			cwd: project,
			model: 'deepseek-flash',
			effort: 'high',
			thinking: true,
			readOnly: false,
			emit: (e) => events.push(e),
		});

		expect(result.ok).toBe(true);
		const toolResult = events.find((e) => e.type === 'tool_result');
		expect(toolResult).toMatchObject({ name: 'read_file', is_error: false });
		expect((toolResult as { output: string }).output).toContain('second line');

		const final = events.find((e) => e.type === 'result') as Extract<
			AgentEvent,
			{ type: 'result' }
		>;
		expect(final.text).toBe('The file has two lines.');
		expect(final.usage).toMatchObject({ inputTokens: 250, outputTokens: 30, cacheHitTokens: 100 });
		expect(final.steps).toBe(2);

		// Thinking mode with tools: the second request must carry the earlier reasoning.
		const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		const assistant = secondBody.messages.find((m: { role: string }) => m.role === 'assistant');
		expect(assistant.reasoning_content).toBe('I should read the file.');
		expect(secondBody.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' });
		expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer sk-test');

		const stored = loadSession(result.sessionId);
		expect(stored?.messages.filter((m) => m.role === 'user')).toHaveLength(1);
	});

	it('resumes a stored session instead of starting over', async () => {
		fetchMock
			.mockResolvedValueOnce(sse([{ delta: { content: 'Hello.' } }, { finish: 'stop' }]))
			.mockResolvedValueOnce(sse([{ delta: { content: 'Still here.' } }, { finish: 'stop' }]));
		const base = {
			apiKey: 'sk-test',
			cwd: project,
			model: 'deepseek-flash',
			effort: 'high' as const,
			thinking: false,
			readOnly: false,
			emit: () => {},
		};
		const first = await runAgentTurn({ ...base, prompt: 'Hi' });
		await runAgentTurn({ ...base, prompt: 'Are you there?', sessionId: first.sessionId });

		const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
		const users = body.messages.filter((m: { role: string }) => m.role === 'user');
		expect(users.map((m: { content: string }) => m.content)).toEqual(['Hi', 'Are you there?']);
		expect(body.thinking).toEqual({ type: 'disabled' });
	});

	it('emits an auth error instead of throwing when DeepSeek rejects the key', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: { message: 'Authentication Fails' } }), {
				status: 401,
			})
		);
		const events: AgentEvent[] = [];
		const result = await runAgentTurn({
			apiKey: 'bad',
			prompt: 'Hi',
			cwd: project,
			model: 'deepseek-flash',
			effort: 'high',
			thinking: true,
			readOnly: false,
			emit: (e) => events.push(e),
		});
		expect(result.ok).toBe(false);
		expect(events.at(-1)).toMatchObject({ type: 'error', code: 'auth' });
	});
});

describe('executeTool', () => {
	let project: string;

	beforeEach(() => {
		project = fs.mkdtempSync(path.join(os.tmpdir(), 'owai-tools-'));
	});

	afterEach(() => {
		fs.rmSync(project, { recursive: true, force: true });
	});

	it('writes and edits files inside the project folder', async () => {
		const ctx = { cwd: project, readOnly: false };
		const write = await executeTool(
			ctx,
			'write_file',
			JSON.stringify({ path: 'a/b.txt', content: 'x = 1' })
		);
		expect(write.isError).toBe(false);
		const edit = await executeTool(
			ctx,
			'edit_file',
			JSON.stringify({ path: 'a/b.txt', old_string: 'x = 1', new_string: 'x = 2' })
		);
		expect(edit.isError).toBe(false);
		expect(fs.readFileSync(path.join(project, 'a/b.txt'), 'utf8')).toBe('x = 2');
	});

	it('refuses to write outside the project folder', async () => {
		const outside = path.join(os.tmpdir(), `owai-outside-${Date.now()}.txt`);
		const r = await executeTool(
			{ cwd: project, readOnly: false },
			'write_file',
			JSON.stringify({ path: outside, content: 'nope' })
		);
		expect(r.isError).toBe(true);
		expect(fs.existsSync(outside)).toBe(false);
	});

	it('blocks changes in read-only mode', async () => {
		const r = await executeTool(
			{ cwd: project, readOnly: true },
			'run_command',
			JSON.stringify({ command: 'echo hi' })
		);
		expect(r.isError).toBe(true);
		expect(r.output).toContain('read-only');
	});

	it('runs shell commands and reports the exit code', async () => {
		const r = await executeTool(
			{ cwd: project, readOnly: false },
			'run_command',
			JSON.stringify({ command: 'echo hello && exit 3' })
		);
		expect(r.isError).toBe(true);
		expect(r.output).toContain('exit code: 3');
		expect(r.output).toContain('hello');
	});
});
