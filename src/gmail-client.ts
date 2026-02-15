import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import {
  SendEmailParamsExtended,
  SearchEmailsResult,
  ParsedEmailMessage,
  ModifyEmailParams,
  BatchOperationResult,
  EmailAttachment,
  GmailMessagePart,
} from './types.js';
import {
  createEmailMessage,
  createEmailWithNodemailer,
  extractEmailContent,
} from './email-utils.js';

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private accountEmail: string;

  constructor(auth: OAuth2Client, accountEmail: string) {
    this.accountEmail = accountEmail;
    // OAuth2Client version mismatch between google-auth-library and googleapis-common
    this.gmail = google.gmail({ version: 'v1', auth: auth as unknown as gmail_v1.Options['auth'] });
  }

  getAccountEmail(): string {
    return this.accountEmail;
  }

  getGmailApi(): gmail_v1.Gmail {
    return this.gmail;
  }

  async sendEmail(params: SendEmailParamsExtended): Promise<string> {
    let rawMessage: string;

    if (params.attachments && params.attachments.length > 0) {
      rawMessage = await createEmailWithNodemailer(params);
    } else {
      rawMessage = createEmailMessage(params);
    }

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        ...(params.threadId && { threadId: params.threadId }),
      },
    });

    return res.data.id!;
  }

  async searchEmails(
    query: string,
    maxResults: number = 10,
  ): Promise<SearchEmailsResult> {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = await Promise.all(
      (res.data.messages || []).map(async (msg) => {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = detail.data.payload?.headers || [];
        return {
          id: msg.id!,
          threadId: msg.threadId || '',
          snippet: detail.data.snippet || '',
          subject:
            headers.find((h) => h.name === 'Subject')?.value || '',
          from: headers.find((h) => h.name === 'From')?.value || '',
          date: headers.find((h) => h.name === 'Date')?.value || '',
        };
      }),
    );

    return {
      messages,
      resultSizeEstimate: res.data.resultSizeEstimate ?? 0,
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  }

  async getMessage(messageId: string): Promise<ParsedEmailMessage> {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const data = res.data;
    const headers = data.payload?.headers || [];
    const { text, html } = extractEmailContent(
      (data.payload as GmailMessagePart) || {},
    );
    const attachments = this.extractAttachments(
      (data.payload as GmailMessagePart) || {},
    );

    return {
      id: data.id || messageId,
      threadId: data.threadId || '',
      subject: this.extractHeader(headers, 'Subject'),
      from: this.extractHeader(headers, 'From'),
      to: this.extractHeader(headers, 'To'),
      date: this.extractHeader(headers, 'Date'),
      body: text,
      htmlBody: html,
      snippet: data.snippet || '',
      labelIds: (data.labelIds as string[]) || [],
      attachments,
    };
  }

  async modifyEmail(params: ModifyEmailParams): Promise<string> {
    const requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } =
      {};
    if (params.addLabelIds) requestBody.addLabelIds = params.addLabelIds;
    if (params.removeLabelIds)
      requestBody.removeLabelIds = params.removeLabelIds;

    await this.gmail.users.messages.modify({
      userId: 'me',
      id: params.messageId,
      requestBody,
    });

    return params.messageId;
  }

  async deleteEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.delete({
      userId: 'me',
      id: messageId,
    });
  }

  async downloadAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<{ data: Buffer; filename: string }> {
    const attachmentRes = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    if (!attachmentRes.data.data) {
      throw new Error('No attachment data received');
    }

    const buffer = Buffer.from(attachmentRes.data.data, 'base64url');

    const messageRes = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const filename =
      this.findAttachmentFilename(
        messageRes.data.payload as GmailMessagePart,
        attachmentId,
      ) || `attachment-${attachmentId}`;

    return { data: buffer, filename };
  }

  async batchModifyEmails(
    messageIds: string[],
    addLabelIds?: string[],
    removeLabelIds?: string[],
    batchSize: number = 50,
  ): Promise<BatchOperationResult> {
    const failures: Array<{ id: string; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          this.gmail.users.messages.modify({
            userId: 'me',
            id,
            requestBody: { addLabelIds, removeLabelIds },
          }),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failures.push({
            id: batch[j],
            error: result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          });
        }
      }
    }

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  }

  async batchDeleteEmails(
    messageIds: string[],
    batchSize: number = 50,
  ): Promise<BatchOperationResult> {
    const failures: Array<{ id: string; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          this.gmail.users.messages.delete({ userId: 'me', id }),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failures.push({
            id: batch[j],
            error: result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          });
        }
      }
    }

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  }

  private extractHeader(
    headers: Array<{ name?: string | null; value?: string | null }>,
    headerName: string,
  ): string {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === headerName.toLowerCase(),
    );
    return header?.value || '';
  }

  private extractAttachments(messagePart: GmailMessagePart): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (messagePart.body?.attachmentId) {
      attachments.push({
        id: messagePart.body.attachmentId,
        filename: messagePart.filename || `attachment-${messagePart.body.attachmentId}`,
        mimeType: messagePart.mimeType || 'application/octet-stream',
        size: messagePart.body.size || 0,
      });
    }

    if (messagePart.parts) {
      for (const part of messagePart.parts) {
        attachments.push(...this.extractAttachments(part));
      }
    }

    return attachments;
  }

  private findAttachmentFilename(
    part: GmailMessagePart | undefined | null,
    attachmentId: string,
  ): string | null {
    if (!part) return null;

    if (part.body?.attachmentId === attachmentId) {
      return part.filename || null;
    }

    if (part.parts) {
      for (const subpart of part.parts) {
        const found = this.findAttachmentFilename(subpart, attachmentId);
        if (found) return found;
      }
    }

    return null;
  }
}
