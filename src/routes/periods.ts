import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

const createPeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  routeIds: z.array(z.string()).optional(),
});

const updatePeriodSchema = createPeriodSchema.partial().extend({
  status: z.enum(['UPCOMING', 'OPEN', 'CLOSED', 'PROCESSING', 'COMPLETED']).optional(),
});

// GET /api/periods - Get all selection periods
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const periods = await prisma.selectionPeriod.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        selections: {
          select: {
            id: true,
          },
        },
        assignments: {
          select: {
            id: true,
          },
        },
        routes: {
          include: {
            route: {
              select: {
                id: true,
                runNumber: true,
                type: true,
              },
            },
          },
        },
      },
    });

    const periodsWithStats = periods.map(period => ({
      ...period,
      selectionCount: period.selections.length,
      assignmentCount: period.assignments.length,
      routeCount: period.routes.length,
      selections: undefined,
      assignments: undefined,
    }));

    res.json(periodsWithStats);
  } catch (error) {
    console.error('Get periods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/periods/active - Get currently active period
router.get('/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const activePeriod = await prisma.selectionPeriod.findFirst({
      where: {
        status: 'OPEN',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: {
        selections: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!activePeriod) {
      return res.status(404).json({ error: 'No active selection period found' });
    }

    const periodWithStats = {
      ...activePeriod,
      selectionCount: activePeriod.selections.length,
      selections: undefined,
    };

    res.json(periodWithStats);
  } catch (error) {
    console.error('Get active period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/periods/:id - Get single selection period
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const period = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
      include: {
        selections: {
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                hireDate: true,
              },
            },
          },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
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
          },
        },
        routes: {
          include: {
            route: true,
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    res.json(period);
  } catch (error) {
    console.error('Get period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/periods - Create new selection period (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = createPeriodSchema.parse(req.body);

    // Check for overlapping periods
    // Parse dates to ensure they're treated as local dates, not UTC
    const startDate = new Date(data.startDate + 'T00:00:00');
    const endDate = new Date(data.endDate + 'T23:59:59');

    // Validate dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const overlappingPeriod = await prisma.selectionPeriod.findFirst({
      where: {
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    if (overlappingPeriod) {
      return res.status(409).json({ error: 'Period overlaps with existing selection period' });
    }

    const period = await prisma.selectionPeriod.create({
      data: {
        name: data.name,
        description: data.description,
        startDate,
        endDate,
        routes: data.routeIds ? {
          create: data.routeIds.map(routeId => ({
            routeId,
          })),
        } : undefined,
      },
      include: {
        routes: {
          include: {
            route: true,
          },
        },
      },
    });

    res.status(201).json(period);
  } catch (error) {
    console.error('Create period error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/periods/:id - Update selection period (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updatePeriodSchema.parse(req.body);

    const existingPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
    });

    if (!existingPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Validate status transitions
    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        'UPCOMING': ['OPEN', 'CLOSED'],
        'OPEN': ['CLOSED', 'PROCESSING'],
        'CLOSED': ['OPEN', 'PROCESSING'],
        'PROCESSING': ['COMPLETED', 'OPEN'],
        'COMPLETED': [],
      };

      const allowedNextStates = validTransitions[existingPeriod.status] || [];
      if (!allowedNextStates.includes(data.status)) {
        return res.status(400).json({ 
          error: `Cannot transition from ${existingPeriod.status} to ${data.status}` 
        });
      }
    }

    // Check for overlapping periods if dates are being changed
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate + 'T00:00:00') : existingPeriod.startDate;
      const endDate = data.endDate ? new Date(data.endDate + 'T23:59:59') : existingPeriod.endDate;

      if (startDate >= endDate) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }

      const overlappingPeriod = await prisma.selectionPeriod.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (overlappingPeriod) {
        return res.status(409).json({ error: 'Period overlaps with existing selection period' });
      }
    }

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate + 'T00:00:00');
    if (data.endDate) updateData.endDate = new Date(data.endDate + 'T23:59:59');

    // Handle route updates in a transaction
    const period = await prisma.$transaction(async (tx) => {
      // Update the period
      const updatedPeriod = await tx.selectionPeriod.update({
        where: { id: req.params.id },
        data: updateData,
      });

      // If routeIds are provided, update the routes
      if (data.routeIds !== undefined) {
        // Delete existing route associations
        await tx.periodRoute.deleteMany({
          where: { selectionPeriodId: req.params.id },
        });

        // Create new route associations
        if (data.routeIds.length > 0) {
          await tx.periodRoute.createMany({
            data: data.routeIds.map(routeId => ({
              selectionPeriodId: req.params.id,
              routeId,
            })),
          });
        }
      }

      // Return the updated period with routes
      return await tx.selectionPeriod.findUnique({
        where: { id: req.params.id },
        include: {
          routes: {
            include: {
              route: true,
            },
          },
        },
      });
    });

    res.json(period);
  } catch (error) {
    console.error('Update period error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/periods/:id - Update period status only (Admin only)
router.patch('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const existingPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
    });

    if (!existingPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'UPCOMING': ['OPEN', 'CLOSED'],
      'OPEN': ['CLOSED', 'PROCESSING'],
      'CLOSED': ['OPEN', 'PROCESSING'],
      'PROCESSING': ['COMPLETED', 'OPEN'],
      'COMPLETED': [],
    };

    const allowedNextStates = validTransitions[existingPeriod.status] || [];
    if (!allowedNextStates.includes(status)) {
      return res.status(400).json({ 
        error: `Cannot transition from ${existingPeriod.status} to ${status}` 
      });
    }

    const period = await prisma.selectionPeriod.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(period);
  } catch (error) {
    console.error('Update period status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/periods/:id - Delete selection period (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const existingPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
      include: {
        selections: true,
        assignments: true,
      },
    });

    if (!existingPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (existingPeriod.selections.length > 0 || existingPeriod.assignments.length > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete period with existing selections or assignments' 
      });
    }

    await prisma.selectionPeriod.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/periods/:id/statistics - Get detailed statistics for a period
