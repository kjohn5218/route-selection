import { Router, Request, Response } from 'express';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AssignmentEngine } from '../services/assignmentEngine.js';
import emailService from '../services/email.js';

const router = Router();

// GET /api/assignments - Get all assignments
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { selectionPeriodId } = req.query;

    const where: any = {};
    if (selectionPeriodId) {
      where.selectionPeriodId = selectionPeriodId;
    }

    const assignments = await prisma.assignment.findMany({
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
          },
        },
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
        employee: {
          hireDate: 'asc',
        },
      },
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assignments/period/:periodId - Get assignments for a specific period
router.get('/period/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const assignments = await prisma.assignment.findMany({
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
          },
        },
        route: {
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
      orderBy: {
        employee: {
          hireDate: 'asc',
        },
      },
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get period assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assignments/my/:periodId - Get current user's assignment for a period
router.get('/my/:periodId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    if (!req.user?.employeeId) {
      return res.status(403).json({ error: 'Employee profile required' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: {
        employeeId_selectionPeriodId: {
          employeeId: req.user.employeeId,
          selectionPeriodId: periodId,
        },
      },
      include: {
        route: {
          select: {
            id: true,
            runNumber: true,
            origin: true,
            destination: true,
            type: true,
            days: true,
            startTime: true,
            endTime: true,
            distance: true,
            rateType: true,
            workTime: true,
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
    });

    res.json(assignment);
  } catch (error) {
    console.error('Get my assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/process/:periodId - Process assignments for a period
router.post('/process/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { preview = false } = req.body;

    // Check if selection period exists and is in the right status
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (selectionPeriod.status !== 'CLOSED' && selectionPeriod.status !== 'PROCESSING') {
      return res.status(400).json({ 
        error: 'Selection period must be closed before processing assignments' 
      });
    }

    // Update status to processing if not already
    if (selectionPeriod.status === 'CLOSED') {
      await prisma.selectionPeriod.update({
        where: { id: periodId },
        data: { status: 'PROCESSING' },
      });
    }

    try {
      const engine = new AssignmentEngine();
      const assignments = await engine.processAssignments(periodId);

      // Validate assignments
      const validation = engine.validateAssignments();
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: 'Assignment validation failed', 
          details: validation.errors 
        });
      }

      const summary = engine.getAssignmentSummary();

      if (!preview) {
        // Save assignments to database
        await engine.saveAssignments(periodId);

        // Update selection period status
        await prisma.selectionPeriod.update({
          where: { id: periodId },
          data: { status: 'COMPLETED' },
        });

        // Log the assignment processing
        await prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'PROCESS_ASSIGNMENTS',
            resource: 'SelectionPeriod',
            details: `Processed assignments for period ${selectionPeriod.name}. Total: ${assignments.length} assignments`,
          },
        });
      }

      res.json({
        success: true,
        preview,
        summary,
        assignments: assignments.map(a => ({
          employeeId: a.employeeId,
          routeId: a.routeId,
          choiceReceived: a.choiceReceived,
          reason: a.reason,
        })),
      });

    } catch (processingError) {
      // Reset status to closed if processing failed
      await prisma.selectionPeriod.update({
        where: { id: periodId },
        data: { status: 'CLOSED' },
      });
      throw processingError;
    }

  } catch (error) {
    console.error('Process assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/manual/:periodId - Create manual assignment
router.post('/manual/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { employeeId, routeId, reason } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Check if selection period exists
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if route exists (if provided)
    if (routeId) {
      const route = await prisma.route.findUnique({
        where: { id: routeId },
      });

      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      // Check if route is already assigned
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          selectionPeriodId: periodId,
          routeId,
        },
      });

      if (existingAssignment) {
        return res.status(409).json({ error: 'Route is already assigned to another employee' });
      }

      // Check qualifications
      if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) {
        return res.status(400).json({ error: 'Employee does not have required doubles endorsement' });
      }

      if (route.requiresChainExperience && !employee.chainExperience) {
        return res.status(400).json({ error: 'Employee does not have required chain experience' });
      }
    }

    // Create or update assignment
    const assignment = await prisma.assignment.upsert({
      where: {
        employeeId_selectionPeriodId: {
          employeeId,
          selectionPeriodId: periodId,
        },
      },
      update: {
        routeId,
        choiceReceived: null, // Manual assignments don't have choice numbers
      },
      create: {
        employeeId,
        selectionPeriodId: periodId,
        routeId,
        choiceReceived: null,
        effectiveDate: new Date(),
      },
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
    });

    // Update employee's current route
    await prisma.employee.update({
      where: { id: employeeId },
      data: { currentRouteId: routeId },
    });

    // Log the manual assignment
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'MANUAL_ASSIGNMENT',
        resource: 'Assignment',
        details: `Manually assigned employee ${employee.employeeId} to ${routeId ? `route ${assignment.route?.runNumber}` : 'float pool'}. Reason: ${reason || 'Not specified'}`,
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Manual assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/assignments/:id - Remove assignment
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true,
        route: true,
        selectionPeriod: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if selection period allows modifications
    if (assignment.selectionPeriod.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify assignments for completed periods' });
    }

    await prisma.assignment.delete({
      where: { id: req.params.id },
    });

    // Clear employee's current route
    await prisma.employee.update({
      where: { id: assignment.employeeId },
      data: { currentRouteId: null },
    });

    // Log the assignment removal
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'REMOVE_ASSIGNMENT',
        resource: 'Assignment',
        details: `Removed assignment for employee ${assignment.employee.employeeId} from ${assignment.route?.runNumber || 'float pool'}`,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assignments/summary/:periodId - Get assignment summary for a period
