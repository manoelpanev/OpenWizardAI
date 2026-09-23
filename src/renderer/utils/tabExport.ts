/**
 * @file tabExport.ts
 * @description Export utility for AI tab conversations.
 *
 * Generates a self-contained HTML file with the user's current theme colors
 * and properly rendered GitHub Flavored Markdown content using the marked library.
 * Based on groupChatExport.ts but adapted for individual tab conversations.
 */

import { marked } from 'marked';
import type { AITab, LogEntry, Theme, UsageStats } from '../types';
import { getTabDisplayName } from './tabHelpers';
import { formatTimestamp as formatTimestampShared } from '../../shared/formatters';
import {
	computeTabConversationStats,
	formatConversationDuration,
} from '../../shared/tabConversationStats';

// Configure marked for GFM (tables, strikethrough, etc.)
marked.setOptions({
	gfm: true,
	breaks: true,
});

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: number): string {
	return formatTimestampShared(timestamp, 'full');
}

/**
 * Get color for log entry source
 */
function getSourceColor(source: LogEntry['source'], theme: Theme): string {
	switch (source) {
		case 'user':
			return theme.colors.accent;
		case 'ai':
		case 'stdout':
			return theme.colors.success;
		case 'error':
		case 'stderr':
			return theme.colors.error;
		case 'system':
			return theme.colors.warning;
		case 'thinking':
			return theme.colors.textDim;
		case 'tool':
			return theme.colors.accentDim;
		default:
			return theme.colors.textMain;
	}
}

/**
 * Get display label for log entry source
 */
function getSourceLabel(source: LogEntry['source']): string {
	switch (source) {
		case 'user':
			return 'User';
		case 'ai':
		case 'stdout':
			return 'AI';
		case 'error':
		case 'stderr':
			return 'Error';
		case 'system':
			return 'System';
		case 'thinking':
			return 'Thinking';
		case 'tool':
			return 'Tool';
		default:
			return source;
	}
}

/**
 * Format usage stats for display
 */
function formatUsageStats(stats: UsageStats | undefined): string {
	if (!stats) return 'N/A';

	const parts: string[] = [];
	if (stats.inputTokens) parts.push(`${stats.inputTokens.toLocaleString()} input`);
	if (stats.outputTokens) parts.push(`${stats.outputTokens.toLocaleString()} output`);
	if (stats.totalCostUsd) parts.push(`$${stats.totalCostUsd.toFixed(4)}`);

	return parts.length > 0 ? parts.join(' · ') : 'N/A';
}

/**
 * Process content to render markdown
 */
function formatContent(content: string): string {
	// Render markdown to HTML using marked (synchronous)
	const html = marked.parse(content, { async: false }) as string;
	return html;
}

/**
 * Generate the HTML export content with theme colors
 */
