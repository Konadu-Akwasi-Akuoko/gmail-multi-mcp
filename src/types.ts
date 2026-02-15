export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
}

export interface SearchEmailsResult {
  messages: EmailMessage[];
  resultSizeEstimate: number;
  nextPageToken?: string;
}

export interface GmailCredentials {
  type: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPayload {
  headers: GmailHeader[];
  body?: {
    data?: string;
  };
  parts?: GmailPayload[];
}

export interface GmailMessageData {
  id: string;
  threadId: string;
  snippet: string;
  payload: GmailPayload;
}

export interface AccountInfo {
  email: string;
  addedAt: string;
  lastUsed?: string;
  isDefault: boolean;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailContent {
  text: string;
  html: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

export interface LabelOptions {
  messageListVisibility?: string;
  labelListVisibility?: string;
}

export interface LabelListResult {
  all: GmailLabel[];
  system: GmailLabel[];
  user: GmailLabel[];
  count: {
    total: number;
    system: number;
    user: number;
  };
}

export interface GmailFilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  query?: string;
  negatedQuery?: string;
  hasAttachment?: boolean;
  excludeChats?: boolean;
  size?: number;
  sizeComparison?: 'unspecified' | 'smaller' | 'larger';
}

export interface GmailFilterAction {
  addLabelIds?: string[];
  removeLabelIds?: string[];
  forward?: string;
}

export interface GmailFilter {
  id?: string;
  criteria: GmailFilterCriteria;
  action: GmailFilterAction;
}

export interface FilterListResult {
  filters: GmailFilter[];
  count: number;
}

export interface SendEmailParamsExtended extends SendEmailParams {
  htmlBody?: string;
  mimeType?: 'text/plain' | 'text/html' | 'multipart/alternative';
  threadId?: string;
  inReplyTo?: string;
  attachments?: string[];
}

export interface ModifyEmailParams {
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface BatchOperationResult {
  successCount: number;
  failureCount: number;
  failures: Array<{ id: string; error: string }>;
}

export interface ParsedEmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  htmlBody: string;
  snippet: string;
  labelIds: string[];
  attachments: EmailAttachment[];
}

export interface DownloadAttachmentResult {
  filename: string;
  size: number;
  savedPath: string;
}