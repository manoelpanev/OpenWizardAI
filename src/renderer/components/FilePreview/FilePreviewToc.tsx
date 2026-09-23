import React, { RefObject, useEffect, useRef, useState } from 'react';
import { List, ChevronUp, ChevronDown } from 'lucide-react';
import type { TocEntry } from './types';
import { headingLevelColor } from './shared/headings';
import { useScrollIntoView } from '../../hooks/ui/useScrollIntoView';

interface FilePreviewTocProps {
	theme: any;
	tocEntries: TocEntry[];
	tocWidth: number;
	showTocOverlay: boolean;
	setShowTocOverlay: (v: boolean) => void;
	scrollMarkdownToBoundary: (direction: 'top' | 'bottom') => void;
	tocButtonRef: RefObject<HTMLButtonElement>;
	tocOverlayRef: RefObject<HTMLDivElement>;
	isMarkdown: boolean;
	markdownEditMode: boolean;
	/**
	 * Jump the preview to a heading. Owned by FilePreview so the ToC and the
	 * `#` heading palette cannot drift on how a jump works per preview tier.
	 */
	onJumpToHeading: (entry: TocEntry, behavior: ScrollBehavior) => void;
	/**
	 * Index of the heading the preview is currently scrolled under, or `-1` when
	 * the reader is above the first heading. Owned by FilePreview because only it
	 * can measure the document; the list follows it so the highlight is where the
	 * reader is standing rather than where they last clicked.
	 */
	activeIndex: number;
}

