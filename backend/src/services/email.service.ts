import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: any;

  constructor(emailConfig: any) {
    this.config = emailConfig;
    this.transporter = nodemailer.createTransporter(emailConfig.smtpConfig);
  }

  /**
   * Send a regular email
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: options.from || this.config.fromEmail,
        to: options.to,
        subject: options.subject,
        html: this.formatEmailBody(options.body),
        replyTo: options.replyTo,
        attachments: this.formatAttachments(options.attachments)
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error: any) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send a reply email
   */
  async sendReply(options: EmailOptions): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: options.from || this.config.fromEmail,
        to: options.to,
        subject: options.subject,
        html: this.formatEmailBody(options.body),
        replyTo: options.replyTo || this.config.fromEmail,
        attachments: this.formatAttachments(options.attachments),
        // Add headers to indicate this is a reply
        headers: {
          'X-Mailer': 'SmartForms AI',
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error: any) {
      console.error('Failed to send reply:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push(result);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Format email body as HTML
   */
  private formatEmailBody(body: string): string {
    // Convert plain text to basic HTML
    const htmlBody = body
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            p {
              margin: 0 0 16px 0;
            }
            .signature {
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          ${htmlBody}
        </body>
      </html>
    `;
  }

  /**
   * Format attachments for nodemailer
   */
  private formatAttachments(attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>): any[] {
    if (!attachments) return [];

    return attachments.map(attachment => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, 'base64'),
      contentType: attachment.contentType
    }));
  }

  /**
   * Close the transporter
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
  }
}

/**
 * Create email service instance for a team
 */
export async function createEmailService(emailConfig: any): Promise<EmailService> {
  return new EmailService(emailConfig);
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(
  emailConfig: any,
  testEmail: string
): Promise<EmailResult> {
  const service = new EmailService(emailConfig);
  
  try {
    const result = await service.sendEmail({
      to: testEmail,
      subject: 'SmartForms AI - Email Configuration Test',
      body: `
        This is a test email to verify your email configuration.
        
        If you received this email, your SMTP settings are working correctly!
        
        Configuration details:
        - Provider: ${emailConfig.provider}
        - From: ${emailConfig.fromEmail}
        - SMTP Host: ${emailConfig.smtpConfig.host}
        - SMTP Port: ${emailConfig.smtpConfig.port}
        
        You can now send and reply to emails from your SmartForms AI unibox.
      `
    });

    await service.close();
    return result;

  } catch (error: any) {
    await service.close();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get default SMTP configurations for common providers
 */
export function getDefaultSMTPConfig(provider: string): any {
  const configs = {
    gmail: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true
    },
    outlook: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true
    },
    yahoo: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      requireTLS: true
    },
    icloud: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      requireTLS: true
    }
  };

  return configs[provider] || null;
}
