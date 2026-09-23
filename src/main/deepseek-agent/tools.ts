/**
 * Tools the DeepSeek agent can call. Reads may go anywhere the user can read;
 * writes and edits are confined to the working directory. Read-only mode drops
 * every tool that changes the disk or runs commands.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { ToolSchema } from './deepseek-client';

const MAX_READ_BYTES = 256 * 1024;
const MAX_READ_LINES = 2000;
const MAX_OUTPUT_CHARS = 30_000;
const MAX_LIST_ENTRIES = 400;
const DEFAULT_COMMAND_TIMEOUT_S = 120;
const MAX_COMMAND_TIMEOUT_S = 600;
const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.venv',
	'__pycache__',
]);

export interface ToolContext {
	cwd: string;
	readOnly: boolean;
	signal?: AbortSignal;
}

export interface ToolOutcome {
	output: string;
	isError: boolean;
}

function truncate(text: string, limit = MAX_OUTPUT_CHARS): string {
	if (text.length <= limit) return text;
	return `${text.slice(0, limit)}\n... [truncated ${text.length - limit} characters]`;
}

function resolveIn(ctx: ToolContext, p: unknown): string {
	const raw = typeof p === 'string' && p.trim() ? p.trim() : '.';
	return path.resolve(ctx.cwd, raw);
}

function assertInsideCwd(ctx: ToolContext, abs: string): void {
	const rel = path.relative(ctx.cwd, abs);
	if (rel.startsWith('..') || path.isAbsolute(rel)) {
		throw new Error(`Refusing to modify ${abs}: it is outside the project folder ${ctx.cwd}.`);
	}
}

function listDir(ctx: ToolContext, args: Record<string, unknown>): string {
	const root = resolveIn(ctx, args.path);
	const maxDepth = Math.min(Math.max(Number(args.depth ?? 2) || 2, 1), 6);
	const lines: string[] = [];
	const walk = (dir: string, depth: number) => {
		if (lines.length >= MAX_LIST_ENTRIES) return;
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch (error) {
			lines.push(`${'  '.repeat(depth)}[unreadable: ${(error as Error).message}]`);
			return;
		}
		entries.sort(
			(a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)
		);
		for (const entry of entries) {
			if (lines.length >= MAX_LIST_ENTRIES) {
				lines.push('... [listing truncated]');
				return;
			}
			const isDir = entry.isDirectory();
			lines.push(`${'  '.repeat(depth)}${entry.name}${isDir ? '/' : ''}`);
			if (isDir && depth + 1 < maxDepth && !SKIP_DIRS.has(entry.name)) {
				walk(path.join(dir, entry.name), depth + 1);
			}
		}
	};
	walk(root, 0);
	return lines.length > 0 ? `${root}\n${lines.join('\n')}` : `${root} is empty.`;
}

function readFile(ctx: ToolContext, args: Record<string, unknown>): string {
	const abs = resolveIn(ctx, args.path);
	const stat = fs.statSync(abs);
	if (stat.isDirectory()) throw new Error(`${abs} is a directory. Use list_dir instead.`);
	const buf = fs.readFileSync(abs);
	if (buf.subarray(0, 8000).includes(0)) return `${abs} is a binary file (${stat.size} bytes).`;
	const all = buf.subarray(0, MAX_READ_BYTES).toString('utf8').split('\n');
	const start = Math.max(Number(args.start_line ?? 1) || 1, 1);
	const requestedEnd = Number(args.end_line ?? start + MAX_READ_LINES - 1) || all.length;
	const end = Math.min(requestedEnd, start + MAX_READ_LINES - 1, all.length);
	const body = all
		.slice(start - 1, end)
		.map((line, i) => `${String(start + i).padStart(5)}  ${line}`)
		.join('\n');
	const more = end < all.length || stat.size > MAX_READ_BYTES;
	return `${abs} (lines ${start}-${end}${more ? ', more available' : ''})\n${body}`;
}

function writeFile(ctx: ToolContext, args: Record<string, unknown>): string {
	const abs = resolveIn(ctx, args.path);
	assertInsideCwd(ctx, abs);
	if (typeof args.content !== 'string') throw new Error('write_file needs a string "content".');
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	const existed = fs.existsSync(abs);
	fs.writeFileSync(abs, args.content, 'utf8');
	return `${existed ? 'Overwrote' : 'Created'} ${abs} (${args.content.length} characters).`;
}

function editFile(ctx: ToolContext, args: Record<string, unknown>): string {
	const abs = resolveIn(ctx, args.path);
	assertInsideCwd(ctx, abs);
	const oldString = args.old_string;
	const newString = args.new_string;
	if (typeof oldString !== 'string' || typeof newString !== 'string' || oldString === '') {
		throw new Error('edit_file needs a non-empty "old_string" and a string "new_string".');
	}
	const replaceAll = args.replace_all === true;
	const source = fs.readFileSync(abs, 'utf8');
	const count = source.split(oldString).length - 1;
	if (count === 0) {
		throw new Error(`old_string was not found in ${abs}. Read the file and copy the text exactly.`);
	}
	if (count > 1 && !replaceAll) {
		throw new Error(
			`old_string appears ${count} times in ${abs}. Add more context or set replace_all.`
		);
	}
	const updated = replaceAll
		? source.split(oldString).join(newString)
		: source.replace(oldString, () => newString);
	fs.writeFileSync(abs, updated, 'utf8');
	const replaced = replaceAll ? count : 1;
	return `Edited ${abs} (${replaced} replacement${replaced === 1 ? '' : 's'}).`;
}

function runProcess(
	command: string,
	argv: string[],
	cwd: string,
	timeoutS: number,
	signal?: AbortSignal
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
	return new Promise((resolve) => {
		const child = spawn(command, argv, { cwd, env: process.env, signal });
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGKILL');
		}, timeoutS * 1000);
		child.stdout.on('data', (d: Buffer) => {
			if (stdout.length < MAX_OUTPUT_CHARS * 2) stdout += d.toString('utf8');
		});
		child.stderr.on('data', (d: Buffer) => {
			if (stderr.length < MAX_OUTPUT_CHARS * 2) stderr += d.toString('utf8');
		});
		child.on('error', (error) => {
			clearTimeout(timer);
			resolve({ code: null, stdout, stderr: stderr + error.message, timedOut });
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			resolve({ code, stdout, stderr, timedOut });
		});
	});
}

async function search(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
	const pattern = typeof args.pattern === 'string' ? args.pattern : '';
	if (!pattern) throw new Error('search needs a "pattern".');
	const root = resolveIn(ctx, args.path);
	const glob = typeof args.glob === 'string' && args.glob ? args.glob : undefined;
	const rgArgs = ['-n', '--no-heading', '--max-count', '50', '-e', pattern];
	if (glob) rgArgs.push('-g', glob);
	rgArgs.push(root);
	let result = await runProcess('rg', rgArgs, ctx.cwd, 30, ctx.signal);
	if (result.code === null) {
		// ripgrep is not installed: fall back to grep.
		const grepArgs = ['-rnE', '--exclude-dir=node_modules', '--exclude-dir=.git'];
		if (glob) grepArgs.push(`--include=${glob}`);
		grepArgs.push(pattern, root);
		result = await runProcess('grep', grepArgs, ctx.cwd, 30, ctx.signal);
	}
	if (result.code === 1 && !result.stdout) return `No matches for ${pattern}.`;
	const lines = result.stdout.split('\n').filter(Boolean);
	const shown = lines.slice(0, 200).join('\n');
	const text = lines.length > 200 ? `${shown}\n... [${lines.length - 200} more matches]` : shown;
	return truncate(text || result.stderr);
}

async function runCommand(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolOutcome> {
	const command = typeof args.command === 'string' ? args.command : '';
	if (!command.trim()) throw new Error('run_command needs a "command".');
	const requested =
		Number(args.timeout_seconds ?? DEFAULT_COMMAND_TIMEOUT_S) || DEFAULT_COMMAND_TIMEOUT_S;
	const timeout = Math.min(Math.max(requested, 1), MAX_COMMAND_TIMEOUT_S);
	const isWindows = process.platform === 'win32';
	const shell = isWindows ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
	const argv = isWindows ? ['/d', '/s', '/c', command] : ['-lc', command];
	const r = await runProcess(shell, argv, ctx.cwd, timeout, ctx.signal);
	const parts = [`$ ${command}`, `exit code: ${r.timedOut ? `timeout after ${timeout}s` : r.code}`];
	if (r.stdout) parts.push(`stdout:\n${r.stdout}`);
	if (r.stderr) parts.push(`stderr:\n${r.stderr}`);
	return { output: truncate(parts.join('\n')), isError: r.timedOut || r.code !== 0 };
}

const SCHEMAS: ToolSchema[] = [
	{
		type: 'function',
		function: {
			name: 'list_dir',
			description:
				'List files and folders as an indented tree. Skips node_modules, .git and build output.',
			parameters: {
				type: 'object',
				properties: {
					path: {
						type: 'string',
						description: 'Folder, relative to the project root. Default "."',
					},
					depth: { type: 'integer', description: 'How many levels to show (1-6). Default 2.' },
				},
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'read_file',
			description: 'Read a text file with line numbers. Use start_line/end_line for large files.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string' },
					start_line: { type: 'integer' },
					end_line: { type: 'integer' },
				},
				required: ['path'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'search',
			description: 'Search file contents with a regular expression. Returns path:line:text.',
			parameters: {
				type: 'object',
				properties: {
					pattern: { type: 'string' },
					path: { type: 'string', description: 'Folder to search. Default "."' },
					glob: { type: 'string', description: 'Optional file filter, e.g. "*.ts"' },
				},
				required: ['pattern'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'write_file',
			description: 'Create or overwrite a file inside the project folder with the given content.',
			parameters: {
				type: 'object',
				properties: { path: { type: 'string' }, content: { type: 'string' } },
				required: ['path', 'content'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'edit_file',
			description:
				'Replace exact text in a file inside the project folder. old_string must match exactly and be unique unless replace_all is true.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string' },
					old_string: { type: 'string' },
					new_string: { type: 'string' },
					replace_all: { type: 'boolean' },
				},
				required: ['path', 'old_string', 'new_string'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'run_command',
			description:
				'Run a shell command in the project folder (tests, builds, git, package managers). Returns exit code, stdout and stderr.',
			parameters: {
				type: 'object',
				properties: {
					command: { type: 'string' },
					timeout_seconds: { type: 'integer', description: 'Default 120, max 600.' },
				},
				required: ['command'],
			},
		},
	},
];

const READ_ONLY_TOOLS = new Set(['list_dir', 'read_file', 'search']);

export function toolSchemas(readOnly: boolean): ToolSchema[] {
	return SCHEMAS.filter((s) => !readOnly || READ_ONLY_TOOLS.has(s.function.name));
}

/** Execute one tool call. Never throws: failures come back as an error outcome the model can read. */
export async function executeTool(
	ctx: ToolContext,
	name: string,
	rawArgs: string
): Promise<ToolOutcome> {
	let args: Record<string, unknown>;
	try {
		args = rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
	} catch {
		return {
			output: `Invalid JSON arguments for ${name}: ${rawArgs.slice(0, 200)}`,
			isError: true,
		};
	}
	if (ctx.readOnly && !READ_ONLY_TOOLS.has(name)) {
		return { output: `${name} is not available in read-only mode.`, isError: true };
	}
	try {
		switch (name) {
			case 'list_dir':
				return { output: truncate(listDir(ctx, args)), isError: false };
			case 'read_file':
				return { output: truncate(readFile(ctx, args)), isError: false };
			case 'search':
				return { output: await search(ctx, args), isError: false };
			case 'write_file':
				return { output: writeFile(ctx, args), isError: false };
			case 'edit_file':
				return { output: editFile(ctx, args), isError: false };
			case 'run_command':
				return await runCommand(ctx, args);
			default:
				return { output: `Unknown tool: ${name}`, isError: true };
		}
	} catch (error) {
		return { output: error instanceof Error ? error.message : String(error), isError: true };
	}
}