export const FilePreviewToc = React.memo(function FilePreviewToc({
	theme,
	tocEntries,
	tocWidth,
	showTocOverlay,
	setShowTocOverlay,
	scrollMarkdownToBoundary,
	tocButtonRef,
	tocOverlayRef,
	isMarkdown,
	markdownEditMode,
	onJumpToHeading,
	activeIndex,
}: FilePreviewTocProps) {
	// The row the list highlights. It follows the scrolled-to heading, and a
	// click or arrow press moves it immediately rather than waiting for the
	// jump's scroll to land - which also keeps arrow nav working past the last
	// heading the document can actually scroll to (near the bottom, scrolling
	// clamps and `activeIndex` stops changing).
	// `-1` is a real value here: it means the reader is above the first heading,
	// so no row is highlighted and the "Top" sash lights up instead.
	const [selectedIndex, setSelectedIndex] = useState(activeIndex);
	const headingButtonRefs = useScrollIntoView<HTMLButtonElement>(
		showTocOverlay,
		selectedIndex,
		tocEntries.length,
		// Instant: the reader may be scrolling the document continuously, and a
		// smooth animation per section change would never finish.
		'auto'
	);
	const prevShowRef = useRef(false);

	// Follow the document. Only fires when the reader crosses into a new section.
	useEffect(() => {
		setSelectedIndex(activeIndex);
	}, [activeIndex]);

	// Focus the current heading whenever the overlay opens - supports keyboard-only nav.
	useEffect(() => {
		if (showTocOverlay && !prevShowRef.current && tocEntries.length > 0) {
			setSelectedIndex(activeIndex);
			const focusIndex = Math.max(activeIndex, 0);
			requestAnimationFrame(() => {
				headingButtonRefs.current[focusIndex]?.focus();
			});
		}
		prevShowRef.current = showTocOverlay;
	}, [showTocOverlay, tocEntries.length]);

	const handleEntriesKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
			return;
		}
		// Stop propagation so the FilePreview container's arrow-scroll handler
		// doesn't also fire and scroll the markdown by 40px on each press.
		e.preventDefault();
		e.stopPropagation();
		const last = tocEntries.length - 1;
		let next = selectedIndex;
		if (e.key === 'ArrowDown') next = Math.min(selectedIndex + 1, last);
		else if (e.key === 'ArrowUp') next = Math.max(selectedIndex - 1, 0);
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = last;
		if (next === selectedIndex) return;
		setSelectedIndex(next);
		headingButtonRefs.current[next]?.focus();
		// Instant scroll on keyboard nav so rapid arrow presses stay responsive.
		onJumpToHeading(tocEntries[next], 'auto');
	};

	if (!isMarkdown || markdownEditMode || tocEntries.length === 0) {
		return null;
	}

	return (
		<>
			{/* Floating TOC Button */}
			<button
				ref={tocButtonRef}
				onClick={() => setShowTocOverlay(!showTocOverlay)}
				className="absolute bottom-4 right-4 p-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-10"
				style={{
					backgroundColor: showTocOverlay ? theme.colors.accent : theme.colors.bgSidebar,
					color: showTocOverlay ? theme.colors.accentForeground : theme.colors.textMain,
					border: `1px solid ${theme.colors.border}`,
				}}
				title="Table of Contents"
			>
				<List className="w-5 h-5" />
			</button>

			{/* TOC Overlay - click outside handled by useClickOutside hook */}
			{showTocOverlay && (
				<div
					ref={tocOverlayRef}
					className="absolute bottom-16 right-4 rounded-lg shadow-xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col"
					style={{
						backgroundColor: theme.colors.bgSidebar,
						border: `1px solid ${theme.colors.border}`,
						maxHeight: 'calc(70vh - 80px)',
						width: `${tocWidth}px`,
					}}
					onWheel={(e) => e.stopPropagation()}
				>
					{/* TOC Header */}
					<div
						className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0"
						style={{ borderColor: theme.colors.border }}
					>
						<span
							className="text-xs font-medium uppercase tracking-wide"
							style={{ color: theme.colors.textDim }}
						>
							Contents
						</span>
						<span
							className="text-2xs flex items-center gap-1.5"
							style={{ color: theme.colors.textDim }}
						>
							<span>{tocEntries.length} headings</span>
							<kbd
								className="px-1 rounded font-mono"
								style={{ backgroundColor: theme.colors.bgMain, color: theme.colors.accent }}
								title="Press # to search these headings"
							>
								#
							</kbd>
						</span>
					</div>
					{/* Top Navigation Sash */}
					<button
						data-testid="toc-top-button"
						onClick={() => {
							scrollMarkdownToBoundary('top');
						}}
						className="w-full px-3 py-2 text-left text-xs border-b transition-colors flex items-center gap-2 hover:brightness-110 flex-shrink-0"
						style={{
							// Lit when the reader is above the first heading: the row
							// that says where they are standing.
							backgroundColor:
								selectedIndex < 0 ? `${theme.colors.accent}25` : `${theme.colors.accent}15`,
							borderColor: theme.colors.border,
							color: theme.colors.textMain,
							boxShadow: selectedIndex < 0 ? `inset 2px 0 0 ${theme.colors.accent}` : undefined,
						}}
						title="Jump to top"
					>
						<ChevronUp className="w-3 h-3" style={{ color: theme.colors.accent }} />
						<span>Top</span>
					</button>

					{/* TOC Entries - scrollable middle section */}
					<div
						className="overflow-y-auto px-1 py-1 flex-1 min-h-0"
						style={{ overscrollBehavior: 'contain' }}
						onWheel={(e) => e.stopPropagation()}
						onKeyDown={handleEntriesKeyDown}
					>
						{tocEntries.map((entry, index) => {
							const headingColor = headingLevelColor(theme, entry.level);
							const isActive = index === selectedIndex;
							return (
								<button
									key={`${entry.slug}-${index}`}
									ref={(el) => {
										headingButtonRefs.current[index] = el;
									}}
									onClick={() => {
										setSelectedIndex(index);
										// Click is deliberate - keep smooth scroll for visual continuity.
										onJumpToHeading(entry, 'smooth');
										// ToC stays open so user can click multiple items
										// Dismiss with click outside or Escape key
									}}
									className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-white/10 transition-colors flex items-center gap-1 focus:outline-none"
									style={{
										color: headingColor,
										paddingLeft: `${(entry.level - 1) * 12 + 8}px`,
										opacity: entry.level > 3 ? 0.85 : 1,
										fontSize:
											entry.level === 1 ? '0.875rem' : entry.level === 2 ? '0.8125rem' : '0.75rem',
										backgroundColor: isActive ? `${theme.colors.accent}25` : undefined,
										boxShadow: isActive ? `inset 2px 0 0 ${theme.colors.accent}` : undefined,
									}}
									title={entry.text}
								>
									<span>{entry.text}</span>
								</button>
							);
						})}
					</div>

					{/* Bottom Navigation Sash */}
					<button
						data-testid="toc-bottom-button"
						onClick={() => {
							scrollMarkdownToBoundary('bottom');
						}}
						className="w-full px-3 py-2 text-left text-xs border-t transition-colors flex items-center gap-2 hover:brightness-110 flex-shrink-0"
						style={{
							backgroundColor: `${theme.colors.accent}15`,
							borderColor: theme.colors.border,
							color: theme.colors.textMain,
						}}
						title="Jump to bottom"
					>
						<ChevronDown className="w-3 h-3" style={{ color: theme.colors.accent }} />
						<span>Bottom</span>
					</button>
				</div>
			)}
		</>
	);
});
