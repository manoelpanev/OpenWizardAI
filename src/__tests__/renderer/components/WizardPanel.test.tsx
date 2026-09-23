/**
 * @file WizardPanel.test.tsx
 * @description Tests for the Wizard tab: connect prompt, sending, streaming and tool activity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { WizardPanel } from '../../../renderer/components/WizardPanel';
import type { Theme } from '../../../renderer/types';

vi.mock('../../../renderer/components/Markdown', () => ({
	Markdown: ({ content }: { content: string }) => <div data-testid="md">{content}</div>,
}));

const theme = {
	id: 'dracula',
	name: 'Dracula',
	mode: 'dark',
	colors: {
		bgMain: '#282a36',
		bgSidebar: '#21222c',
		bgActivity: '#343746',
		border: '#44475a',
		textMain: '#f8f8f2',
		textDim: '#6272a4',
		accent: '#bd93f9',
		accentForeground: '#282a36',
		success: '#50fa7b',
		warning: '#ffb86c',
		error: '#ff5555',
	},
} as unknown as Theme;

type Listener = (requestId: string, event: Record<string, unknown>) => void;

describe('WizardPanel', () => {
	let listener: Listener | null;
	let send: ReturnType<typeof vi.fn>;
	let getStatus: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		listener = null;
		send = vi.fn();
		getStatus = vi
			.fn()
			.mockResolvedValue({ configured: true, encryptionAvailable: true, keyHint: 'abcd' });
		const api = window.openwizardai as unknown as Record<string, unknown>;
		api.deepseek = { getStatus };
		api.wizardPanel = {
			getHistory: vi.fn().mockResolvedValue([]),
			send,
			stop: vi.fn(),
			reset: vi.fn().mockResolvedValue(true),
			onEvent: vi.fn((cb: Listener) => {
				listener = cb;
				return () => {
					listener = null;
				};
			}),
		};
	});

	it('asks to connect DeepSeek when no key is saved', async () => {
		getStatus.mockResolvedValue({ configured: false, encryptionAvailable: true, keyHint: null });
		render(<WizardPanel theme={theme} projectPath="/p" projectName="Demo" />);
		expect(await screen.findByText('DeepSeek verbinden')).toBeInTheDocument();
	});

	it('sends a starter prompt and shows tool activity and the answer', async () => {
		let resolveSend: (v: { ok: boolean }) => void = () => {};
		send.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveSend = resolve;
				})
		);
		render(<WizardPanel theme={theme} projectPath="/p" projectName="Demo" />);

		fireEvent.click(await screen.findByText('Hilf mir, ein neues Projekt zu planen.'));
		expect(send).toHaveBeenCalledWith(
			expect.any(String),
			'/p',
			'Hilf mir, ein neues Projekt zu planen.'
		);
		const requestId = send.mock.calls[0][0] as string;

		act(() => {
			listener?.(requestId, {
				type: 'tool_use',
				id: 't1',
				name: 'read_file',
				input: { path: 'README.md' },
			});
			listener?.(requestId, { type: 'text', text: 'Plan ' });
			listener?.(requestId, { type: 'text', text: 'steht.' });
		});
		expect(screen.getByText('· Liest README.md')).toBeInTheDocument();
		expect(screen.getByText('Plan steht.')).toBeInTheDocument();

		await act(async () => {
			listener?.(requestId, {
				type: 'result',
				session_id: 's',
				text: 'Plan steht.',
				cost_usd: 0,
				steps: 2,
			});
			resolveSend({ ok: true });
		});
		await waitFor(() => expect(screen.getAllByText('Plan steht.')).toHaveLength(1));
	});
});
