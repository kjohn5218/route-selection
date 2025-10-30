import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin, requireAdminOrSelf } from '../middleware/auth.js';
import emailService from '../services/email.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import PDFDocument from 'pdfkit';

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

    // Get all eligible employees
    const allEmployees = await prisma.employee.findMany({
      where: { isEligible: true },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { hireDate: 'asc' },
    });

    // Get selections for the period
    const selections = await prisma.selection.findMany({
      where: {
        selectionPeriodId: periodId,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
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
        assignedRoute: {
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

    // Create a map of selections by employee ID
    const selectionMap = new Map(
      selections.map(s => [s.employeeId, s])
    );

    // Combine all employees with their selections
    const results = allEmployees.map(employee => {
      const selection = selectionMap.get(employee.id);
      return {
        id: selection?.id || null,
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.user?.email || null,
          hireDate: employee.hireDate,
          isEligible: employee.isEligible,
        },
        firstChoice: selection?.firstChoice || null,
        secondChoice: selection?.secondChoice || null,
        thirdChoice: selection?.thirdChoice || null,
        assignedRoute: selection?.assignedRoute || null,
        submittedAt: selection?.submittedAt || null,
        confirmationNumber: selection?.confirmationNumber || null,
      };
    });

    res.json(results);
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
    const choiceIds = [data.firstChoiceId, data.secondChoiceId, data.thirdChoiceId].filter((id): id is string => id !== null && id !== undefined);
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
    const choiceIds = [data.firstChoiceId, data.secondChoiceId, data.thirdChoiceId].filter((id): id is string => id !== null && id !== undefined);
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

// POST /api/selections/send-notifications - Send email notifications for selection results
router.post('/send-notifications', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId, employeeIds } = req.body;

    if (!periodId) {
      return res.status(400).json({ error: 'Period ID is required' });
    }

    // Get selection period
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Build query filters
    const where: any = { selectionPeriodId: periodId };
    if (employeeIds && employeeIds.length > 0) {
      where.employeeId = { in: employeeIds };
    }

    // Get selections with employee and route details
    const selections = await prisma.selection.findMany({
      where,
      include: {
        employee: {
          include: {
            user: true,
          },
        },
        firstChoice: true,
        secondChoice: true,
        thirdChoice: true,
        assignedRoute: true,
      },
    });

    // Send emails to each employee
    const emailPromises = selections.map(async (selection) => {
      if (!selection.employee.user?.email) return;

      const emailContent = {
        to: selection.employee.user.email,
        subject: `Route Selection Results - ${selectionPeriod.name}`,
        html: `
          <h2>Route Selection Results</h2>
          <p>Dear ${selection.employee.firstName} ${selection.employee.lastName},</p>
          
          <p>Here are your route selection results for ${selectionPeriod.name}:</p>
          
          <h3>Your Selections:</h3>
          <ul>
            ${selection.firstChoice ? `<li><strong>First Choice:</strong> Route #${selection.firstChoice.runNumber} - ${selection.firstChoice.origin} to ${selection.firstChoice.destination}</li>` : ''}
            ${selection.secondChoice ? `<li><strong>Second Choice:</strong> Route #${selection.secondChoice.runNumber} - ${selection.secondChoice.origin} to ${selection.secondChoice.destination}</li>` : ''}
            ${selection.thirdChoice ? `<li><strong>Third Choice:</strong> Route #${selection.thirdChoice.runNumber} - ${selection.thirdChoice.origin} to ${selection.thirdChoice.destination}</li>` : ''}
          </ul>
          
          ${selection.assignedRoute ? `
            <h3>Assigned Route:</h3>
            <p><strong>Route #${selection.assignedRoute.runNumber}</strong> - ${selection.assignedRoute.origin} to ${selection.assignedRoute.destination}</p>
            <p>Schedule: ${selection.assignedRoute.days} | ${selection.assignedRoute.startTime} - ${selection.assignedRoute.endTime}</p>
          ` : '<p>Route assignment is pending. You will be notified once routes are assigned.</p>'}
          
          <p>Confirmation Number: ${selection.confirmationNumber}</p>
          
          <p>If you have any questions, please contact your supervisor.</p>
          
          <p>Best regards,<br>Route Selection System</p>
        `,
      };

      return emailService.sendEmail(emailContent);
    });

    await Promise.allSettled(emailPromises);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SEND_SELECTION_NOTIFICATIONS',
        resource: 'Selection',
        details: JSON.stringify({
          selectionPeriodId: periodId,
          employeeCount: selections.length,
          employeeIds: employeeIds || 'all',
        }),
      },
    });

    res.json({ 
      message: 'Email notifications sent successfully',
      count: selections.length 
    });
  } catch (error) {
    console.error('Send notifications error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// GET /api/selections/download/:periodId - Download selection results
router.get('/download/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { format = 'csv' } = req.query;

    // Get selection period
    const selectionPeriod = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!selectionPeriod) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    // Get all selections for the period
    const selections = await prisma.selection.findMany({
      where: { selectionPeriodId: periodId },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
        firstChoice: true,
        secondChoice: true,
        thirdChoice: true,
        assignedRoute: true,
      },
      orderBy: {
        employee: {
          hireDate: 'asc',
        },
      },
    });

    // Get all employees (including those without selections)
    const allEmployees = await prisma.employee.findMany({
      where: { isEligible: true },
      include: {
        user: true,
      },
      orderBy: { hireDate: 'asc' },
    });

    // Create a map of selections by employee ID
    const selectionMap = new Map(
      selections.map(s => [s.employeeId, s])
    );

    // Build the data array including employees without selections
    const data = allEmployees.map(employee => {
      const selection = selectionMap.get(employee.id);
      return {
        'Employee Number': employee.employeeId,
        'Name': `${employee.firstName} ${employee.lastName}`,
        'Email': employee.user?.email || '',
        'Hire Date': employee.hireDate.toISOString().split('T')[0],
        'Status': selection ? 'Submitted' : 'Not Submitted',
        'First Choice': selection?.firstChoice ? `#${selection.firstChoice.runNumber} - ${selection.firstChoice.origin} to ${selection.firstChoice.destination}` : '',
        'Second Choice': selection?.secondChoice ? `#${selection.secondChoice.runNumber} - ${selection.secondChoice.origin} to ${selection.secondChoice.destination}` : '',
        'Third Choice': selection?.thirdChoice ? `#${selection.thirdChoice.runNumber} - ${selection.thirdChoice.origin} to ${selection.thirdChoice.destination}` : '',
        'Assigned Route': selection?.assignedRoute ? `#${selection.assignedRoute.runNumber} - ${selection.assignedRoute.origin} to ${selection.assignedRoute.destination}` : '',
        'Confirmation Number': selection?.confirmationNumber || '',
        'Submitted At': selection?.submittedAt ? selection.submittedAt.toISOString() : '',
      };
    });

    if (format === 'pdf') {
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="selection-results-${periodId}.pdf"`);
        res.send(result);
      });

      // Add title
      doc.fontSize(20).text(`Selection Results - ${selectionPeriod.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Add summary
      const submitted = selections.length;
      const notSubmitted = allEmployees.length - submitted;
      doc.fontSize(14).text('Summary:', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Eligible Employees: ${allEmployees.length}`);
      doc.text(`Submitted: ${submitted}`);
      doc.text(`Not Submitted: ${notSubmitted}`);
      doc.moveDown(2);

      // Add employee selections
      doc.fontSize(14).text('Employee Selections:', { underline: true });
      doc.moveDown();

      data.forEach((employee, index) => {
        if (index > 0 && index % 5 === 0) {
          doc.addPage();
        }

        doc.fontSize(12).text(`${employee['Employee Number']} - ${employee.Name}`, { underline: true });
        doc.fontSize(10);
        doc.text(`Status: ${employee.Status}`);
        if (employee.Status === 'Submitted') {
          if (employee['First Choice']) doc.text(`First Choice: ${employee['First Choice']}`);
          if (employee['Second Choice']) doc.text(`Second Choice: ${employee['Second Choice']}`);
          if (employee['Third Choice']) doc.text(`Third Choice: ${employee['Third Choice']}`);
          if (employee['Assigned Route']) {
            doc.text(`Assigned Route: ${employee['Assigned Route']}`, { 
              color: 'green',
              underline: true 
            });
          }
          doc.text(`Confirmation: ${employee['Confirmation Number']}`);
        }
        doc.moveDown();
      });

      doc.end();
    } else {
      // Generate CSV
      const csv = await FileProcessor.generateCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="selection-results-${periodId}.csv"`);
      res.send(csv);
    }
  } catch (error) {
    console.error('Download selection results error:', error);
    res.status(500).json({ error: 'Failed to generate download' });
  }
});

export default router;