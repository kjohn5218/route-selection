import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin, requireAdminOrSelf } from '../middleware/auth.js';

const router = Router();

const createSelectionSchema = z.object({
  selectionPeriodId: z.string(),
  firstChoiceId: z.string().optional(),
  secondChoiceId: z.string().optional(),
  thirdChoiceId: z.string().optional(),
});

const updateSelectionSchema = createSelectionSchema.partial().omit({ selectionPeriodId: true });

// GET /api/selections - Get all selections (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { selectionPeriodId } = req.query;

    const where: any = {};
    if (selectionPeriodId) {
      where.selectionPeriodId = selectionPeriodId;
    }

    const selections = await prisma.selection.findMany({
      where,
      include: {
        employee: {
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
        },
        selectionPeriod: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        firstChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        secondChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        thirdChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
      },
      orderBy: {
        employee: {
          hireDate: 'asc',
        },
      },
    });

    res.json(selections);
  } catch (error) {
    console.error('Get selections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/selections/period/:periodId - Get selections for a specific period
router.get('/period/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const selections = await prisma.selection.findMany({
      where: {
        selectionPeriodId: periodId,
      },
      include: {
        employee: {
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
        },
        firstChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            requiresDoublesEndorsement: true,
            requiresChainExperience: true,
          },
        },
        secondChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            requiresDoublesEndorsement: true,
            requiresChainExperience: true,
          },
        },
        thirdChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            requiresDoublesEndorsement: true,
            requiresChainExperience: true,
          },
        },
      },
      orderBy: {
        employee: {
          hireDate: 'asc',
        },
      },
    });

    res.json(selections);
  } catch (error) {
    console.error('Get period selections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/selections/my/:periodId - Get current user's selection for a period
router.get('/my/:periodId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    if (!req.user?.employeeId) {
      return res.status(403).json({ error: 'Employee profile required' });
    }

    const selection = await prisma.selection.findUnique({
      where: {
        employeeId_selectionPeriodId: {
          employeeId: req.user.employeeId,
          selectionPeriodId: periodId,
        },
      },
      include: {
        selectionPeriod: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        firstChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            days: true,
            startTime: true,
            endTime: true,
          },
        },
        secondChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            days: true,
            startTime: true,
            endTime: true,
          },
        },
        thirdChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            days: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    res.json(selection);
  } catch (error) {
    console.error('Get my selection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/selections - Submit route selection
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = createSelectionSchema.parse(req.body);

    if (!req.user?.employeeId) {
      return res.status(403).json({ error: 'Employee profile required' });
    }

    // Check if employee is eligible
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
    });

    if (!employee || !employee.isEligible) {
      return res.status(403).json({ error: 'Employee not eligible for route selection' });
    }

    // Check if selection period exists and is open
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: data.selectionPeriodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (selectionPeriod.status !== 'OPEN') {
      return res.status(400).json({ error: 'Selection period is not open' });
    }

    const now = new Date();
    if (now < selectionPeriod.startDate || now > selectionPeriod.endDate) {
      return res.status(400).json({ error: 'Selection period is not currently active' });
    }

    // Check if employee already has a selection for this period
    const existingSelection = await prisma.selection.findUnique({
      where: {
        employeeId_selectionPeriodId: {
          employeeId: req.user.employeeId,
          selectionPeriodId: data.selectionPeriodId,
        },
      },
    });

    if (existingSelection) {
      return res.status(409).json({ error: 'Selection already submitted for this period' });
    }

    // Validate that choices are different and routes exist
    const choiceIds = [data.firstChoiceId, data.secondChoiceId, data.thirdChoiceId].filter(Boolean);
    const uniqueChoiceIds = new Set(choiceIds);
    
    // Validate number of selections doesn't exceed the period's requirement
    if (choiceIds.length > selectionPeriod.requiredSelections) {
      return res.status(400).json({ 
        error: `This period allows a maximum of ${selectionPeriod.requiredSelections} route selection${selectionPeriod.requiredSelections > 1 ? 's' : ''}` 
      });
    }

    if (choiceIds.length !== uniqueChoiceIds.size) {
      return res.status(400).json({ error: 'Route choices must be different' });
    }

    // Validate routes exist and employee qualifies
    if (choiceIds.length > 0) {
      const routes = await prisma.route.findMany({
        where: {
          id: { in: choiceIds },
          isActive: true,
        },
      });

      if (routes.length !== choiceIds.length) {
        return res.status(400).json({ error: 'One or more selected routes not found or inactive' });
      }

      // Check qualifications
      for (const route of routes) {
        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) {
          return res.status(400).json({ 
            error: `Route ${route.runNumber} requires doubles endorsement` 
          });
        }
        if (route.requiresChainExperience && !employee.chainExperience) {
          return res.status(400).json({ 
            error: `Route ${route.runNumber} requires chain experience` 
          });
        }
      }
    }

    // Generate confirmation number
    const confirmationNumber = `SEL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const selection = await prisma.selection.create({
      data: {
        employeeId: req.user.employeeId,
        selectionPeriodId: data.selectionPeriodId,
        firstChoiceId: data.firstChoiceId,
        secondChoiceId: data.secondChoiceId,
        thirdChoiceId: data.thirdChoiceId,
        confirmationNumber,
      },
      include: {
        firstChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        secondChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        thirdChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
      },
    });

    // Create audit log for selection creation
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SELECTION',
        resource: 'Selection',
        details: JSON.stringify({
          selectionId: selection.id,
          selectionPeriodId: data.selectionPeriodId,
          firstChoice: selection.firstChoice?.runNumber || null,
          secondChoice: selection.secondChoice?.runNumber || null,
          thirdChoice: selection.thirdChoice?.runNumber || null,
          confirmationNumber: confirmationNumber,
        }),
      },
    });

    res.status(201).json(selection);
  } catch (error) {
    console.error('Create selection error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/selections/:id - Update selection (only if period is still open)
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = updateSelectionSchema.parse(req.body);

    // Check if selection exists and belongs to user
    const existingSelection = await prisma.selection.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true,
        selectionPeriod: true,
      },
    });

    if (!existingSelection) {
      return res.status(404).json({ error: 'Selection not found' });
    }

    // Check authorization
    if (req.user?.role !== 'ADMIN' && req.user?.employeeId !== existingSelection.employeeId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if selection period is still open
    if (existingSelection.selectionPeriod.status !== 'OPEN') {
      return res.status(400).json({ error: 'Selection period is no longer open' });
    }

    const now = new Date();
    if (now < existingSelection.selectionPeriod.startDate || now > existingSelection.selectionPeriod.endDate) {
      return res.status(400).json({ error: 'Selection period is not currently active' });
    }

    // Validate choices if provided
    const choiceIds = [data.firstChoiceId, data.secondChoiceId, data.thirdChoiceId].filter(Boolean);
    const uniqueChoiceIds = new Set(choiceIds);
    
    // Validate number of selections doesn't exceed the period's requirement
    if (choiceIds.length > existingSelection.selectionPeriod.requiredSelections) {
      return res.status(400).json({ 
        error: `This period allows a maximum of ${existingSelection.selectionPeriod.requiredSelections} route selection${existingSelection.selectionPeriod.requiredSelections > 1 ? 's' : ''}` 
      });
    }

    if (choiceIds.length !== uniqueChoiceIds.size) {
      return res.status(400).json({ error: 'Route choices must be different' });
    }

    // Validate routes and qualifications if provided
    if (choiceIds.length > 0) {
      const routes = await prisma.route.findMany({
        where: {
          id: { in: choiceIds },
          isActive: true,
        },
      });

      if (routes.length !== choiceIds.length) {
        return res.status(400).json({ error: 'One or more selected routes not found or inactive' });
      }

      const employee = existingSelection.employee;
      for (const route of routes) {
        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) {
          return res.status(400).json({ 
            error: `Route ${route.runNumber} requires doubles endorsement` 
          });
        }
        if (route.requiresChainExperience && !employee.chainExperience) {
          return res.status(400).json({ 
            error: `Route ${route.runNumber} requires chain experience` 
          });
        }
      }
    }

    const selection = await prisma.selection.update({
      where: { id: req.params.id },
      data,
      include: {
        firstChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        secondChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
        thirdChoice: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
          },
        },
      },
    });

    // Create audit log for selection update
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_SELECTION',
        resource: 'Selection',
        details: JSON.stringify({
          selectionId: selection.id,
          selectionPeriodId: existingSelection.selectionPeriodId,
          updatedChoices: {
            firstChoice: selection.firstChoice?.runNumber || null,
            secondChoice: selection.secondChoice?.runNumber || null,
            thirdChoice: selection.thirdChoice?.runNumber || null,
          },
        }),
      },
    });

    res.json(selection);
  } catch (error) {
    console.error('Update selection error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/selections/:id - Delete selection (only if period is still open)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check if selection exists and belongs to user
    const existingSelection = await prisma.selection.findUnique({
      where: { id: req.params.id },
      include: {
        selectionPeriod: true,
      },
    });

    if (!existingSelection) {
      return res.status(404).json({ error: 'Selection not found' });
    }

    // Check authorization
    if (req.user?.role !== 'ADMIN' && req.user?.employeeId !== existingSelection.employeeId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if selection period is still open
    if (existingSelection.selectionPeriod.status !== 'OPEN') {
      return res.status(400).json({ error: 'Selection period is no longer open' });
    }

    await prisma.selection.delete({
      where: { id: req.params.id },
    });

    // Create audit log for selection deletion
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_SELECTION',
        resource: 'Selection',
        details: JSON.stringify({
          selectionId: req.params.id,
          selectionPeriod: existingSelection.selectionPeriod.name,
          selectionPeriodId: existingSelection.selectionPeriodId,
        }),
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete selection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;