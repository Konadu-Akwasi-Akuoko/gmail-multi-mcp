import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { GmailClient } from "./gmail-client.js";
import { AccountManager } from "./account-manager.js";
import {
  AccountInfo,
  GmailLabel,
  GmailFilterCriteria,
  GmailFilterAction,
  ParsedEmailMessage,
} from "./types.js";
import { validateDownloadPath } from "./email-utils.js";
import {
  createLabel,
  updateLabel,
  deleteLabel,
  listLabels,
  getOrCreateLabel,
} from "./label-manager.js";
import {
  createFilter,
  listFilters,
  getFilter,
  deleteFilter,
  filterTemplates,
} from "./filter-manager.js";

const server = new McpServer({
  name: "gmail-mcp-server",
  version: "2.0.0",
});

const accountManager = new AccountManager();

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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorResult(error: unknown) {
  return {
    content: [{ type: "text" as const, text: `Error: ${formatError(error)}` }],
    isError: true as const,
  };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function formatParsedEmail(
  message: ParsedEmailMessage,
  accountEmail: string,
): string {
  const contentTypeNote =
    !message.body && message.htmlBody
      ? "[Note: This email is HTML-formatted. Plain text version not available.]\n\n"
      : "";

  const body = message.body || message.htmlBody || "";

  const attachmentInfo =
    message.attachments.length > 0
      ? `\n\nAttachments (${message.attachments.length}):\n` +
        message.attachments
          .map(
            (a) =>
              `- ${a.filename} (${a.mimeType}, ${Math.round(a.size / 1024)} KB, ID: ${a.id})`,
          )
          .join("\n")
      : "";

  return (
    `Email from account: ${accountEmail}\n` +
    `Thread ID: ${message.threadId}\n` +
    `Subject: ${message.subject}\n` +
    `From: ${message.from}\n` +
    `To: ${message.to}\n` +
    `Date: ${message.date}\n` +
    `Labels: ${message.labelIds.join(", ")}\n\n` +
    `${contentTypeNote}${body}${attachmentInfo}`
  );
}

// Shared schema fragments
const accountParam = z
  .string()
  .email()
  .optional()
  .describe("Gmail account to use (defaults to default account)");

// ─── Email Tools ────────────────────────────────────────────────────────────

server.tool(
  "send_email",
  {
    account: accountParam,
    to: z.array(z.string().email()).describe("Recipient email addresses"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body content (plain text)"),
    htmlBody: z
      .string()
      .optional()
      .describe("HTML version of the email body"),
    mimeType: z
      .enum(["text/plain", "text/html", "multipart/alternative"])
      .optional()
      .describe("Email content type"),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    threadId: z.string().optional().describe("Thread ID to reply to"),
    inReplyTo: z
      .string()
      .optional()
      .describe("Message ID being replied to"),
    attachments: z
      .array(z.string())
      .optional()
      .describe("List of file paths to attach"),
  },
  async ({
    account,
    to,
    subject,
    body,
    htmlBody,
    mimeType,
    cc,
    bcc,
    threadId,
    inReplyTo,
    attachments,
  }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const messageId = await gmailClient.sendEmail({
        to,
        subject,
        body,
        htmlBody,
        mimeType,
        cc,
        bcc,
        threadId,
        inReplyTo,
        attachments,
      });
      return textResult(
        `Email sent successfully from ${gmailClient.getAccountEmail()}. Message ID: ${messageId}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "search_emails",
  {
    account: accountParam,
    query: z.string().describe("Gmail search query"),
    maxResults: z.number().optional().default(10),
  },
  async ({ account, query, maxResults }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const results = await gmailClient.searchEmails(query, maxResults);

      const formatted = results.messages
        .map(
          (r) =>
            `ID: ${r.id}\nSubject: ${r.subject}\nFrom: ${r.from}\nDate: ${r.date}\n`,
        )
        .join("\n");

      return textResult(
        `Search results from ${gmailClient.getAccountEmail()} (${results.resultSizeEstimate} estimated):\n\n${formatted}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "read_email",
  {
    account: accountParam,
    messageId: z.string().describe("Gmail message ID"),
  },
  async ({ account, messageId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const message = await gmailClient.getMessage(messageId);
      return textResult(formatParsedEmail(message, gmailClient.getAccountEmail()));
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Email Modification Tools ───────────────────────────────────────────────

server.tool(
  "modify_email",
  {
    account: accountParam,
    messageId: z.string().describe("ID of the email message to modify"),
    addLabelIds: z
      .array(z.string())
      .optional()
      .describe("Label IDs to add"),
    removeLabelIds: z
      .array(z.string())
      .optional()
      .describe("Label IDs to remove"),
  },
  async ({ account, messageId, addLabelIds, removeLabelIds }) => {
    try {
      const gmailClient = await getGmailClient(account);
      await gmailClient.modifyEmail({ messageId, addLabelIds, removeLabelIds });
      return textResult(
        `Email ${messageId} labels updated successfully (account: ${gmailClient.getAccountEmail()})`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "delete_email",
  {
    account: accountParam,
    messageId: z
      .string()
      .describe("ID of the email message to permanently delete"),
  },
  async ({ account, messageId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      await gmailClient.deleteEmail(messageId);
      return textResult(
        `Email ${messageId} deleted successfully (account: ${gmailClient.getAccountEmail()})`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "mark_as_read",
  {
    account: accountParam,
    messageId: z.string().describe("ID of the email message to mark as read"),
  },
  async ({ account, messageId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      await gmailClient.modifyEmail({
        messageId,
        removeLabelIds: ["UNREAD"],
      });
      return textResult(
        `Email ${messageId} marked as read (account: ${gmailClient.getAccountEmail()})`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "mark_as_unread",
  {
    account: accountParam,
    messageId: z
      .string()
      .describe("ID of the email message to mark as unread"),
  },
  async ({ account, messageId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      await gmailClient.modifyEmail({
        messageId,
        addLabelIds: ["UNREAD"],
      });
      return textResult(
        `Email ${messageId} marked as unread (account: ${gmailClient.getAccountEmail()})`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Batch Operations ───────────────────────────────────────────────────────

server.tool(
  "batch_modify_emails",
  {
    account: accountParam,
    messageIds: z.array(z.string()).describe("List of message IDs to modify"),
    addLabelIds: z
      .array(z.string())
      .optional()
      .describe("Label IDs to add to all messages"),
    removeLabelIds: z
      .array(z.string())
      .optional()
      .describe("Label IDs to remove from all messages"),
    batchSize: z
      .number()
      .optional()
      .default(50)
      .describe("Messages per batch (default: 50)"),
  },
  async ({ account, messageIds, addLabelIds, removeLabelIds, batchSize }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await gmailClient.batchModifyEmails(
        messageIds,
        addLabelIds,
        removeLabelIds,
        batchSize,
      );

      let text = `Batch label modification complete (account: ${gmailClient.getAccountEmail()}).\n`;
      text += `Successfully processed: ${result.successCount} messages\n`;
      if (result.failureCount > 0) {
        text += `Failed: ${result.failureCount} messages\n`;
        text += result.failures
          .map((f) => `- ${f.id}: ${f.error}`)
          .join("\n");
      }
      return textResult(text);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "batch_delete_emails",
  {
    account: accountParam,
    messageIds: z
      .array(z.string())
      .describe("List of message IDs to permanently delete"),
    batchSize: z
      .number()
      .optional()
      .default(50)
      .describe("Messages per batch (default: 50)"),
  },
  async ({ account, messageIds, batchSize }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await gmailClient.batchDeleteEmails(
        messageIds,
        batchSize,
      );

      let text = `Batch delete complete (account: ${gmailClient.getAccountEmail()}).\n`;
      text += `Successfully deleted: ${result.successCount} messages\n`;
      if (result.failureCount > 0) {
        text += `Failed: ${result.failureCount} messages\n`;
        text += result.failures
          .map((f) => `- ${f.id}: ${f.error}`)
          .join("\n");
      }
      return textResult(text);
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Attachment Tool ────────────────────────────────────────────────────────

server.tool(
  "download_attachment",
  {
    account: accountParam,
    messageId: z
      .string()
      .describe("ID of the email containing the attachment"),
    attachmentId: z.string().describe("ID of the attachment to download"),
    filename: z
      .string()
      .optional()
      .describe("Filename to save as (uses original if not provided)"),
    savePath: z
      .string()
      .optional()
      .describe("Directory to save to (defaults to current directory)"),
  },
  async ({ account, messageId, attachmentId, filename, savePath }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const { data, filename: originalFilename } =
        await gmailClient.downloadAttachment(messageId, attachmentId);

      const safeFilename = path.basename(filename || originalFilename);
      if (!safeFilename || safeFilename === "." || safeFilename === "..") {
        throw new Error("Invalid attachment filename");
      }

      const resolvedDir = path.resolve(savePath || process.cwd());
      const fullPath = path.resolve(resolvedDir, safeFilename);

      if (!fullPath.startsWith(resolvedDir + path.sep) && fullPath !== path.join(resolvedDir, safeFilename)) {
        throw new Error("Path traversal detected in attachment filename");
      }

      validateDownloadPath(fullPath);

      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }

      fs.writeFileSync(fullPath, data);

      return textResult(
        `Attachment downloaded successfully:\nFile: ${safeFilename}\nSize: ${data.length} bytes\nSaved to: ${fullPath}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Label Management Tools ─────────────────────────────────────────────────

server.tool(
  "list_email_labels",
  {
    account: accountParam,
  },
  async ({ account }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await listLabels(gmailClient.getGmailApi());

      const systemText = result.system
        .map((l: GmailLabel) => `  ID: ${l.id} | Name: ${l.name}`)
        .join("\n");
      const userText = result.user
        .map((l: GmailLabel) => `  ID: ${l.id} | Name: ${l.name}`)
        .join("\n");

      return textResult(
        `Labels for ${gmailClient.getAccountEmail()} (${result.count.total} total: ${result.count.system} system, ${result.count.user} user):\n\nSystem Labels:\n${systemText}\n\nUser Labels:\n${userText}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "create_label",
  {
    account: accountParam,
    name: z.string().describe("Name for the new label"),
    messageListVisibility: z
      .enum(["show", "hide"])
      .optional()
      .describe("Show or hide in message list"),
    labelListVisibility: z
      .enum(["labelShow", "labelShowIfUnread", "labelHide"])
      .optional()
      .describe("Visibility in label list"),
  },
  async ({ account, name, messageListVisibility, labelListVisibility }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await createLabel(gmailClient.getGmailApi(), name, {
        messageListVisibility,
        labelListVisibility,
      });
      return textResult(
        `Label created successfully:\nID: ${result.id}\nName: ${result.name}\nType: ${result.type}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "update_label",
  {
    account: accountParam,
    id: z.string().describe("ID of the label to update"),
    name: z.string().optional().describe("New name for the label"),
    messageListVisibility: z
      .enum(["show", "hide"])
      .optional()
      .describe("Show or hide in message list"),
    labelListVisibility: z
      .enum(["labelShow", "labelShowIfUnread", "labelHide"])
      .optional()
      .describe("Visibility in label list"),
  },
  async ({ account, id, name, messageListVisibility, labelListVisibility }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const updates: Record<string, string> = {};
      if (name) updates.name = name;
      if (messageListVisibility)
        updates.messageListVisibility = messageListVisibility;
      if (labelListVisibility)
        updates.labelListVisibility = labelListVisibility;

      const result = await updateLabel(
        gmailClient.getGmailApi(),
        id,
        updates,
      );
      return textResult(
        `Label updated successfully:\nID: ${result.id}\nName: ${result.name}\nType: ${result.type}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "delete_label",
  {
    account: accountParam,
    id: z.string().describe("ID of the label to delete"),
  },
  async ({ account, id }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await deleteLabel(gmailClient.getGmailApi(), id);
      return textResult(result.message);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "get_or_create_label",
  {
    account: accountParam,
    name: z.string().describe("Name of the label to get or create"),
    messageListVisibility: z
      .enum(["show", "hide"])
      .optional()
      .describe("Show or hide in message list"),
    labelListVisibility: z
      .enum(["labelShow", "labelShowIfUnread", "labelHide"])
      .optional()
      .describe("Visibility in label list"),
  },
  async ({ account, name, messageListVisibility, labelListVisibility }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await getOrCreateLabel(
        gmailClient.getGmailApi(),
        name,
        { messageListVisibility, labelListVisibility },
      );
      return textResult(
        `Label:\nID: ${result.id}\nName: ${result.name}\nType: ${result.type}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Filter Management Tools ────────────────────────────────────────────────

server.tool(
  "create_filter",
  {
    account: accountParam,
    criteria: z
      .object({
        from: z.string().optional().describe("Sender email to match"),
        to: z.string().optional().describe("Recipient email to match"),
        subject: z.string().optional().describe("Subject text to match"),
        query: z.string().optional().describe("Gmail search query"),
        negatedQuery: z
          .string()
          .optional()
          .describe("Text that must NOT be present"),
        hasAttachment: z
          .boolean()
          .optional()
          .describe("Match emails with attachments"),
        excludeChats: z
          .boolean()
          .optional()
          .describe("Exclude chat messages"),
        size: z.number().optional().describe("Email size in bytes"),
        sizeComparison: z
          .enum(["unspecified", "smaller", "larger"])
          .optional()
          .describe("Size comparison operator"),
      })
      .describe("Criteria for matching emails"),
    action: z
      .object({
        addLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to add"),
        removeLabelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to remove"),
        forward: z
          .string()
          .optional()
          .describe("Email address to forward to"),
      })
      .describe("Actions to perform on matching emails"),
  },
  async ({ account, criteria, action }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await createFilter(
        gmailClient.getGmailApi(),
        criteria,
        action,
      );

      const criteriaText = Object.entries(criteria)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      const actionText = Object.entries(action)
        .filter(
          ([, value]) =>
            value !== undefined &&
            (Array.isArray(value) ? value.length > 0 : true),
        )
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
        )
        .join(", ");

      return textResult(
        `Filter created (account: ${gmailClient.getAccountEmail()}):\nID: ${result.id}\nCriteria: ${criteriaText}\nActions: ${actionText}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "list_filters",
  {
    account: accountParam,
  },
  async ({ account }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await listFilters(gmailClient.getGmailApi());

      if (result.count === 0) {
        return textResult(
          `No filters found for ${gmailClient.getAccountEmail()}.`,
        );
      }

      const filtersText = result.filters
        .map((filter) => {
          const criteriaEntries = Object.entries(filter.criteria || {})
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");

          const actionEntries = Object.entries(filter.action || {})
            .filter(
              ([, value]) =>
                value !== undefined &&
                (Array.isArray(value) ? value.length > 0 : true),
            )
            .map(([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
            )
            .join(", ");

          return `ID: ${filter.id}\nCriteria: ${criteriaEntries}\nActions: ${actionEntries}\n`;
        })
        .join("\n");

      return textResult(
        `Filters for ${gmailClient.getAccountEmail()} (${result.count}):\n\n${filtersText}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "get_filter",
  {
    account: accountParam,
    filterId: z.string().describe("ID of the filter to retrieve"),
  },
  async ({ account, filterId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await getFilter(gmailClient.getGmailApi(), filterId);

      const criteriaText = Object.entries(result.criteria || {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");

      const actionText = Object.entries(result.action || {})
        .filter(
          ([, value]) =>
            value !== undefined &&
            (Array.isArray(value) ? value.length > 0 : true),
        )
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
        )
        .join(", ");

      return textResult(
        `Filter details:\nID: ${result.id}\nCriteria: ${criteriaText}\nActions: ${actionText}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "delete_filter",
  {
    account: accountParam,
    filterId: z.string().describe("ID of the filter to delete"),
  },
  async ({ account, filterId }) => {
    try {
      const gmailClient = await getGmailClient(account);
      const result = await deleteFilter(gmailClient.getGmailApi(), filterId);
      return textResult(result.message);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "create_filter_from_template",
  {
    account: accountParam,
    template: z
      .enum([
        "fromSender",
        "withSubject",
        "withAttachments",
        "largeEmails",
        "containingText",
        "mailingList",
      ])
      .describe("Pre-defined filter template to use"),
    parameters: z
      .object({
        senderEmail: z
          .string()
          .optional()
          .describe("Sender email (for fromSender)"),
        subjectText: z
          .string()
          .optional()
          .describe("Subject text (for withSubject)"),
        searchText: z
          .string()
          .optional()
          .describe("Text to search (for containingText)"),
        listIdentifier: z
          .string()
          .optional()
          .describe("Mailing list identifier (for mailingList)"),
        sizeInBytes: z
          .number()
          .optional()
          .describe("Size threshold in bytes (for largeEmails)"),
        labelIds: z
          .array(z.string())
          .optional()
          .describe("Label IDs to apply"),
        archive: z
          .boolean()
          .optional()
          .describe("Whether to archive (skip inbox)"),
        markAsRead: z
          .boolean()
          .optional()
          .describe("Whether to mark as read"),
        markImportant: z
          .boolean()
          .optional()
          .describe("Whether to mark as important"),
      })
      .describe("Template-specific parameters"),
  },
  async ({ account, template, parameters: params }) => {
    try {
      const gmailClient = await getGmailClient(account);

      let filterConfig: {
        criteria: GmailFilterCriteria;
        action: GmailFilterAction;
      };

      switch (template) {
        case "fromSender":
          if (!params.senderEmail)
            throw new Error(
              "senderEmail is required for fromSender template",
            );
          filterConfig = filterTemplates.fromSender(
            params.senderEmail,
            params.labelIds,
            params.archive,
          );
          break;
        case "withSubject":
          if (!params.subjectText)
            throw new Error(
              "subjectText is required for withSubject template",
            );
          filterConfig = filterTemplates.withSubject(
            params.subjectText,
            params.labelIds,
            params.markAsRead,
          );
          break;
        case "withAttachments":
          filterConfig = filterTemplates.withAttachments(params.labelIds);
          break;
        case "largeEmails":
          if (!params.sizeInBytes)
            throw new Error(
              "sizeInBytes is required for largeEmails template",
            );
          filterConfig = filterTemplates.largeEmails(
            params.sizeInBytes,
            params.labelIds,
          );
          break;
        case "containingText":
          if (!params.searchText)
            throw new Error(
              "searchText is required for containingText template",
            );
          filterConfig = filterTemplates.containingText(
            params.searchText,
            params.labelIds,
            params.markImportant,
          );
          break;
        case "mailingList":
          if (!params.listIdentifier)
            throw new Error(
              "listIdentifier is required for mailingList template",
            );
          filterConfig = filterTemplates.mailingList(
            params.listIdentifier,
            params.labelIds,
            params.archive,
          );
          break;
      }

      const result = await createFilter(
        gmailClient.getGmailApi(),
        filterConfig.criteria,
        filterConfig.action,
      );

      return textResult(
        `Filter created from template '${template}' (account: ${gmailClient.getAccountEmail()}):\nID: ${result.id}`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

// ─── Account Management Tools ───────────────────────────────────────────────

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
      return textResult(
        "No Gmail accounts configured. Use 'add_account' to add one.",
      );
    }

    return textResult(
      `Configured Gmail accounts:\n${JSON.stringify(accountInfos, null, 2)}`,
    );
  } catch (error) {
    return errorResult(error);
  }
});

server.tool(
  "add_account",
  {
    email: z.string().email().describe("Gmail account email address to add"),
  },
  async ({ email }) => {
    try {
      if (await accountManager.accountExists(email)) {
        return textResult(`Account ${email} already exists.`);
      }

      await accountManager.addAccount(email);
      return textResult(
        `Account ${email} added successfully. You may need to authenticate in your browser.`,
      );
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.tool(
  "remove_account",
  {
    email: z
      .string()
      .email()
      .describe("Gmail account email address to remove"),
  },
  async ({ email }) => {
    try {
      await accountManager.removeAccount(email);
      return textResult(`Account ${email} removed successfully.`);
    } catch (error) {
      return errorResult(error);
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
      return textResult(`Default account set to ${email}.`);
    } catch (error) {
      return errorResult(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
