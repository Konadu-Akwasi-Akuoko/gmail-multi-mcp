import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GmailClient } from "./gmail-client.js";
import { AccountManager } from "./account-manager.js";
import { AccountInfo } from "./types.js";

const server = new McpServer({
  name: "gmail-mcp-server",
  version: "1.0.0",
});

const accountManager = new AccountManager();

// Helper function to get Gmail client for an account
async function getGmailClient(account?: string): Promise<GmailClient> {
  let email = account;

  if (!email) {
    const defaultAccount = await accountManager.getDefaultAccount();
    if (!defaultAccount) {
      throw new Error(
        "No account specified and no default account set. Please add an account first.",
      );
    }
    email = defaultAccount;
  }

  const auth = await accountManager.getAccountAuth(email);
  return new GmailClient(auth, email);
}

// Email tools with account parameter
server.tool(
  "send_email",
  {
    account: z
      .string()
      .email()
      .optional()
      .describe("Gmail account to use (defaults to default account)"),
    to: z.array(z.string().email()).describe("Recipient email addresses"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body content"),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
  },
  async ({ account, to, subject, body, cc, bcc }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const messageId = await gmailClient.sendEmail({
        to,
        subject,
        body,
        cc,
        bcc,
      });
      return {
        content: [
          {
            type: "text",
            text: `Email sent successfully from ${gmailClient.getAccountEmail()}. Message ID: ${messageId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "search_emails",
  {
    account: z
      .string()
      .email()
      .optional()
      .describe("Gmail account to use (defaults to default account)"),
    query: z.string().describe("Gmail search query"),
    maxResults: z.number().optional().default(10),
  },
  async ({ account, query, maxResults }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const results = await gmailClient.searchEmails(query, maxResults);
      return {
        content: [
          {
            type: "text",
            text: `Search results from ${gmailClient.getAccountEmail()}:\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "read_email",
  {
    account: z
      .string()
      .email()
      .optional()
      .describe("Gmail account to use (defaults to default account)"),
    messageId: z.string().describe("Gmail message ID"),
  },
  async ({ account, messageId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const message = await gmailClient.getMessage(messageId);
      return {
        content: [
          {
            type: "text",
            text: `Email from ${gmailClient.getAccountEmail()}:\n${JSON.stringify(message, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Account management tools
server.tool("list_accounts", {}, async () => {
  try {
    const accounts = await accountManager.listAccounts();
    const defaultAccount = await accountManager.getDefaultAccount();

    const accountInfos: AccountInfo[] = accounts.map((acc) => ({
      email: acc.email,
      addedAt: acc.addedAt,
      lastUsed: acc.lastUsed,
      isDefault: acc.email === defaultAccount,
    }));

    if (accountInfos.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No Gmail accounts configured. Use 'add_account' to add one.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Configured Gmail accounts:\n${JSON.stringify(accountInfos, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

server.tool(
  "add_account",
  {
    email: z.string().email().describe("Gmail account email address to add"),
  },
  async ({ email }) => {
    try {
      // Check if account already exists
      if (await accountManager.accountExists(email)) {
        return {
          content: [
            {
              type: "text",
              text: `Account ${email} already exists.`,
            },
          ],
        };
      }

      await accountManager.addAccount(email);
      return {
        content: [
          {
            type: "text",
            text: `Account ${email} added successfully. You may need to authenticate in your browser.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "remove_account",
  {
    email: z.string().email().describe("Gmail account email address to remove"),
  },
  async ({ email }) => {
    try {
      await accountManager.removeAccount(email);
      return {
        content: [
          {
            type: "text",
            text: `Account ${email} removed successfully.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "set_default_account",
  {
    email: z.string().email().describe("Gmail account to set as default"),
  },
  async ({ email }) => {
    try {
      await accountManager.setDefaultAccount(email);
      return {
        content: [
          {
            type: "text",
            text: `Default account set to ${email}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
