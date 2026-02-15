# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Gmail MCP (Model Context Protocol) Server built in TypeScript. It provides a local MCP server that integrates with Gmail using OAuth 2.0 authentication, allowing Claude to interact with Gmail through secure API calls.

## Key Dependencies

- `@modelcontextprotocol/sdk`: Core MCP framework for building servers
- `googleapis`: Google's official Node.js client library for Gmail API
- `@google-cloud/local-auth`: Google's OAuth 2.0 client for desktop applications
- `zod`: Schema validation for tool parameters
- `nodemailer`: RFC 822 email construction with attachment support
- `mime-types`: MIME type detection for attachments

## Development Commands

```bash
# Build the project (optional - Bun runs TS natively)
bun run build

# Development mode with hot reload
bun run dev

# Test the MCP server with inspector
bun run inspect

# Type-check without emitting
bun run typecheck

# Run tests
bun test
```

## Architecture

The project follows a modular architecture:

- **Entry Point**: `src/index.ts` - Main MCP server setup and tool definitions
- **Gmail Client**: `src/gmail-client.ts` - Gmail API wrapper (send, search, read, modify, delete, batch ops, attachments)
- **Account Manager**: `src/account-manager.ts` - Multi-account credential storage and switching
- **Email Utils**: `src/email-utils.ts` - MIME encoding, email validation, path security, Nodemailer integration
- **Label Manager**: `src/label-manager.ts` - CRUD operations for Gmail labels
- **Filter Manager**: `src/filter-manager.ts` - Gmail filter CRUD and pre-built templates
- **Authentication**: `src/auth.ts` - OAuth 2.0 credential management
- **Types**: `src/types.ts` - TypeScript interfaces and type definitions

## Authentication Flow

Uses OAuth 2.0 Desktop Application Flow:
1. First run opens browser for user consent
2. Stores refresh tokens in `token.json`
3. Automatic token refresh for subsequent requests
4. Requires `credentials.json` from Google Cloud Console

## Required Setup Files

- `credentials.json`: OAuth 2.0 credentials from Google Cloud Console
- `token.json`: Generated after first authentication (auto-created)

## MCP Tools Structure

The server exposes Gmail functionality through MCP tools:

### Email Tools
- `send_email`: Send emails with HTML, attachments, CC/BCC, and thread reply support
- `search_emails`: Search Gmail with queries and pagination
- `read_email`: Retrieve full message content with attachment metadata

### Email Modification
- `modify_email`: Add/remove labels on a message
- `delete_email`: Permanently delete a message
- `mark_as_read` / `mark_as_unread`: Toggle read state

### Batch Operations
- `batch_modify_emails`: Bulk add/remove labels with configurable batch size
- `batch_delete_emails`: Bulk permanent delete with configurable batch size

### Attachments
- `download_attachment`: Download email attachments with path security validation

### Label Management
- `list_email_labels`: List all system and user labels
- `create_label` / `update_label` / `delete_label`: CRUD for labels
- `get_or_create_label`: Idempotent label creation

### Filter Management
- `create_filter` / `list_filters` / `get_filter` / `delete_filter`: Full filter CRUD
- `create_filter_from_template`: Pre-built templates (fromSender, withSubject, withAttachments, largeEmails, containingText, mailingList)

### Account Management
- `list_accounts` / `add_account` / `remove_account` / `set_default_account`

## Development Workflow

1. Install dependencies: `bun install`
2. Place Google OAuth credentials in `credentials.json`
3. Build (optional): `bun run build`
4. Test with inspector: `bun run inspect`
5. First run triggers OAuth consent flow
6. Use `bun run dev` for development with hot reload

## Security Considerations

- Never commit `credentials.json` or `token.json`
- Use minimal required Gmail scopes
- Tokens auto-refresh but expire after 6 months of inactivity
- Set restrictive file permissions on credential files
- Attachment paths are validated against sensitive directories (~/.ssh, ~/.aws, ~/.env, etc.)
- MIME header injection prevention via CR/LF stripping
- Path traversal protection on attachment downloads

## Testing

Use the MCP Inspector (`bun run inspect`) to:
- Test tool calls interactively
- Debug authentication issues
- View request/response payloads
- Validate tool parameters

## Integration

Configure in Claude Desktop's config file:
```json
{
  "mcpServers": {
    "gmail": {
      "command": "bun",
      "args": ["/absolute/path/to/src/index.ts"]
    }
  }
}
```