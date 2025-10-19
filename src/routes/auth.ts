import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { LoginRequest, CreateUserRequest } from '../types/index.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'DRIVER']).optional().default('DRIVER'),
  employeeData: z.object({
    employeeId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    hireDate: z.string(),
    doublesEndorsement: z.boolean().optional().default(false),
    chainExperience: z.boolean().optional().default(false),
  }).optional(),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee?.id,
        employee: user.employee,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Check if employee ID already exists (if provided)
    if (data.employeeData) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { employeeId: data.employeeData.employeeId },
      });

      if (existingEmployee) {
        return res.status(409).json({ error: 'Employee ID already exists' });
      }
    }

    const hashedPassword = await hashPassword(data.password);

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: data.role,
        },
      });

      let employee = null;
      if (data.employeeData) {
        employee = await tx.employee.create({
          data: {
            ...data.employeeData,
            email: data.email,
            hireDate: new Date(data.employeeData.hireDate),
          },
        });
      }

      return { user, employee };
    });

    const token = generateToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      employeeId: result.employee?.id,
    });

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        employeeId: result.employee?.id,
        employee: result.employee,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { employee: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id,
      employee: user.employee,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully' });
});

export default router;