export function generateTabExportHtml(
	tab: AITab,
	session: { name: string; cwd: string; toolType: string },
	theme: Theme
): string {
	// Counts and span come from the shared helper, so the figures printed here
	// are the same ones the Context Details popover shows live in the app.
	const conversation = computeTabConversationStats(tab.logs);
	const relevantLogs = conversation.logs;

	const stats = {
		totalMessages: conversation.totalMessages,
		userMessages: conversation.userMessages,
		aiMessages: conversation.aiMessages,
		duration: formatConversationDuration(conversation.durationMs),
	};

	// Generate messages HTML
	const messagesHtml = relevantLogs
		.map((log) => {
			const color = getSourceColor(log.source, theme);
			const isUser = log.source === 'user';
			const label = getSourceLabel(log.source);

			// Format content with markdown
			const formattedContent = formatContent(log.text);

			return `
      <div class="message ${isUser ? 'message-user' : 'message-agent'}">
        <div class="message-header">
          <span class="message-from" style="color: ${color}">${escapeHtml(label)}</span>
          <span class="message-time">${formatTimestamp(log.timestamp)}</span>
          ${log.readOnly ? '<span class="read-only-badge">read-only</span>' : ''}
        </div>
        <div class="message-content">${formattedContent}</div>
      </div>`;
		})
		.join('\n');

	// Build HTML document with theme colors
	const colors = theme.colors;

	// OpenWizardAI app icon as base64 PNG (72x72) - same as groupChatExport
	const openwizardaiIconBase64 =
		'data:image/png;base64,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';

	// Get tab name or session ID for display
	const tabName = getTabDisplayName(tab);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tabName)} - OpenWizardAI Tab Export</title>
  <style>
    :root {
      --bg-primary: ${colors.bgMain};
      --bg-secondary: ${colors.bgSidebar};
      --bg-tertiary: ${colors.bgActivity};
      --text-primary: ${colors.textMain};
      --text-secondary: ${colors.textDim};
      --text-dim: ${colors.textDim};
      --border: ${colors.border};
      --accent: ${colors.accent};
      --accent-dim: ${colors.accentDim};
      --success: ${colors.success};
      --warning: ${colors.warning};
      --error: ${colors.error};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    /* Branding Header */
    .branding {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%);
      border-radius: 1rem;
      border: 1px solid var(--border);
    }

    .branding-logo {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      border-radius: 8px;
    }

    .branding-logo img {
      width: 100%;
      height: 100%;
      border-radius: 8px;
    }

    .branding-text {
      text-align: left;
    }

    .branding-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .branding-tagline {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    .branding-links {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
    }

    .branding-link {
      font-size: 0.75rem;
      color: var(--accent);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .branding-link:hover {
      text-decoration: underline;
    }

    .branding-link svg {
      width: 12px;
      height: 12px;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    .header h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .header .subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background-color: var(--accent-dim);
      border-radius: 0.5rem;
      padding: 1rem;
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .info-label {
      color: var(--text-dim);
    }

    .info-value {
      color: var(--text-primary);
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      word-break: break-all;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message {
      background-color: var(--bg-secondary);
      border-radius: 0.5rem;
      padding: 1rem;
      border-left: 3px solid var(--border);
    }

    .message-user {
      border-left-color: var(--accent);
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .message-from {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .message-time {
      color: var(--text-dim);
      font-size: 0.75rem;
    }

    .read-only-badge {
      background-color: rgba(251, 191, 36, 0.2);
      color: var(--warning);
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* Message Content - Markdown Styles */
    .message-content {
      font-size: 0.9375rem;
      color: var(--text-primary);
      line-height: 1.6;
    }

    .message-content > *:first-child {
      margin-top: 0;
    }

    .message-content > *:last-child {
      margin-bottom: 0;
    }

    .message-content h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 1.5rem 0 0.75rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid var(--border);
    }

    .message-content h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 1.25rem 0 0.5rem;
      padding-bottom: 0.2rem;
      border-bottom: 1px solid var(--border);
    }

    .message-content h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1rem 0 0.5rem;
    }

    .message-content h4, .message-content h5, .message-content h6 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0.75rem 0 0.5rem;
    }

    .message-content p {
      margin: 0.75rem 0;
    }

    .message-content ul, .message-content ol {
      margin: 0.75rem 0;
      padding-left: 1.75rem;
    }

    .message-content li {
      margin: 0.25rem 0;
    }

    .message-content li > ul, .message-content li > ol {
      margin: 0.25rem 0;
    }

    .message-content a {
      color: var(--accent);
      text-decoration: none;
    }

    .message-content a:hover {
      text-decoration: underline;
    }

    .message-content strong {
      font-weight: 600;
    }

    .message-content em {
      font-style: italic;
    }

    .message-content blockquote {
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      border-left: 4px solid var(--accent);
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    .message-content blockquote > *:first-child {
      margin-top: 0;
    }

    .message-content blockquote > *:last-child {
      margin-bottom: 0;
    }

    /* Horizontal Rule */
    .message-content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5rem 0;
    }

    /* Tables */
    .message-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
      font-size: 0.875rem;
    }

    .message-content th, .message-content td {
      border: 1px solid var(--border);
      padding: 0.5rem 0.75rem;
      text-align: left;
    }

    .message-content th {
      background-color: var(--bg-tertiary);
      font-weight: 600;
    }

    .message-content tr:nth-child(even) {
      background-color: var(--accent-dim);
    }

    /* Code */
    .message-content code {
      background-color: var(--bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.875em;
    }

    .message-content pre {
      background-color: var(--bg-tertiary);
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      margin: 0.75rem 0;
      border: 1px solid var(--border);
    }

    .message-content pre code {
      background-color: transparent;
      padding: 0;
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    /* Task Lists */
    .message-content input[type="checkbox"] {
      margin-right: 0.5rem;
    }

    /* Images */
    .message-content img {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      margin: 0.75rem 0;
    }

    /* Strikethrough */
    .message-content del {
      text-decoration: line-through;
      color: var(--text-dim);
    }

    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-dim);
      font-size: 0.75rem;
    }

    .footer a {
      color: var(--accent);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    .footer-theme {
      margin-top: 0.5rem;
      font-size: 0.625rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @media (max-width: 640px) {
      body {
        padding: 1rem;
      }

      .branding {
        flex-direction: column;
        text-align: center;
      }

      .branding-text {
        text-align: center;
      }

      .branding-links {
        justify-content: center;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .info-grid {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      body {
        background-color: white;
        color: black;
      }

      .branding {
        background: #f5f5f5;
      }

      .message {
        background-color: #f5f5f5;
        border-left-color: #ccc;
      }

      .stat-card {
        background-color: #f5f5f5;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- OpenWizardAI Branding -->
    <div class="branding">
      <div class="branding-logo">
        <img src="${openwizardaiIconBase64}" alt="OpenWizardAI" />
      </div>
      <div class="branding-text">
        <div class="branding-title">
          OpenWizardAI
        </div>
        <div class="branding-tagline">Multi-agent orchestration for AI coding assistants</div>
        <div class="branding-links">
          <a href="https://github.com/manoelpanev/OpenWizardAI" target="_blank" class="branding-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            github.com/manoelpanev/OpenWizardAI
          </a>
          <a href="https://github.com/manoelpanev/OpenWizardAI" target="_blank" class="branding-link">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>
    </div>

    <header class="header">
      <h1>${escapeHtml(tabName)}</h1>
      <p class="subtitle">Tab Export - ${formatTimestamp(tab.createdAt)}</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalMessages}</div>
        <div class="stat-label">Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.userMessages}</div>
        <div class="stat-label">User</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.aiMessages}</div>
        <div class="stat-label">AI</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.duration}</div>
        <div class="stat-label">Duration</div>
      </div>
    </div>

    <section class="section">
      <h2 class="section-title">Details</h2>
      <div class="info-grid">
        ${
					tab.agentSessionId
						? `
        <span class="info-label">Session ID</span>
        <span class="info-value">${escapeHtml(tab.agentSessionId)}</span>
        `
						: ''
				}
        <span class="info-label">Session Name</span>
        <span class="info-value">${escapeHtml(session.name)}</span>
        <span class="info-label">Agent</span>
        <span class="info-value">${escapeHtml(session.toolType)}</span>
        <span class="info-label">Working Directory</span>
        <span class="info-value">${escapeHtml(session.cwd)}</span>
        <span class="info-label">Created</span>
        <span class="info-value">${formatTimestamp(tab.createdAt)}</span>
        <span class="info-label">Usage</span>
        <span class="info-value">${formatUsageStats(tab.usageStats)}</span>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Conversation</h2>
      <div class="messages">
        ${messagesHtml}
      </div>
    </section>

    <footer class="footer">
      <p>Exported from <a href="https://github.com/manoelpanev/OpenWizardAI" target="_blank">OpenWizardAI</a> on ${formatTimestamp(Date.now())}</p>
      <p class="footer-theme">Theme: ${escapeHtml(theme.name)}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Download the tab conversation as an HTML file
 */
export async function downloadTabExport(
	tab: AITab,
	session: { name: string; cwd: string; toolType: string },
	theme: Theme
): Promise<void> {
	// Generate HTML
	const html = generateTabExportHtml(tab, session, theme);

	// Create blob and download
	const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	// Generate filename from tab name or session ID
	const filename = tab.name
		? tab.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
		: tab.agentSessionId
			? tab.agentSessionId.split('-')[0].toLowerCase()
			: 'tab';

	const link = document.createElement('a');
	link.href = url;
	link.download = `${filename}-export.html`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}
