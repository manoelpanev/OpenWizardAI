/**
 * WizardPanel - the Wizard tab of the right panel.
 *
 * A DeepSeek companion that chats about the active agent's project folder and
 * guides the user through planning and building it. Each project folder keeps
 * its own conversation (stored by the main process), so switching agents
 * switches conversations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, Send, Square, RotateCcw, KeyRound } from 'lucide-react';
import type { Theme } from '../types';
import { Markdown } from './Markdown';
import { Spinner } from './ui/Spinner';
import { generateId } from '../utils/ids';
import { openDeepSeekConnect } from './DeepSeekConnectModal';

type WizardApi = typeof window.openwizardai.wizardPanel;
type WizardEvent = Parameters<Parameters<WizardApi['onEvent']>[0]>[1];

interface ChatEntry {
	id: string;
	role: 'user' | 'assistant' | 'activity' | 'error';
	text: string;
}

const STARTERS = [
	'Hilf mir, ein neues Projekt zu planen.',
	'Schau dir dieses Projekt an und sag mir, was als Nächstes zu tun ist.',
	'Erstelle aus unserem Plan ein Auto-Run-Playbook.',
];

const TOOL_LABELS: Record<string, string> = {
	list_dir: 'Schaut sich Ordner an',
	read_file: 'Liest',
	search: 'Sucht nach',
	write_file: 'Schreibt',
	edit_file: 'Bearbeitet',
	run_command: 'Führt aus',
};

function describeTool(name: string, input: unknown): string {
	const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const detail = args.path ?? args.pattern ?? args.command ?? '';
	const label = TOOL_LABELS[name] ?? name;
	return detail ? `${label} ${String(detail)}` : label;
}

interface WizardPanelProps {
	theme: Theme;
	projectPath: string;
	projectName: string;
}

export function WizardPanel({ theme, projectPath, projectName }: WizardPanelProps) {
	const [entries, setEntries] = useState<ChatEntry[]>([]);
	const [streaming, setStreaming] = useState('');
	const [requestId, setRequestId] = useState<string | null>(null);
	const [input, setInput] = useState('');
	const [connected, setConnected] = useState<boolean | null>(null);
	const requestRef = useRef<string | null>(null);
	const streamingRef = useRef('');
	const scrollRef = useRef<HTMLDivElement>(null);

	const busy = requestId !== null;

	const setStream = (text: string) => {
		streamingRef.current = text;
		setStreaming(text);
	};

	/** Move whatever has streamed so far into the transcript. */
	const flushStream = () => {
		const text = streamingRef.current;
		setStream('');
		if (text.trim()) {
			setEntries((e) => [...e, { id: generateId(), role: 'assistant', text }]);
		}
	};

	// Load this project's conversation and connection state.
	useEffect(() => {
		let cancelled = false;
		setEntries([]);
		setStream('');
		window.openwizardai.deepseek
			.getStatus()
			.then((s) => {
				if (!cancelled) setConnected(s.configured);
			})
			.catch(() => {
				if (!cancelled) setConnected(false);
			});
		window.openwizardai.wizardPanel
			.getHistory(projectPath)
			.then((history) => {
				if (cancelled) return;
				setEntries(history.map((m) => ({ id: generateId(), role: m.role, text: m.text })));
			})
			.catch(() => {
				// No stored conversation yet.
			});
		return () => {
			cancelled = true;
		};
	}, [projectPath]);

	// Stream events for the turn in flight.
	useEffect(() => {
		return window.openwizardai.wizardPanel.onEvent((id: string, event: WizardEvent) => {
			if (id !== requestRef.current) return;
			switch (event.type) {
				case 'text':
					setStream(streamingRef.current + event.text);
					break;
				case 'tool_use':
					// Text streamed before a tool call was an interim note; keep it visible.
					flushStream();
					setEntries((e) => [
						...e,
						{ id: generateId(), role: 'activity', text: describeTool(event.name, event.input) },
					]);
					break;
				case 'result':
					setStream('');
					if (event.text) {
						setEntries((e) => [...e, { id: generateId(), role: 'assistant', text: event.text }]);
					}
					break;
				case 'error':
					flushStream();
					if (event.code !== 'aborted') {
						setEntries((e) => [...e, { id: generateId(), role: 'error', text: event.message }]);
					}
					if (event.code === 'auth') setConnected(false);
					break;
				default:
					break;
			}
		});
	}, []);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [entries, streaming]);

	const send = useCallback(
		async (text: string) => {
			const prompt = text.trim();
			if (!prompt || requestRef.current) return;
			const id = generateId();
			requestRef.current = id;
			setRequestId(id);
			setInput('');
			setEntries((e) => [...e, { id: generateId(), role: 'user', text: prompt }]);
			try {
				await window.openwizardai.wizardPanel.send(id, projectPath, prompt);
			} finally {
				requestRef.current = null;
				setRequestId(null);
				flushStream();
			}
		},
		[projectPath]
	);

	const stop = useCallback(() => {
		if (requestId) void window.openwizardai.wizardPanel.stop(requestId);
	}, [requestId]);

	const reset = useCallback(async () => {
		if (requestRef.current) return;
		await window.openwizardai.wizardPanel.reset(projectPath);
		setEntries([]);
	}, [projectPath]);

	if (connected === false) {
		return (
			<div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-2">
				<KeyRound className="w-8 h-8" style={{ color: theme.colors.accent }} />
				<p className="text-sm" style={{ color: theme.colors.textMain }}>
					Der Wizard läuft mit DeepSeek. Verbinde zuerst deinen API-Key.
				</p>
				<button
					type="button"
					onClick={openDeepSeekConnect}
					className="px-3 py-1.5 rounded text-xs font-bold"
					style={{ backgroundColor: theme.colors.accent, color: theme.colors.accentForeground }}
				>
					DeepSeek verbinden
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full pt-3" data-testid="wizard-panel">
			<div className="flex items-center gap-2 pb-2">
				<Wand2 className="w-4 h-4 shrink-0" style={{ color: theme.colors.accent }} />
				<span className="text-xs font-bold truncate" style={{ color: theme.colors.textMain }}>
					Wizard · {projectName}
				</span>
				<button
					type="button"
					onClick={() => void reset()}
					disabled={busy || entries.length === 0}
					className="ml-auto p-1 rounded hover:bg-white/5 disabled:opacity-30"
					title="Neues Gespräch für dieses Projekt"
					aria-label="Neues Gespräch"
				>
					<RotateCcw className="w-3.5 h-3.5" style={{ color: theme.colors.textDim }} />
				</button>
			</div>

			<div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
				{entries.length === 0 && !busy && (
					<div className="space-y-2 pt-2">
						<p className="text-xs" style={{ color: theme.colors.textDim }}>
							Ich begleite dich durch dieses Projekt: planen, Aufgaben festlegen, bauen lassen.
							Womit fangen wir an?
						</p>
						{STARTERS.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => void send(s)}
								className="w-full text-left text-xs p-2 rounded border hover:bg-white/5"
								style={{ borderColor: theme.colors.border, color: theme.colors.textMain }}
							>
								{s}
							</button>
						))}
					</div>
				)}

				{entries.map((entry) => {
					if (entry.role === 'activity') {
						return (
							<div
								key={entry.id}
								className="text-xs-plus font-mono truncate"
								style={{ color: theme.colors.textDim }}
								title={entry.text}
							>
								· {entry.text}
							</div>
						);
					}
					if (entry.role === 'error') {
						return (
							<p
								key={entry.id}
								role="alert"
								className="text-xs"
								style={{ color: theme.colors.error }}
							>
								{entry.text}
							</p>
						);
					}
					const isUser = entry.role === 'user';
					return (
						<div
							key={entry.id}
							className={`text-sm rounded-lg px-3 py-2 ${isUser ? 'ml-6' : ''}`}
							style={{
								backgroundColor: isUser ? `${theme.colors.accent}20` : theme.colors.bgActivity,
								color: theme.colors.textMain,
							}}
						>
							{isUser ? (
								<span className="whitespace-pre-wrap">{entry.text}</span>
							) : (
								<Markdown preset="wizard-bubble" theme={theme} content={entry.text} />
							)}
						</div>
					);
				})}

				{busy && (
					<div
						className="text-sm rounded-lg px-3 py-2"
						style={{ backgroundColor: theme.colors.bgActivity, color: theme.colors.textMain }}
					>
						{streaming ? (
							<Markdown preset="wizard-bubble" theme={theme} content={streaming} />
						) : (
							<span className="flex items-center gap-2" style={{ color: theme.colors.textDim }}>
								<Spinner size={12} color={theme.colors.textDim} /> Denkt nach…
							</span>
						)}
					</div>
				)}
			</div>

			<div className="pt-2">
				<div
					className="flex items-end gap-2 rounded border p-2"
					style={{ borderColor: theme.colors.border }}
				>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								void send(input);
							}
						}}
						rows={2}
						placeholder="Frag den Wizard… (Enter senden, Shift+Enter neue Zeile)"
						className="flex-1 bg-transparent outline-none resize-none text-sm"
						style={{ color: theme.colors.textMain }}
						aria-label="Nachricht an den Wizard"
					/>
					{busy ? (
						<button
							type="button"
							onClick={stop}
							className="p-1.5 rounded hover:bg-white/5"
							title="Stoppen"
							aria-label="Stoppen"
						>
							<Square className="w-4 h-4" style={{ color: theme.colors.error }} />
						</button>
					) : (
						<button
							type="button"
							onClick={() => void send(input)}
							disabled={!input.trim()}
							className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30"
							title="Senden"
							aria-label="Senden"
						>
							<Send className="w-4 h-4" style={{ color: theme.colors.accent }} />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
