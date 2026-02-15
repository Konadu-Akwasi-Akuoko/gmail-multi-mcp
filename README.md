# Gmail Multi-Account MCP Server

A Model Context Protocol (MCP) server that enables Claude Desktop to interact with multiple Gmail accounts through secure OAuth 2.0 authentication.

This project is a fork of [AlexHramovich/gmail-mcp](https://github.com/AlexHramovich/gmail-mcp), extended with additional features inspired by [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server). Full credit to both authors for their original work.

## Features

- **Multiple Account Support** - Add, remove, and switch between multiple Gmail accounts
- **Default Account Management** - Set a default account for quick access
- **Send Emails** - Plain text, HTML, multipart, with CC/BCC and file attachments
- **Search Emails** - Use Gmail's powerful search operators (from, subject, has:attachment, newer_than, is:unread, etc.)
- **Read Emails** - Retrieve full email content with attachment metadata
- **Email Modification** - Modify labels, mark as read/unread, delete messages
- **Batch Operations** - Bulk modify labels or delete messages with configurable batch sizes
- **Attachment Support** - Send attachments and download them with path security validation
- **Label Management** - Create, update, delete, and list Gmail labels
- **Filter Management** - Create, list, get, delete filters with pre-built templates
- **Thread Replies** - Reply to email threads with In-Reply-To/References headers
- **Secure OAuth 2.0 Authentication** - No passwords stored; tokens auto-refresh
- **Security Hardening** - MIME header injection prevention, sensitive path blocking, path traversal protection
- **MCP Inspector** - Built-in development tool for testing and debugging

## Quick Start

1. **Setup Google Cloud Console**:
   - Create a project and enable Gmail API
   - Create OAuth 2.0 credentials for desktop application
   - Download credentials as `credentials.json`

2. **Install and Build**:
   ```bash
   bun install
   bun run build
   ```

3. **Configure Claude Desktop**:
   - Place `credentials.json` in Claude Desktop's directory
   - Update `claude_desktop_config.json` with server path
   - Restart Claude Desktop

4. **Start Using**:
   ```
   Send an email to john@example.com with subject "Hello" and body "Testing Gmail MCP"
   ```

## Prerequisites

- **Bun** (latest version)
- **Claude Desktop** application installed
- **Gmail account** with API access enabled
- **Google Cloud Console** project with Gmail API enabled

## Setup Instructions

### 1. Google Cloud Console Setup

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it

3. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Desktop application"
   - Download the credentials JSON file

4. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Add your email as a test user
   - Set scopes: `https://www.googleapis.com/auth/gmail.modify`, `https://www.googleapis.com/auth/gmail.settings.basic`

### 2. Project Setup

1. **Clone and Install**:
   ```bash
   git clone https://github.com/Konadu-Akwasi-Akuoko/gmail-multi-mcp.git
   cd gmail-multi-mcp
   bun install
   ```

2. **Add Google Credentials**:
   - Rename your downloaded credentials file to `credentials.json`
   - Place it in Claude Desktop's working directory (not the project directory)
   - **Location varies by OS**:
     - **macOS**: `~/Library/Application Support/Claude/`
     - **Windows**: `%APPDATA%\Claude\`
     - **Linux**: `~/.config/claude/`
   - Never commit this file to version control

3. **Build the Project**:
   ```bash
   bun run build
   ```

4. **Test the Setup**:
   ```bash
   bun run inspect
   ```
   This opens the MCP Inspector for testing tools before connecting to Claude Desktop.

### 3. Claude Desktop Integration

1. **Locate Claude Desktop Config**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. **Update Configuration**:
   ```json
   {
     "mcpServers": {
       "gmail": {
         "command": "bun",
         "args": ["/absolute/path/to/your/gmail-multi-mcp/src/index.ts"]
       }
     }
   }
   ```
   Replace `/absolute/path/to/your/gmail-multi-mcp/` with the actual path to your project.

3. **Restart Claude Desktop** - the Gmail MCP server should now be available.

## First-Time Authentication

When you first use Gmail tools through Claude Desktop:

1. A browser window will open automatically
2. Sign in with your Gmail account and grant the requested permissions
3. Authentication tokens are stored in the `accounts/` directory within Claude Desktop's directory
4. Tokens auto-refresh and are valid for 6 months of inactivity

## Available Tools

### Email Operations

| Tool | Description |
|------|-------------|
| `send_email` | Send emails with HTML, attachments, CC/BCC, and thread reply support |
| `search_emails` | Search emails using Gmail search operators |
| `read_email` | Read a specific email by message ID with attachment info |

### Email Modification

| Tool | Description |
|------|-------------|
| `modify_email` | Add or remove labels on a message |
| `delete_email` | Permanently delete a message |
| `mark_as_read` | Mark a message as read |
| `mark_as_unread` | Mark a message as unread |

### Batch Operations

| Tool | Description |
|------|-------------|
| `batch_modify_emails` | Bulk add/remove labels on multiple messages |
| `batch_delete_emails` | Bulk delete multiple messages |

### Attachments

| Tool | Description |
|------|-------------|
| `download_attachment` | Download an email attachment to disk |

### Label Management

| Tool | Description |
|------|-------------|
| `list_email_labels` | List all system and user labels |
| `create_label` | Create a new label with visibility options |
| `update_label` | Update a label's name or visibility |
| `delete_label` | Delete a user-created label |
| `get_or_create_label` | Get existing label or create if missing |

### Filter Management

| Tool | Description |
|------|-------------|
| `create_filter` | Create a filter with custom criteria and actions |
| `list_filters` | List all Gmail filters |
| `get_filter` | Get details of a specific filter |
| `delete_filter` | Delete a filter by ID |
| `create_filter_from_template` | Create from pre-built templates (fromSender, withSubject, withAttachments, largeEmails, containingText, mailingList) |

### Account Management

| Tool | Description |
|------|-------------|
| `list_accounts` | List all configured Gmail accounts |
| `add_account` | Add a new Gmail account |
| `remove_account` | Remove a configured Gmail account |
| `set_default_account` | Set the default Gmail account |

## Development

```bash
# Development mode with hot reload
bun run dev

# Test with MCP Inspector
bun run inspect

# Build for production
bun run build

# Type-check without emitting
bun run typecheck
```

## Architecture

Built with TypeScript and follows MCP specifications:

- **Entry Point**: `src/index.ts` - MCP server setup and tool definitions
- **Gmail Client**: `src/gmail-client.ts` - Gmail API wrapper (send, search, read, modify, delete, batch ops, attachments)
- **Account Manager**: `src/account-manager.ts` - Multi-account credential storage and switching
- **Email Utils**: `src/email-utils.ts` - MIME encoding, email validation, path security, Nodemailer integration
- **Label Manager**: `src/label-manager.ts` - CRUD operations for Gmail labels
- **Filter Manager**: `src/filter-manager.ts` - Gmail filter CRUD and pre-built templates
- **Authentication**: `src/auth.ts` - OAuth 2.0 credential management
- **Types**: `src/types.ts` - TypeScript interfaces and type definitions

## Troubleshooting

### Common Issues

**"No account specified and no default account set"**:
- Add an account using the `add_account` tool or set a default account

**"Authentication failed"**:
- Check if `credentials.json` exists in Claude Desktop's directory (not the project directory)
- Verify Gmail API is enabled in Google Cloud Console
- Try removing and re-adding the account

**"Token expired"**:
- Tokens auto-refresh, but manual re-authentication may be needed
- Remove and re-add the account if issues persist

**Claude Desktop not detecting MCP server**:
- Verify the absolute path in config file
- Check that the build directory exists
- Restart Claude Desktop after config changes

### Development and Testing

**Test tools without Claude Desktop**:
```bash
bun run inspect
```

**Development mode with hot reload**:
```bash
bun run dev
```

**View server logs**:
- Check Claude Desktop logs for MCP server output
- Use Inspector tool for detailed request/response debugging

### File Structure

**Project Directory**:
```
gmail-multi-mcp/
├── build/                  # Compiled JavaScript (auto-generated)
├── src/
│   ├── index.ts            # MCP server entry point and tool definitions
│   ├── gmail-client.ts     # Gmail API wrapper
│   ├── account-manager.ts  # Multi-account management
│   ├── email-utils.ts      # MIME, validation, security, Nodemailer
│   ├── label-manager.ts    # Label CRUD operations
│   ├── filter-manager.ts   # Filter CRUD and templates
│   ├── auth.ts             # OAuth 2.0 credential management
│   └── types.ts            # TypeScript interfaces
├── package.json
└── CLAUDE.md
```

**Claude Desktop Directory** (where credentials.json goes):
```
~/.config/claude/       # Linux
~/Library/Application Support/Claude/  # macOS
%APPDATA%\Claude\       # Windows
├── credentials.json    # Google OAuth credentials (you provide)
├── accounts/           # Account tokens (auto-generated when using tools)
└── claude_desktop_config.json  # Claude Desktop configuration
```

## Security

- Uses minimal required Gmail scopes
- Tokens stored locally with automatic refresh
- No email content stored permanently
- All operations performed locally
- Attachment paths validated against sensitive directories (~/.ssh, ~/.aws, ~/.env, credentials, etc.)
- MIME header injection prevention via CR/LF stripping
- Path traversal protection on attachment downloads

## Limitations

- **Rate limits**: Gmail API has daily quotas
- **Token expiry**: Tokens expire after 6 months of inactivity

## License

MIT

## Credits

- [AlexHramovich/gmail-mcp](https://github.com/AlexHramovich/gmail-mcp) - Original Gmail MCP server
- [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) - Additional feature inspiration