router.get('/summary/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const period = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { selectionPeriodId: periodId },
      include: {
        route: {
          select: { type: true },
        },
      },
    });

    const totalEmployees = await prisma.employee.count({
      where: { isEligible: true },
    });

    const summary = {
      totalEmployees,
      totalAssignments: assignments.length,
      assignedToRoutes: assignments.filter(a => a.routeId).length,
      inFloatPool: assignments.filter(a => !a.routeId).length,
      choiceDistribution: {
        firstChoice: assignments.filter(a => a.choiceReceived === 1).length,
        secondChoice: assignments.filter(a => a.choiceReceived === 2).length,
        thirdChoice: assignments.filter(a => a.choiceReceived === 3).length,
        manual: assignments.filter(a => a.choiceReceived === null && a.routeId).length,
        floatPool: assignments.filter(a => !a.routeId).length,
      },
      routeTypeDistribution: assignments.reduce((acc: any, assignment) => {
        if (assignment.route?.type) {
          acc[assignment.route.type] = (acc[assignment.route.type] || 0) + 1;
        }
        return acc;
      }, {}),
    };

    res.json({
      period: {
        id: period.id,
        name: period.name,
        status: period.status,
      },
      summary,
    });
  } catch (error) {
    console.error('Get assignment summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/notify/:periodId - Send assignment notifications
router.post('/notify/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const period = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    if (period.status !== 'COMPLETED') {
      return res.status(400).json({ 
        error: 'Assignments must be completed before sending notifications' 
      });
    }

    // Get all assignments with employee and route details
    const assignments = await prisma.assignment.findMany({
      where: { selectionPeriodId: periodId },
      include: {
        employee: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        route: {
          select: {
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

    // Send email notifications
    let successCount = 0;
    let failureCount = 0;
    const emailPromises = [];

    for (const assignment of assignments) {
      if (assignment.employee.user?.email) {
        const emailPromise = emailService.sendAssignmentNotification(
          assignment.employee.user.email,
          `${assignment.employee.firstName} ${assignment.employee.lastName}`,
          {
            routeNumber: assignment.route?.runNumber || 'Float Pool',
            origin: assignment.route?.origin || 'Various',
            destination: assignment.route?.destination || 'Various',
            choiceReceived: assignment.choiceReceived,
            periodName: period.name,
          }
        ).then(() => {
          successCount++;
        }).catch((error) => {
          console.error(`Failed to send email to ${assignment.employee.user?.email}:`, error);
          failureCount++;
        });
        
        emailPromises.push(emailPromise);
      }
    }

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    // Log the notification attempt
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_ASSIGNMENT_NOTIFICATIONS',
        resource: 'Assignment',
        details: `Sent assignment notifications to ${successCount} employees for period: ${period.name}. Failed: ${failureCount}`,
      },
    });

    console.log(`Assignment notifications sent: ${successCount} successful, ${failureCount} failed`);

    res.json({
      success: true,
      notificationsSent: successCount,
      notificationsFailed: failureCount,
      totalAssignments: assignments.length,
      period: {
        id: period.id,
        name: period.name,
      },
    });
  } catch (error) {
    console.error('Send assignment notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;