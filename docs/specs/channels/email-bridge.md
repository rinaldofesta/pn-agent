# Email Bridge Channel Specification

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2026-02-25
**Owner:** Technical Architecture

---

## Context

The email bridge is a forward-mode input channel that enables users to forward emails to their personal AI assistant for analysis. Unlike Slack and Teams (which are real-time conversational channels), email is asynchronous and one-directional in nature: the user forwards content, the assistant processes it, and the assistant replies via email. This maps directly to the PRD's forward mode -- the lowest-friction way for users to share content with their assistant.

The email bridge is particularly valuable for:
- **Email-heavy users** who spend most of their time in Outlook/Gmail and want analysis without switching to Slack/Teams
- **Forwarding sensitive communications** (negotiations, escalations, executive emails) for private analysis
- **Document analysis** by forwarding emails with PDF, Word, or Excel attachments
- **Cross-channel input** allowing a user who primarily uses Slack to also forward emails when convenient

---

## Nanoclaw Foundation

Nanoclaw does not include an email channel implementation. The `Channel` interface from `container/agent-runner/src/types.ts` serves as the contract. The email bridge implements `PlayNewChannel` with email-specific behavior for the asynchronous, forward-mode interaction pattern.

**What we inherit from nanoclaw:**
- The `Channel` interface contract
- JID-based routing pattern

**What we build new:**
- IMAP listener for inbound email reception
- Email parsing (headers, body, attachments)
- HTML-to-markdown conversion
- SMTP client for outbound responses
- Per-user dedicated email addresses
- Attachment extraction (PDF, Word, Excel)
- Privacy-preserving email processing (header stripping)

---

## Play New Requirements

From the PRD:

- **Section 8.1 (Phase 0 Scope):** Email (IMAP/SMTP) is a "Must" integration
- **Section 8.3 (User Journey):** "User forwards any email to their assistant's dedicated email address -> assistant analyzes, summarizes, suggests response, flags risks, connects to organizational context"
- **Section 14.1 (Phase 0 Integrations):** Email (IMAP/SMTP) bridge service for forward mode email processing
- **Section 16.1 (Email Bridge Design):** Each user gets a dedicated assistant email (`matteo.assistant@playnew.ai`); reply includes summary, key actions, risks, org context connections, suggested response
- **Section 22.1 (Forward Mode Email Decision):** Dedicated email per user recommended. Clearest UX, simplest routing.
- **FR-002.1:** User can forward emails to a dedicated assistant email address
- **FR-002.2:** Assistant processes forwarded email: summarizes, extracts action items, identifies risks, suggests response
- **FR-002.5:** User can attach documents (PDF, Word, Excel) to assistant messages for analysis

---

## Technical Specification

### Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│              User's Email Client                       │
│  (Gmail, Outlook, Apple Mail, etc.)                   │
│                                                       │
│  User forwards email to:                              │
│  matteo.assistant@playnew.ai                          │
└───────────────────┬───────────────────────────────────┘
                    │ SMTP
                    ▼
┌───────────────────────────────────────────────────────┐
│              Email Infrastructure                      │
│  (Postfix / SES / Mailgun)                            │
│                                                       │
│  Receives mail for *@playnew.ai                       │
│  Stores in IMAP mailbox                               │
└───────────────────┬───────────────────────────────────┘
                    │ IMAP (polling or IDLE)
                    ▼
┌───────────────────────────────────────────────────────┐
│           EmailBridgeChannel Adapter                   │
│                                                       │
│  ┌──────────────┐  ┌────────────────────┐             │
│  │ IMAP Listener│  │ Email Parser       │             │
│  │ (polling     │  │ - Header extract   │             │
│  │  every 30s)  │  │ - Body extract     │             │
│  └──────┬───────┘  │ - HTML→Markdown    │             │
│         │          │ - Attachment parse  │             │
│         ▼          └────────┬───────────┘             │
│  ┌─────────────────────────┐│                         │
│  │ Address Router          ││                         │
│  │ {username}.assistant    ││                         │
│  │ → user instance lookup  │◄                         │
│  └──────────┬──────────────┘                          │
│             │                                         │
│  ┌──────────▼──────────────┐                          │
│  │ SMTP Client             │                          │
│  │ (outbound responses)    │                          │
│  └─────────────────────────┘                          │
└───────────────────┬───────────────────────────────────┘
                    │
                    ▼
           PlayNewChannel Router
           (to user instances)
