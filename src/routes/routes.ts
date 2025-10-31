import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { RouteFilters } from '../types/index.js';
import { checkTerminalAccess, validateTerminalAccess, TerminalAccessRequest } from '../middleware/terminalAccess.js';

const router = Router();

const createRouteSchema = z.object({
  runNumber: z.string(),
  type: z.enum(['SINGLES', 'DOUBLES']),
  origin: z.string(),
  destination: z.string(),
  days: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  distance: z.number(),
  rateType: z.enum(['HOURLY', 'MILEAGE', 'FLAT_RATE']),
  workTime: z.number(),
  requiresDoublesEndorsement: z.boolean().default(false),
  requiresChainExperience: z.boolean().default(false),
  isActive: z.boolean().default(true),
  terminalId: z.string(),
});

const updateRouteSchema = createRouteSchema.partial();

// GET /api/routes - Get all routes with optional filtering
router.get('/', authenticateToken, checkTerminalAccess, async (req: TerminalAccessRequest, res: Response) => {
  try {
    const {
      type,
      requiresDoublesEndorsement,
      requiresChainExperience,
      searchTerm,
      isActive,
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

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (type) {
      where.type = type;
    }

    if (requiresDoublesEndorsement) {
      where.requiresDoublesEndorsement = requiresDoublesEndorsement === 'true';
    }

    if (requiresChainExperience) {
      where.requiresChainExperience = requiresChainExperience === 'true';
    }

    if (searchTerm) {
      const searchString = searchTerm as string;
      where.OR = [
        { runNumber: { contains: searchString, mode: 'insensitive' } },
        { origin: { contains: searchString, mode: 'insensitive' } },
        { destination: { contains: searchString, mode: 'insensitive' } },
      ];
    }

    const routes = await prisma.route.findMany({
      where,
      orderBy: { runNumber: 'asc' },
      include: {
        currentEmployees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
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
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
              },
            },
          },
        },
      },
    });

    res.json(routes);
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/routes/available/:selectionPeriodId - Get available routes for selection period
router.get('/available/:selectionPeriodId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { selectionPeriodId } = req.params;

    // Check if selection period exists and is open
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: selectionPeriodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (selectionPeriod.status !== 'OPEN') {
      return res.status(400).json({ error: 'Selection period is not open' });
    }

    // Get current user's employee profile
    console.log('User info:', {
      userId: req.user?.id,
      role: req.user?.role,
      employeeId: req.user?.employeeId
    });

    const employee = req.user?.employeeId ? await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      select: {
        doublesEndorsement: true,
        chainExperience: true,
      }
    }) : null;

    console.log('Employee profile:', employee);

    // Get routes that are part of this selection period
    const periodRoutes = await prisma.periodRoute.findMany({
      where: { selectionPeriodId },
      select: { routeId: true },
    });

    const periodRouteIds = periodRoutes.map(pr => pr.routeId);
    
    console.log('Available routes - Selection period:', selectionPeriodId);
    console.log('Available routes - Period routes found:', periodRoutes.length);
    console.log('Available routes - Period route IDs:', periodRouteIds);

    // Get routes that are active and not yet assigned for this period
    const assignedRouteIds = await prisma.assignment.findMany({
      where: { selectionPeriodId },
      select: { routeId: true },
    });

    const assignedIds = assignedRouteIds
      .filter(a => a.routeId)
      .map(a => a.routeId as string);

    console.log('Building where clause:', {
      periodRouteIds,
      assignedIds,
      hasAssignedIds: assignedIds.length > 0
    });

    const whereClause: any = {
      id: {
        in: periodRouteIds,
      },
      isActive: true,
    };

    // Only add notIn if there are actually assigned IDs
    if (assignedIds.length > 0) {
      whereClause.id.notIn = assignedIds;
    }

    // If it's a driver, filter out routes they don't qualify for
    if (req.user?.role === 'DRIVER' && employee) {
      whereClause.AND = [];
      
      // Filter doubles routes if driver doesn't have endorsement
      if (!employee.doublesEndorsement) {
        whereClause.AND.push({
          requiresDoublesEndorsement: false
        });
      }
      
      // Filter chain experience routes if driver doesn't have experience
      if (!employee.chainExperience) {
        whereClause.AND.push({
          requiresChainExperience: false
        });
      }
    }

    console.log('Final where clause:', JSON.stringify(whereClause, null, 2));

    let availableRoutes;
    try {
      availableRoutes = await prisma.route.findMany({
        where: whereClause,
        orderBy: { runNumber: 'asc' },
      });
      console.log('Found available routes:', availableRoutes.length);
    } catch (queryError: any) {
      console.error('Prisma query failed:', queryError);
      console.error('Query error details:', {
        message: queryError.message,
        code: queryError.code,
        meta: queryError.meta
      });
      throw queryError;
    }

    res.json(availableRoutes);
  } catch (error: any) {
    console.error('Get available routes error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Failed to fetch available routes'
    });
  }
});

