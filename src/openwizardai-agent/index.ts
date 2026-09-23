#!/usr/bin/env node
/**
 * openwizardai-agent: OpenWizardAI's own coding agent, powered by DeepSeek.
 *
 *   openwizardai-agent [--resume <id>] [--model deepseek-flash|deepseek-v4-pro]
 *                      [--effort low|high|max] [--no-thinking] [--read-only]
 *                      [--output-format stream-json|text] [--] <prompt>
 *
 * The prompt comes from the arguments or, when none are given, from stdin.
 * The API key is read from DEEPSEEK_API_KEY. In stream-json mode every event is
 * one JSON object per line on stdout; the desktop app parses that stream.
 */

import { DEEPSEEK_FLASH, type ReasoningEffort } from '../main/deepseek-agent/deepseek-client';
import { runAgentTurn, type AgentEvent } from '../main/deepseek-agent/loop';

declare const __OPENWIZARDAI_AGENT_VERSION__: string;

interface CliArgs {
	resume?: string;
	model: string;
	effort: ReasoningEffort;
	thinking: boolean;
	readOnly: boolean;
	format: 'stream-json' | 'text';
	cwd: string;
	prompt: string;
	version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {
		model: process.env.OPENWIZARDAI_DEEPSEEK_MODEL || DEEPSEEK_FLASH,
		effort: 'high',
		thinking: true,
		readOnly: false,
		format: 'stream-json',
		cwd: process.cwd(),
		prompt: '',
		version: false,
	};
	const rest: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => {
			const value = argv[++i];
			if (value === undefined) throw new Error(`${a} needs a value`);
			return value;
		};
		if (a === '--') {
			rest.push(...argv.slice(i + 1));
			break;
		} else if (a === '--resume' || a === '--session') {
			args.resume = next();
		} else if (a === '--model') {
			args.model = next();
		} else if (a === '--effort') {
			const e = next();
			if (e !== 'low' && e !== 'high' && e !== 'max') {
				throw new Error('--effort must be low, high or max');
			}
			args.effort = e;
		} else if (a === '--no-thinking') {
			args.thinking = false;
		} else if (a === '--read-only') {
			args.readOnly = true;
		} else if (a === '--cwd') {
			args.cwd = next();
		} else if (a === '--output-format') {
			const f = next();
			if (f !== 'stream-json' && f !== 'text') {
				throw new Error('--output-format must be stream-json or text');
			}
			args.format = f;
		} else if (a === '--version' || a === '-v') {
			args.version = true;
		} else {
			rest.push(a);
		}
	}
	args.prompt = rest.join(' ').trim();
	return args;
}

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) return '';
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8').trim();
}

function makeEmitter(format: CliArgs['format']): (event: AgentEvent) => void {
	if (format === 'stream-json') {
		return (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
	}
	return (event) => {
		switch (event.type) {
			case 'text':
				process.stdout.write(event.text);
				break;
			case 'tool_use':
				process.stderr.write(`\n[${event.name}] ${JSON.stringify(event.input)}\n`);
				break;
			case 'result':
				process.stdout.write(
					`\n\nsession: ${event.session_id}  cost: $${event.cost_usd.toFixed(4)}\n`
				);
				break;
			case 'error':
				process.stderr.write(`\nerror (${event.code}): ${event.message}\n`);
				break;
			default:
				break;
		}
	};
}

async function main(): Promise<number> {
	let args: CliArgs;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`openwizardai-agent: ${(error as Error).message}\n`);
		return 2;
	}
	if (args.version) {
		process.stdout.write(`${__OPENWIZARDAI_AGENT_VERSION__}\n`);
		return 0;
	}
	const emit = makeEmitter(args.format);
	const prompt = args.prompt || (await readStdin());
	if (!prompt) {
		emit({ type: 'error', message: 'No prompt given.', code: 'bad_request' });
		return 2;
	}
	const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
	if (!apiKey) {
		emit({
			type: 'error',
			message: 'No DeepSeek API key. Connect it in OpenWizardAI: Cmd+K > Connect DeepSeek.',
			code: 'auth',
		});
		return 1;
	}

	const controller = new AbortController();
	const stop = () => controller.abort();
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);

	const { ok } = await runAgentTurn({
		apiKey,
		prompt,
		cwd: args.cwd,
		model: args.model,
		effort: args.effort,
		thinking: args.thinking,
		readOnly: args.readOnly,
		sessionId: args.resume,
		signal: controller.signal,
		emit,
	});
	return ok ? 0 : 1;
}

main().then(
	(code) => process.exit(code),
	(error) => {
		const detail = error instanceof Error ? error.stack : String(error);
		process.stderr.write(`openwizardai-agent crashed: ${detail}\n`);
		process.exit(1);
	}
);
