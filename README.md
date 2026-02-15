# Gmail Multi-Account MCP Server

A Model Context Protocol (MCP) server that enables Claude Desktop to interact with multiple Gmail accounts through secure OAuth 2.0 authentication.

This project is a fork of [AlexHramovich/gmail-mcp](https://github.com/AlexHramovich/gmail-mcp), extended with additional features inspired by [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server). Full credit to both authors for their original work.

## Current Features

- **Multiple Account Support** - Add, remove, and switch between multiple Gmail accounts
- **Default Account Management** - Set a default account for quick access
- **Send Emails** - Send emails with recipients, subject, body, CC, and BCC fields
- **Search Emails** - Use Gmail's powerful search operators (from, subject, has:attachment, newer_than, is:unread, etc.)
- **Read Emails** - Retrieve and read full email content by message ID
- **Secure OAuth 2.0 Authentication** - No passwords stored; tokens auto-refresh
- **MCP Inspector** - Built-in development tool for testing and debugging

## Planned Features

- Attachment support (send and download)
- Filter management (create, update, delete Gmail filters)
- Batch operations (bulk archive, delete, label)
- Label management (create, rename, delete, apply labels)
- HTML email support (rich-text compose and rendering)

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
   - Set scopes: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.send`

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
| `send_email` | Send an email with to, subject, body, cc, bcc fields |
| `search_emails` | Search emails using Gmail search operators |
| `read_email` | Read a specific email by message ID |

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
- **Gmail Client**: `src/gmail-client.ts` - Gmail API wrapper with OAuth authentication
- **Account Manager**: `src/account-manager.ts` - Multi-account management
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
├── build/              # Compiled JavaScript (auto-generated)
├── src/                # TypeScript source code
├── package.json        # Project dependencies
└── CLAUDE.md           # Project instructions for Claude
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

- Uses minimal required Gmail scopes (read and send only)
- Tokens stored locally with automatic refresh
- No email content stored permanently
- All operations performed locally

## Limitations

- **Rate limits**: Gmail API has daily quotas
- **Scope limitations**: Only read and send permissions
- **Token expiry**: Tokens expire after 6 months of inactivity
- **File attachments**: Not currently supported for sending
- **HTML emails**: Limited formatting support

## License

MIT

## Credits

- [AlexHramovich/gmail-mcp](https://github.com/AlexHramovich/gmail-mcp) - Original Gmail MCP server
- [GongRzhe/Gmail-MCP-Server](https://github.com/GongRzhe/Gmail-MCP-Server) - Additional feature inspiration
