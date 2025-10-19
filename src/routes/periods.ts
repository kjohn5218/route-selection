import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

const createPeriodSchema = z.object({
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
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
      },
    });

    const periodsWithStats = periods.map(period => ({
      ...period,
      selectionCount: period.selections.length,
      assignmentCount: period.assignments.length,
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
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

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
        startDate,
        endDate,
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
      const startDate = new Date(data.startDate || existingPeriod.startDate);
      const endDate = new Date(data.endDate || existingPeriod.endDate);

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
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const period = await prisma.selectionPeriod.update({
      where: { id: req.params.id },
      data: updateData,
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

export default router;