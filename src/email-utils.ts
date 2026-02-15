import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import nodemailer from "nodemailer";
import type {
  SendEmailParamsExtended,
  GmailMessagePart,
  EmailContent,
} from "./types.js";

/**
 * RFC 2047 MIME encoding for non-ASCII email headers.
 * Only encodes if the text contains non-ASCII characters.
 */
export function encodeEmailHeader(text: string): string {
  if (/[^\x00-\x7F]/.test(text)) {
    return "=?UTF-8?B?" + Buffer.from(text).toString("base64") + "?=";
  }
  return text;
}

/**
 * Validates an email address using a simple regex pattern.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Strips CR and LF characters from a string to prevent MIME header injection.
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

const SENSITIVE_PATH_PATTERNS = [
  /[/\\]\.ssh[/\\]/i,
  /[/\\]\.gnupg[/\\]/i,
  /[/\\]\.aws[/\\]/i,
  /[/\\]\.config[/\\]gcloud[/\\]/i,
  /[/\\]\.docker[/\\]/i,
  /[/\\]\.kube[/\\]/i,
  /[/\\]\.npmrc$/i,
  /[/\\]\.netrc$/i,
  /[/\\]\.env(\..+)?$/i,
  /[/\\]credentials\.json$/i,
  /[/\\]token\.json$/i,
  /[/\\]\.git[/\\]/i,
  /^\/etc[/\\]/i,
];

/**
 * Validates that a resolved path does not fall inside a known sensitive location.
 * Shared logic used by both read (attachment sending) and write (attachment download) checks.
 */
function isSensitivePath(resolvedPath: string): boolean {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(resolvedPath)) {
      return true;
    }
  }

  const accountsDir = resolve("accounts");
  if (
    resolvedPath.startsWith(accountsDir + "/") ||
    resolvedPath === accountsDir
  ) {
    return true;
  }

  return false;
}

/**
 * Validates that an attachment file path does not point to known sensitive locations.
 * Throws if the resolved path matches a blocked pattern.
 */
export function validateAttachmentPath(filePath: string): void {
  const resolved = resolve(filePath);
  if (isSensitivePath(resolved)) {
    throw new Error(
      `Attachment blocked for security reasons: ${filePath} matches a sensitive path pattern`,
    );
  }
}

/**
 * Validates that a download destination path does not target a known sensitive directory.
 * Checks both the directory and the full file path to prevent writing attacker-controlled
 * email attachment content to locations like ~/.ssh, ~/.bashrc, ~/.aws, etc.
 */
export function validateDownloadPath(fullPath: string): void {
  const resolved = resolve(fullPath);
  if (isSensitivePath(resolved)) {
    throw new Error(
      `Download blocked for security reasons: target path ${fullPath} is inside a sensitive directory`,
    );
  }
}

/**
 * Creates a MIME email message string for plain text, HTML, or multipart content.
 * Does not support attachments -- use createEmailWithNodemailer for that.
 */
export function createEmailMessage(params: SendEmailParamsExtended): string {
  const encodedSubject = sanitizeHeaderValue(encodeEmailHeader(params.subject));
  let mimeType = params.mimeType || "text/plain";

  if (params.htmlBody && mimeType !== "text/plain") {
    mimeType = "multipart/alternative";
  }

  const boundary = `----=_NextPart_${Math.random().toString(36).substring(2)}`;

  for (const email of params.to) {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  }

  const safeInReplyTo = params.inReplyTo
    ? sanitizeHeaderValue(params.inReplyTo)
    : undefined;

  const emailParts = [
    "From: me",
    `To: ${params.to.map(sanitizeHeaderValue).join(", ")}`,
    params.cc ? `Cc: ${params.cc.map(sanitizeHeaderValue).join(", ")}` : "",
    params.bcc ? `Bcc: ${params.bcc.map(sanitizeHeaderValue).join(", ")}` : "",
    `Subject: ${encodedSubject}`,
    safeInReplyTo ? `In-Reply-To: ${safeInReplyTo}` : "",
    safeInReplyTo ? `References: ${safeInReplyTo}` : "",
    "MIME-Version: 1.0",
  ].filter(Boolean);

  if (mimeType === "multipart/alternative") {
    emailParts.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    );
    emailParts.push("");
    emailParts.push(`--${boundary}`);
    emailParts.push("Content-Type: text/plain; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(params.body);
    emailParts.push("");
    emailParts.push(`--${boundary}`);
    emailParts.push("Content-Type: text/html; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(params.htmlBody || params.body);
    emailParts.push("");
    emailParts.push(`--${boundary}--`);
  } else if (mimeType === "text/html") {
    emailParts.push("Content-Type: text/html; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(params.htmlBody || params.body);
  } else {
    emailParts.push("Content-Type: text/plain; charset=UTF-8");
    emailParts.push("Content-Transfer-Encoding: 7bit");
    emailParts.push("");
    emailParts.push(params.body);
  }

  return emailParts.join("\r\n");
}

/**
 * Creates a full RFC 822 email message with attachment support via Nodemailer.
 * Uses streamTransport to build the raw message without actually sending it.
 */
export async function createEmailWithNodemailer(
  params: SendEmailParamsExtended
): Promise<string> {
  for (const email of params.to) {
    if (!validateEmail(email)) {
      throw new Error(`Recipient email address is invalid: ${email}`);
    }
  }

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });

  const attachments: Array<{ filename: string; path: string }> = [];
  if (params.attachments) {
    for (const filePath of params.attachments) {
      validateAttachmentPath(filePath);
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      const fileName = basename(filePath);
      attachments.push({
        filename: fileName,
        path: filePath,
      });
    }
  }

  const mailOptions = {
    from: "me",
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    text: params.body,
    html: params.htmlBody,
    attachments,
    inReplyTo: params.inReplyTo,
    references: params.inReplyTo,
  };

  const info = await transporter.sendMail(mailOptions);
  return (info.message as Buffer).toString();
}

/**
 * Recursively extracts text and HTML content from a Gmail message MIME structure.
 */
export function extractEmailContent(messagePart: GmailMessagePart): EmailContent {
  let text = "";
  let html = "";

  if (messagePart.body?.data) {
    const decoded = Buffer.from(messagePart.body.data, "base64").toString(
      "utf8"
    );
    if (messagePart.mimeType === "text/plain") {
      text = decoded;
    } else if (messagePart.mimeType === "text/html") {
      html = decoded;
    }
  }

  if (messagePart.parts) {
    for (const part of messagePart.parts) {
      const content = extractEmailContent(part);
      text += content.text;
      html += content.html;
    }
  }

  return { text, html };
}
