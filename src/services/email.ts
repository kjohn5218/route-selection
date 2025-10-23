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
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // Set up email override if configured
    this.emailOverride = process.env.EMAIL_OVERRIDE || null;

    // Verify transporter configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service ready');
    } catch (error) {
      console.error('Email service error:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
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

      // Log email details in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Sending email:', {
          originalTo: options.to,
          actualTo: mailOptions.to,
          subject: options.subject,
          override: this.emailOverride ? 'ACTIVE' : 'NONE',
        });
      }

      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
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
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;