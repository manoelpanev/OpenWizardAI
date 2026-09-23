import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarActions } from '../../../../renderer/components/SessionList/SidebarActions';
import type { Theme } from '../../../../renderer/types';

import { mockTheme } from '../../../helpers/mockTheme';

const defaultShortcuts = {
	toggleSidebar: { keys: ['Cmd', 'B'], label: 'Toggle Sidebar' },
	filterUnreadAgents: { keys: ['Alt', 'u'], label: 'Filter Unread Agents' },
} as any;

function createProps(overrides: Partial<Parameters<typeof SidebarActions>[0]> = {}) {
	return {
		theme: mockTheme,
		leftSidebarOpen: true,
		hasNoSessions: false,
		shortcuts: defaultShortcuts,
		showUnreadAgentsOnly: false,
		hasUnreadAgents: false,
		addNewSession: vi.fn(),
		setLeftSidebarOpen: vi.fn(),
		toggleShowUnreadAgentsOnly: vi.fn(),
		...overrides,
	};
}

describe('SidebarActions', () => {
	it('calls addNewSession when New Agent is clicked', () => {
		const addNewSession = vi.fn();
		render(<SidebarActions {...createProps({ addNewSession })} />);

		fireEvent.click(screen.getByText('New Agent'));
		expect(addNewSession).toHaveBeenCalledOnce();
	});

	it('toggles sidebar open/closed on collapse button click', () => {
		const setLeftSidebarOpen = vi.fn();
		render(<SidebarActions {...createProps({ leftSidebarOpen: true, setLeftSidebarOpen })} />);

		// Click the collapse button (first button)
		const collapseBtn = screen.getByTitle(/Collapse Sidebar/);
		fireEvent.click(collapseBtn);
		expect(setLeftSidebarOpen).toHaveBeenCalledWith(false);
	});

	it('prevents collapse when no sessions and sidebar is open', () => {
		const setLeftSidebarOpen = vi.fn();
		render(
			<SidebarActions
				{...createProps({ hasNoSessions: true, leftSidebarOpen: true, setLeftSidebarOpen })}
			/>
		);

		const collapseBtn = screen.getByTitle('Add an agent first to collapse sidebar');
		fireEvent.click(collapseBtn);
		expect(setLeftSidebarOpen).not.toHaveBeenCalled();
	});

	it('allows expanding sidebar even with no sessions', () => {
		const setLeftSidebarOpen = vi.fn();
		render(
			<SidebarActions
				{...createProps({ hasNoSessions: true, leftSidebarOpen: false, setLeftSidebarOpen })}
			/>
		);

		const expandBtn = screen.getByTitle(/Expand Sidebar/);
		fireEvent.click(expandBtn);
		expect(setLeftSidebarOpen).toHaveBeenCalledWith(true);
	});

	it('renders unread agents filter button', () => {
		render(<SidebarActions {...createProps()} />);
		expect(screen.getByTitle(/Filter unread agents/)).toBeTruthy();
	});

	it('calls toggleShowUnreadAgentsOnly when unread filter button is clicked', () => {
		const toggleShowUnreadAgentsOnly = vi.fn();
		render(<SidebarActions {...createProps({ toggleShowUnreadAgentsOnly })} />);

		fireEvent.click(screen.getByTitle(/Filter unread agents/));
		expect(toggleShowUnreadAgentsOnly).toHaveBeenCalledOnce();
	});

	it('shows active state when showUnreadAgentsOnly is true', () => {
		render(<SidebarActions {...createProps({ showUnreadAgentsOnly: true })} />);
		expect(screen.getByTitle(/Showing unread agents only/)).toBeTruthy();
	});

	it('renders single-column grid layout', () => {
		render(<SidebarActions {...createProps()} />);

		const newAgentBtn = screen.getByText('New Agent');
		const grid = newAgentBtn.closest('div[style]');
		expect(grid?.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
	});

	it('prevents text wrapping in action buttons', () => {
		render(<SidebarActions {...createProps()} />);

		const newAgentBtn = screen.getByText('New Agent').closest('button');

		expect(newAgentBtn?.className).toContain('whitespace-nowrap');
		expect(newAgentBtn?.className).toContain('overflow-hidden');
	});
});
