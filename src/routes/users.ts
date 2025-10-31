import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { hashPassword } from '../utils/auth.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'DRIVER']),
  isActive: z.boolean().optional().default(true),
  terminalIds: z.array(z.string()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'DRIVER']).optional(),
  isActive: z.boolean().optional(),
  terminalIds: z.array(z.string()).optional(),
});

// GET /api/users - Get all users (Admin/Manager only)
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id - Get single user (Admin/Manager only)
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        managedTerminals: {
          include: {
            terminal: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users - Create new user (Admin/Manager only)
router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        isActive: data.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // If role is MANAGER and terminalIds provided, create terminal associations
    if (data.role === 'MANAGER' && data.terminalIds && data.terminalIds.length > 0) {
      await prisma.userTerminal.createMany({
        data: data.terminalIds.map((terminalId: string) => ({
          userId: user.id,
          terminalId,
        })),
      });
    }

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id - Update user (Admin/Manager only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it conflicts
    if (data.email && data.email !== existingUser.email) {
      const conflictingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (conflictingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (data.email) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    // Hash password if being changed
    if (data.password) {
      updateData.password = await hashPassword(data.password);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        managedTerminals: {
          include: {
            terminal: true,
          },
        },
      },
    });

    // Log if user activation status changes and they have an associated employee
    if (data.isActive !== undefined && data.isActive !== existingUser.isActive && user.employee) {
      const action = data.isActive ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_HIDDEN';
      const details = data.isActive 
        ? `Employee ${user.employee.employeeId} is now visible in Employee Management due to user account activation`
        : `Employee ${user.employee.employeeId} is now hidden from Employee Management due to user account deactivation`;
      
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action,
          resource: 'Employee',
          details,
        },
      });
    }

    // Handle terminal updates for managers
    if (data.terminalIds !== undefined) {
      // Remove all existing terminal associations
      await prisma.userTerminal.deleteMany({
        where: { userId: req.params.id },
      });

      // Create new associations if role is MANAGER
      if ((data.role || existingUser.role) === 'MANAGER' && data.terminalIds.length > 0) {
        await prisma.userTerminal.createMany({
          data: data.terminalIds.map((terminalId: string) => ({
            userId: req.params.id,
            terminalId,
          })),
        });
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id - Delete user (Admin/Manager only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting users with associated employees
    if (existingUser.employee) {
      return res.status(409).json({ 
        error: 'Cannot delete user with associated employee record. Delete employee first.' 
      });
    }

    // Don't allow self-deletion
    if (existingUser.id === req.user?.id) {
      return res.status(409).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;