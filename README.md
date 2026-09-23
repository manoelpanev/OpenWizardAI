# OpenWizardAI

Your AI project wizard: plan, build and run projects with a fleet of AI coding agents, keyboard-first.

OpenWizardAI runs AI coding agents (DeepSeek, Claude Code, Codex, OpenCode, Gemini CLI and more) side by side, each with its own workspace and history. Plan work with the wizard, then let Auto Run execute it task by task.

> Based on [Maestro](https://github.com/RunMaestro/Maestro) by Pedram Amini, licensed under AGPL-3.0.

## Features

### Power Features

- 🌳 **[Git Worktrees](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/git-worktrees.md)** - Run AI agents in parallel on isolated branches. Create worktree sub-agents from the git branch menu, each operating in their own directory. Work interactively in the main repo while sub-agents process tasks independently-then create PRs with one click. True parallel development without conflicts.
- 🤖 **[Auto Run & Playbooks](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/autorun-playbooks.md)** - File-system-based task runner that batch-processes markdown checklists through AI agents. Create playbooks for repeatable workflows, run in loops, and track progress with full history. Each task gets its own AI session for clean conversation context.
- 💬 **[Group Chat](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/group-chat.md)** - Coordinate multiple AI agents in a single conversation. A moderator AI orchestrates discussions, routing questions to the right agents and synthesizing their responses for cross-project questions and architecture discussions.
- 🌐 **[Mobile Remote Control](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/remote-access.md)** - Built-in web server with QR code access. Monitor and control all your agents from your phone. Supports local network access and remote tunneling via Cloudflare for access from anywhere.
- 💻 **[Command Line Interface](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/cli.md)** - Full CLI (`openwizardai-cli`) for headless operation. List agents/groups, run playbooks from cron jobs or CI/CD pipelines, with human-readable or JSONL output for scripting.
- 🚀 **Multi-Agent Management** - Run unlimited agents and terminal sessions in parallel. Each agent has its own workspace, conversation history, and isolated context.
- 📬 **Message Queueing** - Queue messages while AI is busy; they're sent automatically when the agent becomes ready. Never lose a thought.
- 🛡️ **[Agent Resilience](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/agent-resilience.md)** - Providers fail; your turn does not have to. When a turn dies on `529 Overloaded` or a spent plan quota, OpenWizardAI resends the exact prompt on its own, backing off in seconds for a blip or waiting for the real reset time it reads out of the error. One live status card replaces the wall of error dialogs, Auto Run batches resume themselves, and an agent can optionally fail over to a backup endpoint instead of waiting out the window.

### Core Features

- 🔄 **Dual-Mode Sessions** - Each agent has both an AI Terminal and Command Terminal. Switch seamlessly between AI conversation and shell commands with `Cmd+J`.
- ⌨️ **[Keyboard-First Design](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/keyboard-shortcuts.md)** - Full keyboard control with customizable shortcuts and [mastery tracking](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/keyboard-shortcuts.md#keyboard-mastery) that rewards you for leveling up. `Cmd+K` quick actions, rapid agent switching, and focus management designed for flow state.
- 📋 **Session Discovery** - Automatically discovers and imports existing sessions from all supported providers, including conversations from before OpenWizardAI was installed. Browse, search, star, rename, and resume any session.
- 🔀 **Git Integration** - Automatic repo detection, branch display, diff viewer, commit logs, and git-aware file completion. Work with git without leaving the app.
- 📁 **[File Explorer](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/general-usage.md#file-explorer-and-preview)** - Browse project files with syntax highlighting, markdown preview, and image viewing. Reference files in prompts with `@` mentions.
- 🗃️ **[File Formats](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/file-formats.md)** - Data files open in a viewer built for them, several with their own filtering language: jq over JSON and JSONL, sortable filtered tables for CSV and TSV, rendered Mermaid diagrams, and audio and video in a floating player.
- 🧮 **[Parquet Preview](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/parquet-preview.md)** - Parquet files open as a live, filterable table with a schema rail. A typed query language (`ts >= now-7d and price > 100`) runs against the whole file while OpenWizardAI skips the row groups it can prove cannot match, so a multi-gigabyte file filters instantly and never loads into memory.
- 🔍 **[Powerful Output Filtering](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/general-usage.md#output-filtering)** - Search and filter AI output with include/exclude modes, regex support, and per-response local filters.
- ⚡ **[Slash Commands](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/slash-commands.md)** - Extensible command system with autocomplete. Create custom commands with template variables for your workflows.
- 💾 **Draft Auto-Save** - Never lose work. Drafts are automatically saved and restored per session.
- 🔊 **Speakable Notifications** - Audio alerts with text-to-speech announcements when agents complete tasks.
- 🎨 **[Beautiful Themes](THEMES.md)** - 12 themes including Dracula, Monokai, Nord, Tokyo Night, GitHub Light, and more.
- 💰 **Cost Tracking** - Real-time token usage and cost tracking per session and globally.
- 🏆 **[Achievements](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/achievements.md)** - Level up from Apprentice to Titan of the Baton based on cumulative Auto Run time. 11 conductor-themed ranks to unlock.

### Analytics & Visualization

- 📊 **Usage Dashboard** - Comprehensive analytics for tracking AI usage patterns across all sessions. View aggregated statistics with multiple time ranges (day, week, month, year, all time), compare agent performance, analyze user vs. Auto Run activity distribution, and explore activity heatmaps. Fuzzy-filter your agents, then click any one to drill into its stats and see the breakdown per AI tab, or jump straight from there to the agent itself or its settings. Includes CSV export, real-time updates, and configurable colorblind-friendly palettes. Access via `Opt+Cmd+U` (macOS) / `Alt+Ctrl+U` (Windows/Linux) or the Command K menu.
- 🕸️ **Document Graph** - Visual knowledge graph of your markdown documentation. Automatically discovers internal `[[wiki-links]]` and `[markdown](links)`, visualizes document relationships with interactive nodes and edges. Toggle between force-directed and hierarchical layouts, search/filter documents, navigate via keyboard, and track external link references. Includes mini-map, legend, and pagination for large directories. Access from the File Explorer context menu or Command K menu.

#### Keyboard Shortcuts for Analytics Features

**Usage Dashboard** (`Opt+Cmd+U` / `Alt+Ctrl+U`):

| Action                     | Key                      |
| -------------------------- | ------------------------ |
| Navigate view tabs         | Arrow Left/Right/Up/Down |
| Move between sections      | Tab / Shift+Tab          |
| Jump to first/last section | Home / End               |
| Close dashboard            | Escape                   |

On the Agents tab, Escape clears the agent filter first when it holds text, so filtering never costs you the dashboard.

**Document Graph** (Command K → "Document Graph"):

| Action                       | Key                            |
| ---------------------------- | ------------------------------ |
| Navigate to connected node   | Arrow Up/Down/Left/Right       |
| Cycle through connections    | Tab                            |
| Preview document / open link | Enter                          |
| Recenter graph on node       | Space                          |
| Cycle preview length         | P                              |
| Step back / close graph      | Escape                         |
| Search documents             | Focus search input, type query |

Escape steps back one level at a time: out of the search box first (your query stays,
so the matches are still highlighted while you arrow to one), then it clears the query,
then it closes the graph.

Additional interactions: Drag nodes to reposition, scroll to zoom, use mini-map for overview.

> **Note**: OpenWizardAI supports Claude Code, OpenAI Codex, OpenCode, Factory Droid, and Copilot-CLI (beta). Support for additional agents (Gemini CLI) may be added in future releases based on community demand.

## Quick Start

### Installation

Download the latest release for your platform from the [Releases page](https://github.com/manoelpanev/OpenWizardAI/releases).

Or build from source:

```bash
git clone https://github.com/manoelpanev/OpenWizardAI.git
cd OpenWizardAI
npm ci
npm run dev
```

### Requirements

- Node.js 22 or 24 to build from source (Node 26 is not supported by better-sqlite3)
- At least one supported AI coding agent installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - Anthropic's AI coding assistant
  - [OpenAI Codex](https://github.com/openai/codex) - OpenAI's coding agent
  - [OpenCode](https://github.com/sst/opencode) - Open-source AI coding assistant
  - [Copilot-CLI](https://docs.github.com/copilot/how-tos/copilot-cli) - GitHub's terminal coding agent (beta, multi-model via [models.dev](https://models.dev))
- Git (optional, for git-aware features)

### Essential Keyboard Shortcuts

| Action              | macOS             | Windows/Linux       |
| ------------------- | ----------------- | ------------------- |
| Quick Actions       | `Cmd+K`           | `Ctrl+K`            |
| New Agent           | `Cmd+N`           | `Ctrl+N`            |
| Switch AI/Terminal  | `Cmd+J`           | `Ctrl+J`            |
| Previous/Next Agent | `Cmd+[` / `Cmd+]` | `Ctrl+[` / `Ctrl+]` |
| Toggle Sidebar      | `Cmd+B`           | `Ctrl+B`            |
| New Tab             | `Cmd+T`           | `Ctrl+T`            |
| Usage Dashboard     | `Opt+Cmd+U`       | `Alt+Ctrl+U`        |
| All Shortcuts       | `Cmd+/`           | `Ctrl+/`            |

[Full keyboard shortcut reference](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/keyboard-shortcuts.md)

## Documentation

Full documentation and usage guide available at **[github.com/manoelpanev/OpenWizardAI/tree/main/docs](https://github.com/manoelpanev/OpenWizardAI/tree/main/docs)**

- [Installation](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/installation.md)
- [Getting Started](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/getting-started.md)
- [Features Overview](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/features.md)
- [Auto Run + Playbooks](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/autorun-playbooks.md)
- [Git Worktrees](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/git-worktrees.md)
- [Keyboard Shortcuts](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/keyboard-shortcuts.md)
- [Context Management](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/context-management.md)
- [MCP Server](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp-server.md) - Connect AI apps to OpenWizardAI docs
- [Troubleshooting](https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/troubleshooting.md)

## Community

- **Discussions**: [github.com/manoelpanev/OpenWizardAI/discussions](https://github.com/manoelpanev/OpenWizardAI/discussions)
- **Issues**: [Report bugs & request features](https://github.com/manoelpanev/OpenWizardAI/issues)
- **Contributing**: see [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[AGPL-3.0](LICENSE). OpenWizardAI is based on Maestro by Pedram Amini; the original copyright and license notices are kept.