```

### Email Address Format

Each user receives a dedicated email address for their assistant:

```
{username}.assistant@playnew.ai
```

**Examples:**
- `matteo.assistant@playnew.ai`
- `sarah.corti.assistant@playnew.ai`
- `rinaldo.festa.assistant@playnew.ai`

**Address derivation rules:**

| Rule | Description | Example |
|------|-------------|---------|
| Base format | `{first_name}.{last_name}.assistant@playnew.ai` | `matteo.roversi.assistant@playnew.ai` |
| Collision handling | Append numeric suffix | `matteo.roversi.2.assistant@playnew.ai` |
| Special characters | Replace with hyphen | `jean-pierre.assistant@playnew.ai` |
| Case | Always lowercase | `Matteo` -> `matteo` |
| Domain | `playnew.ai` (Phase 0), custom domain (Phase 1) | -- |

**Address registration (PostgreSQL):**

```sql
CREATE TABLE user_email_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  email_address   VARCHAR(200) NOT NULL UNIQUE,
  email_hash      VARCHAR(64) NOT NULL,  -- SHA-256 for JID
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(email_address)
);

CREATE INDEX idx_uea_hash ON user_email_addresses(email_hash);
CREATE INDEX idx_uea_user ON user_email_addresses(user_id);
```

### JID Format

```
email:{sha256(user_assistant_email_address)}
```

The email address itself is hashed for the JID to avoid PII in routing identifiers:

```typescript
import { createHash } from 'crypto';

function createEmailJid(assistantEmail: string): string {
  const hash = createHash('sha256')
    .update(assistantEmail.toLowerCase().trim())
    .digest('hex');
  return `email:${hash}`;
}

// Example:
// createEmailJid('matteo.assistant@playnew.ai')
// => 'email:7a3f2b1c...'
```

### EmailBridgeChannel Implementation

```typescript
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail, Attachment as MailAttachment } from 'mailparser';
import { createTransport, Transporter } from 'nodemailer';
import TurndownService from 'turndown';
import type {
  PlayNewChannel,
  InboundMessage,
  ChatMetadata,
  RichMessage,
  Attachment,
  ChannelCapabilities,
  OnInboundMessage,
  OnChatMetadata,
} from '../types';

interface EmailBridgeConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  domain: string; // e.g., 'playnew.ai'
  pollIntervalMs: number; // e.g., 30000 (30 seconds)
}

export class EmailBridgeChannel implements PlayNewChannel {
  readonly name = 'email';
  readonly orgId: string;

  private imapClient: ImapFlow;
  private smtpTransport: Transporter;
  private turndown: TurndownService;
  private config: EmailBridgeConfig;
  private connected = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private messageCallback: OnInboundMessage | null = null;
  private metadataCallback: OnChatMetadata | null = null;

  /** Cache: email_hash -> user email address mapping */
  private addressMap = new Map<string, { userId: string; orgId: string; email: string }>();

