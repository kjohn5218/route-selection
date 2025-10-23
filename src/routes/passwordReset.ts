import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../utils/database.js';
import emailService from '../services/email.js';
import { hashPassword } from '../utils/auth.js';

const router = Router();

const requestResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

// POST /api/password-reset/request - Request password reset
router.post('/request', async (req: Request, res: Response) => {
  try {
    const data = requestResetSchema.parse(req.body);

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { employee: true },
    });

    if (user) {
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

      // Save token to database
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      // Send reset email
      const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
      const name = user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email;

      await emailService.sendPasswordResetEmail(user.email, name, resetUrl);

      // Log the request
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'REQUEST_PASSWORD_RESET',
          resource: 'User',
          details: `Password reset requested for ${user.email}`,
        },
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/password-reset/reset - Reset password with token
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: data.token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      include: { user: true },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(data.password);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Log the password reset
    await prisma.auditLog.create({
      data: {
        userId: resetToken.userId,
        action: 'RESET_PASSWORD',
        resource: 'User',
        details: `Password reset completed for ${resetToken.user.email}`,
      },
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/password-reset/validate/:token - Validate reset token
router.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({
      success: true,
      message: 'Token is valid',
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;