router.get('/:id/statistics', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const period = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
      include: {
        selections: {
          include: {
            employee: {
              select: {
                hireDate: true,
                doublesEndorsement: true,
                chainExperience: true,
                isEligible: true,
              },
            },
          },
        },
        assignments: {
          include: {
            route: true,
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Calculate statistics
    const totalEligibleEmployees = await prisma.employee.count({
      where: { isEligible: true },
    });

    const submissionCount = period.selections.length;
    const submissionRate = totalEligibleEmployees > 0 ? submissionCount / totalEligibleEmployees : 0;

    const assignmentStats = {
      total: period.assignments.length,
      firstChoice: period.assignments.filter(a => a.choiceReceived === 1).length,
      secondChoice: period.assignments.filter(a => a.choiceReceived === 2).length,
      thirdChoice: period.assignments.filter(a => a.choiceReceived === 3).length,
      floatPool: period.assignments.filter(a => a.choiceReceived === null).length,
    };

    const routeTypeDistribution = period.assignments.reduce((acc: any, assignment) => {
      if (assignment.route) {
        acc[assignment.route.type] = (acc[assignment.route.type] || 0) + 1;
      }
      return acc;
    }, {});

    res.json({
      period: {
        id: period.id,
        name: period.name,
        status: period.status,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      statistics: {
        totalEligibleEmployees,
        submissionCount,
        submissionRate: Math.round(submissionRate * 100) / 100,
        assignmentStats,
        routeTypeDistribution,
      },
    });
  } catch (error) {
    console.error('Get period statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/periods/:id/notify - Send notifications to eligible drivers
router.post('/:id/notify', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const period = await prisma.selectionPeriod.findUnique({
      where: { id: req.params.id },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (period.status !== 'UPCOMING' && period.status !== 'OPEN') {
      return res.status(400).json({ 
        error: 'Notifications can only be sent for upcoming or open periods' 
      });
    }

    // Get all eligible employees who haven't been notified
    const eligibleEmployees = await prisma.employee.findMany({
      where: {
        isEligible: true,
        user: {
          email: { not: null },
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (eligibleEmployees.length === 0) {
      return res.status(400).json({ error: 'No eligible employees found to notify' });
    }

    // In a production environment, this would integrate with an email service
    // For now, we'll log the notification and return success
    const notifications = eligibleEmployees.map(employee => ({
      employeeId: employee.id,
      email: employee.user?.email,
      subject: `Route Selection Period Now Open: ${period.name}`,
      periodName: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
    }));

    // Log the notification attempt
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_PERIOD_NOTIFICATION',
        resource: 'SelectionPeriod',
        details: `Sent notifications to ${eligibleEmployees.length} eligible drivers for period: ${period.name}`,
      },
    });

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    console.log(`Sending notifications to ${eligibleEmployees.length} drivers for period: ${period.name}`);

    res.json({
      success: true,
      notificationsSent: eligibleEmployees.length,
      period: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });
  } catch (error) {
    console.error('Send notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;