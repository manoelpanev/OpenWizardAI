---
title: MCP Server
description: Connect AI applications to OpenWizardAI's documentation knowledge base using the Model Context Protocol.
icon: plug
---

# MCP Server

OpenWizardAI provides a hosted MCP (Model Context Protocol) server that allows AI applications to search and retrieve information from the OpenWizardAI documentation. The server is automatically generated and hosted by [Mintlify](https://mintlify.com).

## Overview

The MCP server exposes a `SearchOpenWizardAI` tool that enables AI assistants to find relevant documentation, code examples, API references, and guides from the OpenWizardAI knowledge base. When connected, your AI assistant can proactively search the documentation while generating responses - not just when explicitly asked.

**MCP Server URL:**

```
https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md
```

## Available Tools

### SearchOpenWizardAI

Search across the OpenWizardAI knowledge base to find relevant information.

**Use this tool when you need to:**

- Answer questions about OpenWizardAI features and functionality
- Find specific documentation pages
- Understand how features work
- Locate implementation details and code examples

**Returns:**

- Contextual content with titles
- Direct links to documentation pages

## Connecting AI Applications

### Claude Desktop

Add the MCP server to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
	"mcpServers": {
		"openwizardai": {
			"url": "https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md"
		}
	}
}
```

### Claude Code

Add to your Claude Code MCP settings:

```json
{
	"mcpServers": {
		"openwizardai": {
			"url": "https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md"
		}
	}
}
```

### Cursor

In Cursor settings, go to **Features > MCP Servers** and add:

```
https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md
```

### VS Code

For VS Code with MCP support, add to your MCP configuration:

```json
{
	"mcpServers": {
		"openwizardai": {
			"url": "https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md"
		}
	}
}
```

### Other MCP-Compatible Applications

Any application that supports the Model Context Protocol can connect using the server URL:

```
https://github.com/manoelpanev/OpenWizardAI/blob/main/docs/mcp.md
```

## Example Queries

Once connected, your AI assistant can use the `SearchOpenWizardAI` tool to answer questions like:

- "How do I set up Auto Run in OpenWizardAI?"
- "What keyboard shortcuts are available?"
- "How does Group Chat work?"
- "How do I configure git worktrees?"
- "What AI agents does OpenWizardAI support?"

## Technical Details

- **Protocol**: Model Context Protocol (MCP)
- **Transport**: HTTP/HTTPS (Streamable HTTP)
- **Authentication**: None required (public read-only access)
- **Rate Limits**: Standard API rate limits apply
- **Hosting**: Automatically managed by Mintlify

<Note>
The MCP server only indexes pages included in the documentation navigation. Hidden or excluded pages are not searchable.
</Note>

## Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [OpenWizardAI Documentation](https://github.com/manoelpanev/OpenWizardAI/tree/main/docs)
- [GitHub Repository](https://github.com/manoelpanev/OpenWizardAI)