  constructor(orgId: string, config: EmailBridgeConfig) {
    this.orgId = orgId;
    this.config = config;

    this.imapClient = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: config.imap.auth,
      logger: false,
    });

    this.smtpTransport = createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
    });

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
  }

  // ── NanoclawChannel methods ─────────────────────────────────

  async connect(): Promise<void> {
    await this.imapClient.connect();
    await this.loadAddressMap();
    this.connected = true;

    // Start polling for new emails
    this.startPolling();
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    await this.sendRichMessage(jid, { text });
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('email:');
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.imapClient.logout();
    this.smtpTransport.close();
    this.connected = false;
  }

  // ── PlayNewChannel extensions ───────────────────────────────

  async sendRichMessage(jid: string, message: RichMessage): Promise<void> {
    const userInfo = this.resolveJidToEmail(jid);
    if (!userInfo) {
      throw new Error(`Cannot resolve email JID: ${jid}`);
    }

    // Build email body from RichMessage
    const { textBody, htmlBody } = this.formatEmailResponse(message);

    await this.smtpTransport.sendMail({
      from: `"Play New Assistant" <assistant@${this.config.domain}>`,
      to: userInfo.userEmail, // Reply to the user's real email, not their assistant address
      subject: this.deriveSubject(message),
      text: textBody,
      html: htmlBody,
    });
  }

  async sendFile(jid: string, attachment: Attachment): Promise<void> {
    const userInfo = this.resolveJidToEmail(jid);
    if (!userInfo) return;

    const attachments: any[] = [];
    if (attachment.content) {
      attachments.push({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.mimeType,
      });
    } else if (attachment.url) {
      attachments.push({
        filename: attachment.filename,
        path: attachment.url,
      });
    }

    await this.smtpTransport.sendMail({
      from: `"Play New Assistant" <assistant@${this.config.domain}>`,
      to: userInfo.userEmail,
      subject: `File: ${attachment.filename}`,
      text: `Attached: ${attachment.filename}`,
      attachments,
    });
  }

  onMessage(callback: OnInboundMessage): void {
    this.messageCallback = callback;
  }

  onMetadata(callback: OnChatMetadata): void {
    this.metadataCallback = callback;
  }

  async resolveUser(channelUserId: string): Promise<ChatMetadata | null> {
    const entry = this.addressMap.get(channelUserId);
    if (!entry) return null;

    return {
      userId: entry.userId,
      orgId: entry.orgId,
      channelName: 'email',
      displayName: entry.email.split('@')[0].replace('.assistant', ''),
      channelUserId,
      capabilities: this.getCapabilities(),
    };
  }

  async listUsers(): Promise<string[]> {
    return Array.from(this.addressMap.keys()).map((hash) => `email:${hash}`);
  }

  getCapabilities(): ChannelCapabilities {
    return {
      richFormatting: true, // HTML email
      fileUpload: true,
      fileDownload: true,
      threading: false, // Email threading is limited
      reactions: false,
      typingIndicator: false,
      slashCommands: false,
      ephemeralMessages: false,
      maxMessageLength: 100000, // Effectively unlimited
    };
  }

  async openDM(channelUserId: string): Promise<string> {
    // Email doesn't have "DMs" -- the address itself is the channel
    return `email:${channelUserId}`;
  }

  // ── Private: Email Polling ──────────────────────────────────

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        await this.checkNewEmails();
      } catch (error) {
        console.error(`[EmailBridge:${this.orgId}] Poll error:`, error);
      }
    }, this.config.pollIntervalMs);

    // Also check immediately
    this.checkNewEmails().catch(console.error);
  }

  private async checkNewEmails(): Promise<void> {
    const lock = await this.imapClient.getMailboxLock('INBOX');

    try {
      // Fetch unseen messages
      const messages = this.imapClient.fetch(
        { seen: false },
        {
          envelope: true,
          source: true,
          bodyStructure: true,
        }
      );

      for await (const msg of messages) {
        try {
          await this.processEmail(msg);
          // Mark as seen after processing
          await this.imapClient.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        } catch (error) {
          console.error(
            `[EmailBridge:${this.orgId}] Failed to process email ${msg.uid}:`,
            error
          );
        }
      }
    } finally {
      lock.release();
    }
  }

  private async processEmail(rawMessage: any): Promise<void> {
    const parsed = await simpleParser(rawMessage.source);

    // Determine which assistant address was the recipient
    const recipientAddress = this.findAssistantRecipient(parsed);
    if (!recipientAddress) {
      // Not addressed to any known assistant address -- ignore
      return;
    }

    // Resolve to user
    const emailHash = this.hashEmail(recipientAddress);
    const userInfo = this.addressMap.get(emailHash);
    if (!userInfo) {
      // Unknown recipient -- maybe a typo or spam
      return;
    }

    const metadata = await this.resolveUser(emailHash);
    if (!metadata) return;

    // Extract content
    const { text, isForwarded, originalSender } = this.extractContent(parsed);
    const attachments = await this.extractAttachments(parsed);

    const inbound: InboundMessage = {
      messageId: `email:${parsed.messageId || Date.now()}`,
      senderJid: `email:${emailHash}`,
      conversationJid: `email:${emailHash}`,
      text,
      attachments,
      timestamp: parsed.date || new Date(),
      rawMetadata: {
        subject: parsed.subject,
        from: this.sanitizeSender(parsed.from?.text),
        isForwarded,
        originalSender: originalSender ? this.sanitizeSender(originalSender) : undefined,
        hasAttachments: attachments.length > 0,
        // Original headers stripped for privacy -- only metadata preserved
      },
    };

    if (this.messageCallback) {
      await this.messageCallback(inbound, metadata);
    }
  }

  // ── Private: Content Extraction ─────────────────────────────

  /**
   * Extract the meaningful text content from a parsed email.
   * Handles both forwarded emails and direct messages.
   */
  private extractContent(parsed: ParsedMail): {
    text: string;
    isForwarded: boolean;
    originalSender: string | null;
  } {
    let text = '';
    let isForwarded = false;
    let originalSender: string | null = null;

    // Check if this is a forwarded email
    const subject = parsed.subject || '';
    isForwarded =
      subject.startsWith('Fwd:') ||
      subject.startsWith('FW:') ||
      subject.startsWith('Fw:');

    // Prefer plain text, fall back to HTML-to-markdown
    if (parsed.text) {
      text = parsed.text;
    } else if (parsed.html) {
      text = this.turndown.turndown(parsed.html);
    }

    // Extract original sender from forwarded email headers
    if (isForwarded) {
      const fromMatch = text.match(
        /(?:From|De|Von|Da):\s*(.+?)(?:\n|$)/i
      );
      if (fromMatch) {
        originalSender = fromMatch[1].trim();
      }
    }

    // Clean up email artifacts
    text = this.cleanEmailText(text);

    return { text, isForwarded, originalSender };
  }

  /**
   * Extract attachments from a parsed email.
   * Supports common document types for Phase 0.
   */
  private async extractAttachments(parsed: ParsedMail): Promise<Attachment[]> {
    if (!parsed.attachments || parsed.attachments.length === 0) return [];

    const supportedTypes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
    ]);

    const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

    return parsed.attachments
      .filter((att: MailAttachment) => {
        if (!supportedTypes.has(att.contentType)) {
          console.warn(
            `[EmailBridge] Skipping unsupported attachment type: ${att.contentType}`
          );
          return false;
        }
        if (att.size > MAX_ATTACHMENT_SIZE) {
          console.warn(
            `[EmailBridge] Skipping oversized attachment: ${att.filename} (${att.size} bytes)`
          );
          return false;
        }
        return true;
      })
      .map((att: MailAttachment) => ({
        filename: att.filename || 'unnamed',
        mimeType: att.contentType,
        content: att.content,
        sizeBytes: att.size,
      }));
  }

  // ── Private: Email Response Formatting ──────────────────────

  /**
   * Format assistant response as an email body.
   * Follows email conventions with privacy footer.
   */
  private formatEmailResponse(message: RichMessage): {
    textBody: string;
    htmlBody: string;
  } {
    const privacyFooter =
      '\n\n---\n' +
      'This analysis is private to you. Original email content is stored ' +
      'only in your personal memory. You can ask me to forget any ' +
      'information at any time.\n\n' +
      '-- Play New Assistant\nhttps://playnew.ai';

    // Plain text version
    let textBody = message.text;

    // Process blocks into structured text
    if (message.blocks) {
      const blockText = message.blocks
        .map((block) => {
          switch (block.type) {
            case 'header':
              return `\n## ${block.text}\n`;
            case 'section':
              if (block.fields) {
                return block.fields
                  .map((f) => `**${f.label}:** ${f.value}`)
                  .join('\n');
              }
              return block.text || '';
            case 'divider':
              return '\n---\n';
            case 'context':
              return `> ${block.text}`;
            default:
              return block.text || '';
          }
        })
        .join('\n\n');

      textBody = textBody + '\n\n' + blockText;
    }

    textBody += privacyFooter;

    // HTML version
    const htmlBody = this.textToHtml(textBody);

    return { textBody, htmlBody };
  }

  /**
   * Derive an email subject line from the response.
   */
  private deriveSubject(message: RichMessage): string {
    // Look for a header block
    const headerBlock = message.blocks?.find((b) => b.type === 'header');
    if (headerBlock?.text) {
      return `Play New: ${headerBlock.text}`;
    }

    // Fall back to first line of text, truncated
    const firstLine = message.text.split('\n')[0];
    if (firstLine.length > 60) {
      return `Play New: ${firstLine.substring(0, 57)}...`;
    }
    return `Play New: ${firstLine}`;
  }

  // ── Private: Utility Methods ────────────────────────────────

  private findAssistantRecipient(parsed: ParsedMail): string | null {
    const allRecipients = [
      ...(parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : []),
      ...(parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : []),
    ];

    for (const recipient of allRecipients) {
      if ('value' in recipient) {
        for (const addr of recipient.value) {
          if (addr.address && addr.address.endsWith(`.assistant@${this.config.domain}`)) {
            return addr.address.toLowerCase();
          }
        }
      }
    }

    return null;
  }

  private hashEmail(email: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  private resolveJidToEmail(
    jid: string
  ): { assistantEmail: string; userEmail: string } | null {
    const hash = jid.replace('email:', '');
    const entry = this.addressMap.get(hash);
    if (!entry) return null;

    // Look up the user's real email from the database
    // (not the assistant address)
    return {
      assistantEmail: entry.email,
      userEmail: '', // Resolved from user database at runtime
    };
  }

  /**
   * Sanitize sender information: keep display name, hash email.
   * This prevents PII from leaking into metadata.
   */
  private sanitizeSender(senderText: string | undefined): string {
    if (!senderText) return 'unknown';
    // Keep display name, remove or hash email
    const match = senderText.match(/^(.+?)\s*<.+>$/);
    if (match) {
      return match[1].trim();
    }
    // If it's just an email address, return a generic label
    if (senderText.includes('@')) {
      return 'external sender';
    }
    return senderText;
  }

  /**
   * Clean up common email artifacts from extracted text.
   */
  private cleanEmailText(text: string): string {
    return (
      text
        // Remove email signature delimiters and content below
        // (keep the forwarded content above the signature)
        .replace(/\n-- \n[\s\S]*$/, '')
        // Remove excessive blank lines
        .replace(/\n{4,}/g, '\n\n\n')
        // Remove email disclaimer blocks (common in enterprise)
        .replace(
          /(?:CONFIDENTIAL|DISCLAIMER|This email and any attachments)[\s\S]{0,500}$/i,
          ''
        )
        .trim()
    );
  }

  /**
   * Convert markdown-like text to HTML email.
   */
  private textToHtml(text: string): string {
    let html = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/## (.+?)(?:<br>|<\/p>)/g, '<h2>$1</h2>')
      .replace(/> (.+?)(?:<br>|<\/p>)/g, '<blockquote>$1</blockquote>')
      .replace(/---/g, '<hr>');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; color: #333;">
        <p>${html}</p>
      </div>
    `;
  }

  /**
   * Load the assistant email address map from the database.
   */
  private async loadAddressMap(): Promise<void> {
    // In production, this queries the user_email_addresses table
    // For now, this is populated during channel registration
  }
}
```

### Content Extraction Pipeline

The email bridge processes different content types through a structured extraction pipeline:

```
Incoming Email
    │
    ├── Parse MIME structure (mailparser)
    │
    ├── Extract headers
    │   ├── Subject (detect Fwd:/FW: prefix)
    │   ├── From (sanitize: keep name, hash address)
    │   ├── Date
    │   └── In-Reply-To / References (for threading)
    │
    ├── Extract body
    │   ├── text/plain → use directly
    │   ├── text/html → convert to markdown (Turndown)
    │   └── multipart → extract both, prefer plain text
    │
    ├── Extract attachments
    │   ├── application/pdf → extract text (pdf-parse)
    │   ├── application/vnd.openxmlformats...word → extract text (mammoth)
    │   ├── application/vnd.openxmlformats...sheet → extract data (xlsx)
    │   ├── text/csv → parse as table
    │   ├── image/* → pass to vision model (Phase 1)
    │   └── other → skip with warning
    │
    ├── Clean content
    │   ├── Remove email signatures
    │   ├── Remove confidentiality disclaimers
    │   ├── Remove excessive whitespace
    │   └── Strip email thread quotes (keep latest + forwarded)
    │
    └── Produce InboundMessage
```

### Attachment Processing Details

| Format | Library | Extraction Method | Phase |
|--------|---------|-------------------|-------|
| **PDF** | `pdf-parse` | Full text extraction; OCR for scanned PDFs via `tesseract.js` (Phase 1) | Phase 0 (text), Phase 1 (OCR) |
| **Word (.docx)** | `mammoth` | Convert to markdown, preserve structure | Phase 0 |
| **Word (.doc)** | `mammoth` (limited) | Best-effort text extraction | Phase 0 |
| **Excel (.xlsx)** | `xlsx` (SheetJS) | Extract as CSV/table; summarize sheet names and sizes | Phase 0 |
| **Excel (.xls)** | `xlsx` (SheetJS) | Same as .xlsx | Phase 0 |
| **PowerPoint (.pptx)** | Custom XML parser | Extract slide text; images deferred | Phase 1 |
| **CSV** | `csv-parse` | Parse as table; first 100 rows + summary | Phase 0 |
| **Plain text** | Native | Direct pass-through | Phase 0 |
| **Images** | Vision model | OCR + description via multimodal LLM | Phase 1 |

```typescript
/**
 * Extract text content from an attachment for LLM context.
 */
async function extractAttachmentText(
  attachment: Attachment
): Promise<string | null> {
  if (!attachment.content) return null;

  switch (attachment.mimeType) {
    case 'application/pdf': {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(attachment.content);
      return result.text;
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: attachment.content });
      return result.value;
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel': {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(attachment.content, { type: 'buffer' });
      const sheets: string[] = [];
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        // Limit to first 100 rows
        const rows = csv.split('\n').slice(0, 100);
        sheets.push(`--- Sheet: ${name} ---\n${rows.join('\n')}`);
      }
      return sheets.join('\n\n');
    }

    case 'text/csv': {
      const text = attachment.content.toString('utf-8');
      const rows = text.split('\n').slice(0, 100);
      return rows.join('\n');
    }

    case 'text/plain': {
      return attachment.content.toString('utf-8');
    }

    default:
      return null;
  }
}
```

### Email Response Format

The assistant's email response follows these conventions:

```
From: "Play New Assistant" <assistant@playnew.ai>
To: matteo@acmecorp.com
Subject: Play New: Analysis of Forwarded Email - Q1 Budget Review
Date: Tue, 25 Feb 2026 14:30:00 +0100

## Summary

This email from Sarah Chen (CFO) discusses the Q1 budget review.
Key concern: marketing spend is 23% over budget with no corresponding
revenue uplift.

## Key Actions

1. **Respond to Sarah by Thursday** with revised marketing allocation
2. **Schedule meeting with marketing lead** to discuss campaign ROI
3. **Review Q1 actuals** in the finance dashboard

## Risk Flags

- Budget overrun may trigger board-level review if not addressed
  this quarter
- Marketing team morale risk if cuts are perceived as punitive

## Organizational Context

Your company's strategic plan emphasizes customer acquisition growth
in Q2. Cutting marketing without a revised growth plan may conflict
with the board's expectations from the December strategy session.

## Suggested Response

"Hi Sarah, thanks for flagging this. I'd like to propose a
reallocated budget that maintains our Q2 acquisition targets while
bringing Q1 back in line. Can we schedule 30 minutes Thursday to
walk through the numbers?"

---
This analysis is private to you. Original email content is stored
only in your personal memory. You can ask me to forget any
information at any time.

-- Play New Assistant
https://playnew.ai
```

### Privacy Architecture

The email bridge has specific privacy concerns because it handles full email content:

| Data Element | Handling | Storage |
|-------------|----------|---------|
| Email body text | Processed by LLM, stored in personal memory only | Encrypted, user-scoped |
| Email headers (From, To, CC) | Sender display name preserved; email addresses stripped from metadata | Not stored in org layer |
| Attachments content | Extracted text stored in personal memory; binary files deleted after processing | Encrypted, user-scoped |
| Original raw email | Deleted from IMAP inbox after processing | Not retained |
| Email metadata (subject, date, type) | Categorized for pattern collection | Anonymized categories only |
| Forwarded sender info | Kept in personal context for analysis | Not in org layer |

**Header stripping rules:**
```typescript
const HEADERS_TO_STRIP = [
  'x-mailer',
  'x-originating-ip',
  'received',         // Contains IP addresses and server names
  'dkim-signature',
  'authentication-results',
  'x-ms-exchange-organization-*',  // Exchange internal headers
  'x-google-dkim-signature',
];

const HEADERS_TO_PRESERVE = [
  'subject',
  'date',
  'content-type',
  // 'from' is preserved but sanitized (display name only)
];
```

---

## Phase 0 Scope

### In Scope

- Dedicated email address per user (`{name}.assistant@playnew.ai`)
- IMAP polling for incoming emails (30-second interval)
- Email parsing: headers, plain text body, HTML-to-markdown conversion
- Forwarded email detection and original content extraction
- Attachment extraction: PDF (text), Word (.docx), Excel (.xlsx), CSV, plain text
- SMTP response delivery to user's real email address
- Structured response format (summary, actions, risks, context, suggested response)
- Privacy footer in every response
- Header stripping for privacy
- Basic email thread detection (In-Reply-To header)

### Out of Scope (Phase 1+)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| IMAP IDLE (push instead of poll) | Phase 1 | Polling is simpler, 30s delay acceptable |
| OCR for scanned PDFs | Phase 1 | Requires tesseract.js or cloud OCR |
| Image analysis (screenshots, photos) | Phase 1 | Requires multimodal LLM |
| PowerPoint text extraction | Phase 1 | Lower priority document type |
| Custom domain per org | Phase 1 | `@playnew.ai` sufficient for Phase 0 |
| Inline email replies (conversation threading) | Phase 1 | Phase 0: each forward is independent |
| Calendar invite parsing (.ics) | Phase 1 | Edge case |
| Email sending on behalf of user | Phase 2 | Requires OAuth, trust model evolution |
| Encrypted email (S/MIME, PGP) | Phase 2 | Enterprise compliance requirement |

---

## Open Questions

1. **Email infrastructure provider:** Self-hosted Postfix, AWS SES + WorkMail, or Mailgun? **Recommendation:** AWS SES for SMTP sending + dedicated IMAP server (self-hosted or hosted IMAP like Fastmail) for receiving. SES handles deliverability; IMAP handles reception. Evaluate cost and complexity during architecture sprint.

2. **Spam/abuse protection:** What prevents external parties from sending email to `*.assistant@playnew.ai`? **Recommendation:** Only process emails where the sender's address matches a known user in the org. Reject all others silently. Add SPF/DKIM/DMARC on the playnew.ai domain.

3. **Response timing:** Should the assistant respond immediately, or batch responses? **Recommendation:** Respond within 2-5 minutes of receiving the forwarded email (depends on LLM processing time). Email users do not expect real-time responses, so even a few minutes is acceptable.

4. **Multiple forwards in one email:** If a user forwards a thread with 10 messages, do we process all of them? **Recommendation:** Process the entire forwarded content as a single context. The LLM should handle multi-message threads. Truncate to ~50KB of text if the thread is extremely long.

5. **Reply-to-response flow:** If the user replies to the assistant's email response, should that be treated as a follow-up question? **Recommendation:** Yes. Use the In-Reply-To header to link the reply to the original analysis. This creates a conversational thread via email. Implement in Phase 0 as a stretch goal.

6. **Email address discoverability:** How does the user learn their assistant's email address? **Recommendation:** Displayed during onboarding (Slack/Teams welcome message), available via `/pn email` command, and included in the assistant's profile card.