// GET /api/routes/:id - Get single route
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: {
        currentEmployees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            hireDate: true,
          },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
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
      },
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/routes - Create new route (Admin only)
router.post('/', authenticateToken, requireAdmin, checkTerminalAccess, async (req: TerminalAccessRequest, res: Response) => {
  try {
    const data = createRouteSchema.parse(req.body);

    // Validate terminal access
    if (!req.allowedTerminals?.includes(data.terminalId)) {
      return res.status(403).json({ error: 'Access denied to this terminal' });
    }

    // Check if run number already exists for the terminal
    const existingRoute = await prisma.route.findFirst({
      where: { 
        runNumber: data.runNumber,
        terminalId: data.terminalId,
      },
    });

    if (existingRoute) {
      return res.status(409).json({ error: 'Route with this run number already exists' });
    }

    // Normalize route types from import
    const typeInput = data.type as any;
    if (typeInput === 'Doubles') {
      data.type = 'DOUBLES';
    } else if (typeInput === 'Singles') {
      data.type = 'SINGLES';
    }

    // Normalize rate types from import
    const rateTypeInput = data.rateType as any;
    if (rateTypeInput === 'Miles') {
      data.rateType = 'MILEAGE';
    } else if (rateTypeInput === 'Salary') {
      data.rateType = 'FLAT_RATE';
    }

    // Automatically set requiresDoublesEndorsement for doubles routes
    if (data.type === 'DOUBLES') {
      data.requiresDoublesEndorsement = true;
    }

    const route = await prisma.route.create({
      data,
    });

    res.status(201).json(route);
  } catch (error) {
    console.error('Create route error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/routes/:id - Update route (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updateRouteSchema.parse(req.body);

    // Check if route exists
    const existingRoute = await prisma.route.findUnique({
      where: { id: req.params.id },
    });

    if (!existingRoute) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Check if run number is being changed and if it conflicts
    if (data.runNumber && data.runNumber !== existingRoute.runNumber) {
      const conflictingRoute = await prisma.route.findUnique({
        where: { runNumber: data.runNumber },
      });

      if (conflictingRoute) {
        return res.status(409).json({ error: 'Route with this run number already exists' });
      }
    }

    // Normalize route types from import
    const typeInput = data.type as any;
    if (typeInput === 'Doubles') {
      data.type = 'DOUBLES';
    } else if (typeInput === 'Singles') {
      data.type = 'SINGLES';
    }

    // Normalize rate types from import
    const rateTypeInput = data.rateType as any;
    if (rateTypeInput === 'Miles') {
      data.rateType = 'MILEAGE';
    } else if (rateTypeInput === 'Salary') {
      data.rateType = 'FLAT_RATE';
    }

    // Automatically set requiresDoublesEndorsement for doubles routes
    if (data.type === 'DOUBLES') {
      data.requiresDoublesEndorsement = true;
    }

    const route = await prisma.route.update({
      where: { id: req.params.id },
      data,
    });

    res.json(route);
  } catch (error) {
    console.error('Update route error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/routes/:id - Delete route (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if route exists
    const existingRoute = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: true,
        firstChoiceSelections: true,
        secondChoiceSelections: true,
        thirdChoiceSelections: true,
      },
    });

    if (!existingRoute) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Check if route has any assignments or selections
    const hasAssignments = existingRoute.assignments.length > 0;
    const hasSelections = 
      existingRoute.firstChoiceSelections.length > 0 ||
      existingRoute.secondChoiceSelections.length > 0 ||
      existingRoute.thirdChoiceSelections.length > 0;

    if (hasAssignments || hasSelections) {
      return res.status(409).json({ 
        error: 'Cannot delete route with existing assignments or selections. Consider deactivating instead.' 
      });
    }

    await prisma.route.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;