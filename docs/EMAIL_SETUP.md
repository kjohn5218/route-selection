# Email Service Setup Guide

## Overview
This application uses Gmail SMTP to send email notifications for:
- Selection period announcements to eligible drivers
- Route assignment notifications after processing

## Configuration

### Environment Variables
Add these variables to your `.env` file:

```env
# Email Configuration
EMAIL_USER="kevobhave@gmail.com"           # Your Gmail address
EMAIL_APP_PASSWORD="your-app-password"      # Gmail App Password (NOT your regular password)
EMAIL_OVERRIDE="kjohn@ccfs.com"            # All emails will be sent to this address (for testing)
APP_URL="http://localhost:5173"             # Your frontend URL (for email links)
```

### Gmail App Password Setup

1. **Enable 2-Factor Authentication** on your Google Account:
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification" and follow the setup

2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select your device type
   - Click "Generate"
   - Copy the 16-character password

3. **Update your .env file**:
   - Replace `your-app-password` with the generated password
   - Remove any spaces from the password

## Email Override Feature

The `EMAIL_OVERRIDE` environment variable redirects ALL emails to a single address. This is useful for:
- Testing in development without sending emails to real users
- QA environments where you want to verify email functionality
- Staging environments before production deployment

To disable the override and send emails to actual recipients, either:
- Remove the `EMAIL_OVERRIDE` line from your `.env` file
- Set it to an empty string: `EMAIL_OVERRIDE=""`

## Email Templates

The application sends two types of emails:

### 1. Selection Period Notification
Sent when a new selection period opens:
- Recipients: All eligible drivers with email addresses
- Trigger: Admin clicks "Notify Drivers" on an upcoming period
- Contents: Period details, instructions for making selections

### 2. Assignment Notification
Sent after assignments are processed:
- Recipients: All drivers who received assignments
- Trigger: Admin processes assignments and clicks "Send Notifications"
- Contents: Assigned route details, choice ranking received

## Testing Email Functionality

1. **Verify Email Service Connection**:
   - Start the server and check console for "Email service ready" message
   - If you see errors, verify your Gmail credentials

2. **Test with Override**:
   - Keep `EMAIL_OVERRIDE="kjohn@ccfs.com"` in your `.env`
   - Create a test selection period
   - Send notifications - all emails will go to kjohn@ccfs.com

3. **Monitor Email Logs**:
   - In development mode, the console logs email details
   - Check for successful sends or error messages

## Troubleshooting

### Common Issues

1. **"Invalid login" error**:
   - Ensure you're using an App Password, not your regular Gmail password
   - Verify 2-factor authentication is enabled on your Gmail account

2. **"Email service error" on startup**:
   - Check your internet connection
   - Verify EMAIL_USER is a valid Gmail address
   - Ensure EMAIL_APP_PASSWORD is correct (16 characters, no spaces)

3. **Emails not being received**:
   - Check spam/junk folders
   - Verify EMAIL_OVERRIDE is set correctly
   - Check server console for error messages

### Security Notes

- Never commit your `.env` file to version control
- Keep your Gmail App Password secure
- Regularly rotate your App Password
- In production, consider using a dedicated email service (SendGrid, AWS SES, etc.)

## Production Recommendations

For production deployments, consider:
1. Using a dedicated email service provider for better deliverability
2. Implementing email rate limiting to avoid Gmail's sending limits
3. Adding email queuing for reliability
4. Setting up email analytics and bounce handling
5. Using a dedicated email address for the application (not personal Gmail)