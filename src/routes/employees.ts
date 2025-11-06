import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin, requireAdminOrSelf } from '../middleware/auth.js';
import { checkTerminalAccess, validateTerminalAccess, TerminalAccessRequest } from '../middleware/terminalAccess.js';

const router = Router();

const createEmployeeSchema = z.object({
  employeeId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  hireDate: z.string(),
  doublesEndorsement: z.boolean().default(false),
  chainExperience: z.boolean().default(false),
  isEligible: z.boolean().default(true),
  terminalId: z.string(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

// GET /api/employees - Get all employees with optional filtering
router.get('/', authenticateToken, requireAdmin, checkTerminalAccess, async (req: TerminalAccessRequest, res: Response) => {
  try {
    const {
      isEligible,
      doublesEndorsement,
      chainExperience,
      searchTerm,
      terminalId,
    } = req.query;

    const where: any = {};

    // Filter by terminal - ensure user has access
    if (terminalId) {
      if (!req.allowedTerminals?.includes(terminalId as string)) {
        return res.status(403).json({ error: 'Access denied to this terminal' });
      }
      where.terminalId = terminalId as string;
    } else if (req.user?.role !== 'ADMIN' && req.allowedTerminals && req.allowedTerminals.length > 0) {
      // For non-admins, limit to their allowed terminals
      where.terminalId = { in: req.allowedTerminals };
    }

    if (isEligible !== undefined) {
      where.isEligible = isEligible === 'true';
    }

    if (doublesEndorsement !== undefined) {
      where.doublesEndorsement = doublesEndorsement === 'true';
    }

    if (chainExperience !== undefined) {
      where.chainExperience = chainExperience === 'true';
    }

    // Get emails of inactive users
    const inactiveUserEmails = await prisma.user.findMany({
      where: { isActive: false },
      select: { email: true }
    }).then(users => users.map(u => u.email));

    // Add filter to exclude employees with inactive user accounts
    if (inactiveUserEmails.length > 0) {
      where.email = { notIn: inactiveUserEmails };
    }

    if (searchTerm) {
      const searchString = searchTerm as string;
      where.OR = [
        { firstName: { contains: searchString, mode: 'insensitive' } },
        { lastName: { contains: searchString, mode: 'insensitive' } },
        { employeeId: { contains: searchString, mode: 'insensitive' } },
        { email: { contains: searchString, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [
        { hireDate: 'asc' },
        { lastName: 'asc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
          },
        },
        route: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
          },
        },
        assignments: {
          where: {
            selectionPeriod: {
              status: 'COMPLETED',
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            route: {
              select: {
                id: true,
                runNumber: true,
                origin: true,
                destination: true,
              },
            },
            selectionPeriod: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        disqualifications: {
          where: {
            isActive: true,
          },
        },
      },
    });

    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/seniority - Get employees sorted by seniority
router.get('/seniority', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get emails of inactive users
    const inactiveUserEmails = await prisma.user.findMany({
      where: { isActive: false },
      select: { email: true }
    }).then(users => users.map(u => u.email));

    const where: any = { isEligible: true };
    
    // Exclude employees with inactive user accounts
    if (inactiveUserEmails.length > 0) {
      where.email = { notIn: inactiveUserEmails };
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [
        { hireDate: 'asc' },
        { lastName: 'asc' },
      ],
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        hireDate: true,
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
    });

    // Add seniority rank
    const employeesWithRank = employees.map((employee, index) => ({
      ...employee,
      seniorityRank: index + 1,
    }));

    res.json(employeesWithRank);
  } catch (error) {
    console.error('Get seniority list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/by-user/:userId - Get employee by user ID (for logged-in drivers)
router.get('/by-user/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { 
        user: { 
          id: req.params.userId 
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found for this user' });
    }

    // If driver, only allow access to their own data
    if (req.user.role === 'DRIVER' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(employee);
  } catch (error: any) {
    console.error('Get employee by user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id - Get single employee
router.get('/:id', authenticateToken, requireAdminOrSelf, async (req: Request, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        route: true,
        assignments: {
          include: {
            route: {
              select: {
                id: true,
                runNumber: true,
                origin: true,
                destination: true,
                type: true,
              },
            },
            selectionPeriod: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        selections: {
          include: {
            firstChoice: {
              select: {
                id: true,
                runNumber: true,
                origin: true,
                destination: true,
              },
            },
            secondChoice: {
              select: {
                id: true,
                runNumber: true,
                origin: true,
                destination: true,
              },
            },
            thirdChoice: {
              select: {
                id: true,
                runNumber: true,
                origin: true,
                destination: true,
              },
            },
            selectionPeriod: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        disqualifications: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if employee has an inactive user account
    if (employee.user && !employee.user.isActive) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/employees - Create new employee (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('Create employee request body:', req.body);
    const data = createEmployeeSchema.parse(req.body);
    const createUserAccount = req.body.createUserAccount !== false; // Default to true

    // Check if employee ID already exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId: data.employeeId },
    });

    if (existingEmployee) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }

    // Check if email already exists in employees
    const existingEmailEmployee = await prisma.employee.findUnique({
      where: { email: data.email },
    });

    if (existingEmailEmployee) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Check if user exists with this email
    let existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Create user account if requested and doesn't exist
    if (createUserAccount && !existingUser) {
      const { hashPassword } = await import('../utils/auth.js');
      const defaultPassword = await hashPassword('driver123'); // Default password
      
      existingUser = await prisma.user.create({
        data: {
          email: data.email,
          password: defaultPassword,
          role: 'DRIVER',
          isActive: true, // All new user accounts are active by default
        },
      });
    }

    // If no user exists at this point, we can't create the employee
    if (!existingUser) {
      return res.status(400).json({ 
        error: 'No user account exists for this email address',
        details: 'Either create a user account first or enable automatic user creation'
      });
    }

    const employee = await prisma.employee.create({
      data: {
        ...data,
        hireDate: new Date(data.hireDate),
      },
    });

    res.status(201).json(employee);
  } catch (error: any) {
    console.error('Create employee error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    // Provide more detailed error information for debugging
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'A user account must exist with this email before creating an employee record',
        details: 'Foreign key constraint failed on the field: ' + error.meta?.field_name
      });
    }
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      return res.status(409).json({ 
        error: `Duplicate value for field: ${target}`,
        details: error.message
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/employees/:id - Update employee (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updateEmployeeSchema.parse(req.body);

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
    });

    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check for conflicts if employee ID or email is being changed
    if (data.employeeId && data.employeeId !== existingEmployee.employeeId) {
      const conflictingEmployee = await prisma.employee.findUnique({
        where: { employeeId: data.employeeId },
      });

      if (conflictingEmployee) {
        return res.status(409).json({ error: 'Employee ID already exists' });
      }
    }

    if (data.email && data.email !== existingEmployee.email) {
      const conflictingEmployee = await prisma.employee.findUnique({
        where: { email: data.email },
      });

      if (conflictingEmployee) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const updateData: any = { ...data };
    if (data.hireDate) {
      updateData.hireDate = new Date(data.hireDate);
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    // Note: We do NOT automatically disable user accounts when employees become ineligible
    // Ineligible employees can still log in but cannot participate in route selection

    res.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id - Delete employee (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
        selections: true,
        user: true,
      },
    });

    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if employee has any assignments or selections
    if (existingEmployee.assignments.length > 0 || existingEmployee.selections.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete employee with existing assignments or selections. Consider marking as ineligible instead.' 
      });
    }

    // Delete employee and associated user account in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({
        where: { id: req.params.id },
      });

      if (existingEmployee.user) {
        await tx.user.delete({
          where: { id: existingEmployee.user.id },
        });
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/employees/:id/disqualify - Disqualify employee (Admin only)
router.post('/:id/disqualify', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason, startDate, endDate } = req.body;

    if (!reason || !startDate) {
      return res.status(400).json({ error: 'Reason and start date are required' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const disqualification = await prisma.disqualification.create({
      data: {
        employeeId: req.params.id,
        reason,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    // Update employee eligibility
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { isEligible: false },
    });

    // Note: We do NOT disable user accounts for disqualified employees
    // They can still log in but cannot participate in route selection

    res.status(201).json(disqualification);
  } catch (error) {
    console.error('Disqualify employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id/disqualify/:disqualificationId - Remove disqualification
router.delete('/:id/disqualify/:disqualificationId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id: employeeId, disqualificationId } = req.params;

    const disqualification = await prisma.disqualification.findUnique({
      where: { id: disqualificationId },
    });

    if (!disqualification || disqualification.employeeId !== employeeId) {
      return res.status(404).json({ error: 'Disqualification not found' });
    }

    await prisma.disqualification.update({
      where: { id: disqualificationId },
      data: { isActive: false },
    });

    // Check if employee has any other active disqualifications
    const activeDisqualifications = await prisma.disqualification.findMany({
      where: {
        employeeId,
        isActive: true,
      },
    });

    // If no active disqualifications, restore eligibility
    if (activeDisqualifications.length === 0) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { isEligible: true },
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Remove disqualification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;