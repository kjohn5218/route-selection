import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: Transporter;
  private emailOverride: string | null;

  constructor() {
    // Create transporter with Gmail configuration
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Set up email override if configured
    this.emailOverride = process.env.EMAIL_OVERRIDE || null;

    // Verify transporter configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      // Don't verify connection on startup - verify when sending
      console.log('Email service initialized');
      console.log('Email configuration:', {
        user: process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_APP_PASSWORD,
        passwordLength: process.env.EMAIL_APP_PASSWORD?.length,
        override: this.emailOverride || 'None'
      });
    } catch (error) {
      console.error('Email service error:', error);
      console.error('Make sure EMAIL_USER and EMAIL_APP_PASSWORD are set correctly');
    }
  }

  async sendEmail(options: EmailOptions, retryCount = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds
    
    try {
      // Apply email override if set
      const to = this.emailOverride || options.to;

      // Prepare email options
      const mailOptions = {
        from: `"Route Selection System" <${process.env.EMAIL_USER}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      // Log email details
      console.log('Email request:', {
        originalTo: options.to,
        actualTo: mailOptions.to,
        subject: options.subject,
        override: this.emailOverride ? 'ACTIVE' : 'NONE',
        attempt: retryCount + 1,
      });

      // In development with missing credentials, just log the email
      if (process.env.NODE_ENV === 'development' && 
          (!process.env.EMAIL_USER || 
           !process.env.EMAIL_APP_PASSWORD || 
           process.env.EMAIL_APP_PASSWORD === 'your-gmail-app-password-here')) {
        console.log('📧 Development mode: Email not sent (credentials not configured)');
        console.log('Email content:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          preview: options.text?.substring(0, 100) + '...'
        });
        return;
      }

      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error: any) {
      console.error('Failed to send email:', error.message || error);
      
      // Check for rate limiting or temporary errors
      const isTemporaryError = error.code === 'ESOCKET' || 
                              error.code === 'ETIMEDOUT' ||
                              error.message?.includes('421') ||
                              error.message?.includes('Temporary System Problem');
      
      if (isTemporaryError && retryCount < MAX_RETRIES) {
        console.log(`Temporary error detected. Retrying in ${RETRY_DELAY / 1000} seconds... (Attempt ${retryCount + 2} of ${MAX_RETRIES + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.sendEmail(options, retryCount + 1);
      }
      
      if (error.code === 'EAUTH') {
        console.error('Authentication failed. Check EMAIL_USER and EMAIL_APP_PASSWORD environment variables.');
      } else if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
        console.error('Network error: Unable to connect to email server. Check your internet connection and firewall settings.');
      } else if (error.message?.includes('421')) {
        console.error('Gmail rate limit reached. Please wait before sending more emails.');
      }
      
      throw error;
    }
  }

  async sendSelectionPeriodNotification(
    recipientEmail: string,
    recipientName: string,
    periodDetails: {
      name: string;
      startDate: Date;
      endDate: Date;
    }
  ): Promise<void> {
    const subject = `Route Selection Period Now Open: ${periodDetails.name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .button { background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          ul { margin: 10px 0; padding-left: 20px; }
          ol { margin: 10px 0; padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Route Selection Period Open</h1>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>The route selection period "<strong>${periodDetails.name}</strong>" is now open.</p>
            
            <h3>Selection Period Details:</h3>
            <ul>
              <li><strong>Start Date:</strong> ${periodDetails.startDate.toLocaleDateString()}</li>
              <li><strong>End Date:</strong> ${periodDetails.endDate.toLocaleDateString()}</li>
            </ul>
            
            <h3>How to Submit Your Selection:</h3>
            <ol>
              <li>Log in to your driver portal</li>
              <li>Navigate to "Route Selection"</li>
              <li>Review available routes based on your qualifications</li>
              <li>Select up to 3 route preferences in order of priority</li>
              <li>Submit your selections before the deadline</li>
            </ol>
            
            <p>Routes will be assigned based on seniority and your preferences. You will be notified of your assignment once the selection period closes.</p>
            
            <a href="${process.env.APP_URL || 'http://localhost:3001'}/login" class="button">Go to Driver Portal</a>
            
            <h3>Login Information:</h3>
            <p><strong>Username:</strong> Your email address (${recipientEmail})<br>
            <strong>Password:</strong> driver123</p>
            
            <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>First Time Login?</strong> For security reasons, we recommend that you 
              <a href="${process.env.APP_URL || 'http://localhost:3001'}/forgot-password" style="color: #7c3aed; text-decoration: underline;">reset your password</a> 
              after your first login.
            </p>
            
            <p>If you have any questions, please contact your supervisor.</p>
            
            <p>Thank you,<br>Route Selection Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Route Selection System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${recipientName},

The route selection period "${periodDetails.name}" is now open.

Selection Period Details:
- Start Date: ${periodDetails.startDate.toLocaleDateString()}
- End Date: ${periodDetails.endDate.toLocaleDateString()}

How to Submit Your Selection:
1. Log in to your driver portal
2. Navigate to "Route Selection"
3. Review available routes based on your qualifications
4. Select up to 3 route preferences in order of priority
5. Submit your selections before the deadline

Routes will be assigned based on seniority and your preferences. You will be notified of your assignment once the selection period closes.

Login Information:
- Username: Your email address (${recipientEmail})
- Password: driver123

First Time Login? For security reasons, we recommend that you reset your password after your first login.
To reset your password, visit: ${process.env.APP_URL || 'http://localhost:3001'}/forgot-password

If you have any questions, please contact your supervisor.

Thank you,
Route Selection Team

This is an automated message. Please do not reply to this email.
`;

    await this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  async sendAssignmentNotification(
    recipientEmail: string,
    recipientName: string,
    assignmentDetails: {
      routeNumber: string;
      origin: string;
      destination: string;
      choiceReceived: number | null;
      periodName: string;
    }
  ): Promise<void> {
    const subject = `Route Assignment Notification - ${assignmentDetails.periodName}`;
    
    const assignmentText = assignmentDetails.choiceReceived
      ? `You have been assigned your ${this.getOrdinal(assignmentDetails.choiceReceived)} choice:`
      : 'You have been assigned to the float pool and will receive the following route:';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .route-box { background-color: white; border: 2px solid #7c3aed; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Route Assignment Notification</h1>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>The route assignments for "<strong>${assignmentDetails.periodName}</strong>" have been completed.</p>
            
            <p>${assignmentText}</p>
            
            <div class="route-box">
              <h3>Your Assigned Route</h3>
              <p><strong>Route Number:</strong> #${assignmentDetails.routeNumber}</p>
              <p><strong>Origin:</strong> ${assignmentDetails.origin}</p>
              <p><strong>Destination:</strong> ${assignmentDetails.destination}</p>
            </div>
            
            <p>Please log in to the driver portal for complete route details and schedules.</p>
            
            <p>If you have any questions about your assignment, please contact your supervisor.</p>
            
            <p>Thank you,<br>Route Selection Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Route Selection System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${recipientName},

The route assignments for "${assignmentDetails.periodName}" have been completed.

${assignmentText}

Your Assigned Route:
- Route Number: #${assignmentDetails.routeNumber}
- Origin: ${assignmentDetails.origin}
- Destination: ${assignmentDetails.destination}

Please log in to the driver portal for complete route details and schedules.

If you have any questions about your assignment, please contact your supervisor.

Thank you,
Route Selection Team

This is an automated message. Please do not reply to this email.
`;

    await this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }

  private getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    recipientName: string,
    resetUrl: string
  ): Promise<void> {
    const subject = 'Password Reset Request - Route Selection System';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .button { background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>We received a request to reset your password for the Route Selection System. If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #7c3aed;">${resetUrl}</p>
            
            <div class="warning">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons. If you need to reset your password after this time, please request a new reset link.
            </div>
            
            <p>If you didn't request a password reset, please ignore this email or contact your system administrator if you have concerns.</p>
            
            <p>Thank you,<br>Route Selection Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Route Selection System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${recipientName},

We received a request to reset your password for the Route Selection System. If you didn't make this request, you can safely ignore this email.

To reset your password, please visit:
${resetUrl}

Important: This link will expire in 1 hour for security reasons. If you need to reset your password after this time, please request a new reset link.

If you didn't request a password reset, please ignore this email or contact your system administrator if you have concerns.

Thank you,
Route Selection Team

This is an automated message. Please do not reply to this email.
`;

    await this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;