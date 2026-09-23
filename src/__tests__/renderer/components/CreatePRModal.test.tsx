/**
 * Tests for CreatePRModal - the form is a VIEW over prCreationStore.
 *
 * The behaviour that matters is what survives a close: `gh pr create` can take
 * a while, and until the request moved to the store, dismissing this form threw
 * away the PR's outcome (and any error) with it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreatePRModal } from '../../../renderer/components/CreatePRModal';
import { usePRCreationStore, prRunKey } from '../../../renderer/stores/prCreationStore';
import { mockTheme } from '../../helpers/mockTheme';

// Escape/layer registration is not what these tests are about.
vi.mock('../../../renderer/hooks/ui/useModalLayer', () => ({
	useModalLayer: vi.fn(),
}));

const WORKTREE = '/test/worktree';
const KEY = prRunKey(WORKTREE);

const createPR = vi.fn();
const checkGhCli = vi.fn();
const status = vi.fn();

function renderModal(overrides: Partial<React.ComponentProps<typeof CreatePRModal>> = {}) {
	const props = {
		isOpen: true,
		onClose: vi.fn(),
		theme: mockTheme,
		worktreePath: WORKTREE,
		worktreeBranch: 'visual-polish',
		sessionId: 'session-1',
		availableBranches: ['main', 'visual-polish'],
		...overrides,
	};
	return { ...render(<CreatePRModal {...props} />), props };
}

describe('CreatePRModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usePRCreationStore.setState({ runs: {} });
		// Never resolves: every test here is about the in-flight window.
		createPR.mockImplementation(() => new Promise(() => {}));
		checkGhCli.mockResolvedValue({ installed: true, authenticated: true });
		status.mockResolvedValue({ stdout: '' });
		(globalThis as unknown as { window: { maestro: unknown } }).window.maestro = {
			git: { createPR, checkGhCli, status },
		};
	});

	it('hands the request to the store instead of holding it', async () => {
		renderModal();
		const button = await screen.findByRole('button', { name: /create pr/i });
		fireEvent.click(button);

		expect(createPR).toHaveBeenCalledWith(WORKTREE, 'main', 'visual polish', '');
		expect(usePRCreationStore.getState().runs[KEY]?.status).toBe('running');
	});

	it('offers Run in Background while the request is in flight', async () => {
		renderModal();
		fireEvent.click(await screen.findByRole('button', { name: /create pr/i }));

		expect(screen.getByText('Creating...')).toBeInTheDocument();
		const close = screen.getByTestId('create-pr-close');
		expect(close).toHaveTextContent('Run in Background');
		// Closing is the whole point: it must not cancel the request.
		fireEvent.click(close);
		expect(usePRCreationStore.getState().runs[KEY]?.status).toBe('running');
	});

	it('re-attaches to the running request rather than resetting the form', async () => {
		const first = renderModal();
		fireEvent.click(await screen.findByRole('button', { name: /create pr/i }));
		first.unmount();

		renderModal();

		// The branch-derived title would be "visual polish"; what matters is that
		// the submitted values and the spinner come back, not a fresh form.
		expect(await screen.findByText('Creating...')).toBeInTheDocument();
		expect(screen.getByDisplayValue('visual polish')).toBeDisabled();
		expect(createPR).toHaveBeenCalledTimes(1);
	});

	it('shows why the last attempt failed when it is reopened', async () => {
		usePRCreationStore.setState({
			runs: {
				[KEY]: {
					key: KEY,
					sessionId: 'session-1',
					worktreePath: WORKTREE,
					sourceBranch: 'visual-polish',
					targetBranch: 'main',
					title: 'visual polish',
					description: '',
					status: 'failed',
					error: 'no commits between main and visual-polish',
					announced: true,
				},
			},
		});
		renderModal();

		expect(
			await screen.findByText('no commits between main and visual-polish')
		).toBeInTheDocument();
		// And it can be retried from there.
		fireEvent.click(screen.getByRole('button', { name: /create pr/i }));
		expect(createPR).toHaveBeenCalledTimes(1);
	});
});
