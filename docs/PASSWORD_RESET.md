# Password Reset Feature

## Overview
The Route Selection System includes a secure password reset functionality that allows users to reset their passwords via email.

## User Accounts
All employees have been set up with user accounts:
- **Username**: Employee's email address
- **Default Password**: `driver123`

## Password Reset Process

### For Users

1. **Request Password Reset**:
   - Click "Forgot your password?" on the login page
   - Enter your email address
   - Click "Send Reset Link"
   - Check your email for the reset link

2. **Reset Your Password**:
   - Click the link in the email (valid for 1 hour)
   - Enter your new password (must meet requirements)
   - Confirm your new password
   - Click "Reset Password"

3. **Password Requirements**:
   - At least 8 characters long
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number

### For First-Time Users

When employees receive their selection period notification email, it includes:
- Login credentials (email and default password)
- A recommendation to reset their password for security
- Direct link to the password reset page

## Security Features

1. **Token-Based Reset**:
   - Secure random tokens generated for each reset request
   - Tokens expire after 1 hour
   - Tokens are single-use only

2. **Email Verification**:
   - Reset links only sent to registered email addresses
   - Generic success message prevents email enumeration

3. **Audit Trail**:
   - All password reset requests are logged
   - Successful password resets are tracked

## Technical Implementation

### API Endpoints

- `POST /api/password-reset/request` - Request a password reset
- `POST /api/password-reset/reset` - Reset password with token
- `GET /api/password-reset/validate/:token` - Validate reset token

### Frontend Routes

- `/forgot-password` - Request password reset page
- `/reset-password?token=xxx` - Password reset form

### Database Schema

The system uses a `PasswordResetToken` table to store:
- Unique token
- User association
- Expiration time
- Usage timestamp

## Email Templates

### Password Reset Email
- Subject: "Password Reset Request - Route Selection System"
- Contains reset button and link
- Includes expiration warning (1 hour)
- Professional HTML and plain text versions

### Selection Period Notification
- Now includes login credentials
- Recommends password reset for first-time users
- Direct link to password reset page

## Testing

### With Email Override Active
All emails are currently routed to `kjohn@ccfs.com` for testing.

To test the password reset:
1. Go to `/forgot-password`
2. Enter any employee email
3. Check kjohn@ccfs.com for the reset email
4. Follow the reset link
5. Set a new password

### Production Deployment
Remove `EMAIL_OVERRIDE` from `.env` to send emails to actual recipients.

## Troubleshooting

### Common Issues

1. **"Invalid or expired reset token"**:
   - Token has expired (1 hour limit)
   - Token has already been used
   - Invalid token format

2. **Not receiving reset emails**:
   - Check spam/junk folder
   - Verify email address is correct
   - Check email service configuration

3. **Password validation errors**:
   - Ensure password meets all requirements
   - Password and confirmation must match