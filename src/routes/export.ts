import { Router, Request, Response } from 'express';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { FileProcessor } from '../utils/fileProcessor.js';

const router = Router();

// GET /api/export/routes - Export routes to Excel/CSV
router.get('/routes', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', includeInactive = 'false' } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const routes = await prisma.route.findMany({
      where,
      orderBy: { runNumber: 'asc' },
      select: {
        runNumber: true,
        type: true,
        origin: true,
        destination: true,
        days: true,
        startTime: true,
        endTime: true,
        distance: true,
        rateType: true,
        workTime: true,
        requiresDoublesEndorsement: true,
        requiresChainExperience: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const filename = `routes_export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvData = FileProcessor.generateCSV(routes);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    } else {
      const excelData = FileProcessor.generateExcel(routes, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(excelData);
    }

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPORT_ROUTES',
        resource: 'Route',
        details: `Exported ${routes.length} routes in ${format} format`,
      },
    });
  } catch (error) {
    console.error('Routes export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/employees - Export employees to Excel/CSV
router.get('/employees', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', includeIneligible = 'false' } = req.query;

    const where: any = {};
    if (includeIneligible !== 'true') {
      where.isEligible = true;
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [
        { hireDate: 'asc' },
        { lastName: 'asc' },
      ],
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        hireDate: true,
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
        route: {
          select: {
            runNumber: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Flatten the data for export
    const exportData = employees.map(employee => ({
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      hireDate: employee.hireDate.toISOString().split('T')[0],
      doublesEndorsement: employee.doublesEndorsement,
      chainExperience: employee.chainExperience,
      isEligible: employee.isEligible,
      currentRoute: employee.route?.runNumber || '',
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    }));

    const filename = `employees_export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvData = FileProcessor.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    } else {
      const excelData = FileProcessor.generateExcel(exportData, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(excelData);
    }

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPORT_EMPLOYEES',
        resource: 'Employee',
        details: `Exported ${employees.length} employees in ${format} format`,
      },
    });
  } catch (error) {
    console.error('Employees export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/selections/:periodId - Export selections for a period
router.get('/selections/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { format = 'xlsx' } = req.query;

    const period = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    const selections = await prisma.selection.findMany({
      where: { selectionPeriodId: periodId },
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            hireDate: true,
          },
        },
        firstChoice: {
          select: {
            runNumber: true,
          },
        },
        secondChoice: {
          select: {
            runNumber: true,
          },
        },
        thirdChoice: {
          select: {
            runNumber: true,
          },
        },
      },
      orderBy: {
        employee: {
          hireDate: 'asc',
        },
      },
    });

    const exportData = selections.map(selection => ({
      employeeId: selection.employee.employeeId,
      firstName: selection.employee.firstName,
      lastName: selection.employee.lastName,
      hireDate: selection.employee.hireDate.toISOString().split('T')[0],
      firstChoice: selection.firstChoice?.runNumber || '',
      secondChoice: selection.secondChoice?.runNumber || '',
      thirdChoice: selection.thirdChoice?.runNumber || '',
      confirmationNumber: selection.confirmationNumber,
      submittedAt: selection.submittedAt.toISOString(),
    }));

    const filename = `selections_${period.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvData = FileProcessor.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    } else {
      const excelData = FileProcessor.generateExcel(exportData, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(excelData);
    }

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPORT_SELECTIONS',
        resource: 'Selection',
        details: `Exported ${selections.length} selections for period ${period.name} in ${format} format`,
      },
    });
  } catch (error) {
    console.error('Selections export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/assignments/:periodId - Export assignments for a period
router.get('/assignments/:periodId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { format = 'xlsx' } = req.query;

    const period = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return res.status(404).json({ error: 'Selection period not found' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { selectionPeriodId: periodId },
      include: {
        employee: {
          select: {
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
            runNumber: true,
            type: true,
            origin: true,
            destination: true,
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

    const exportData = assignments.map(assignment => ({
      employeeId: assignment.employee.employeeId,
      firstName: assignment.employee.firstName,
      lastName: assignment.employee.lastName,
      hireDate: assignment.employee.hireDate.toISOString().split('T')[0],
      doublesEndorsement: assignment.employee.doublesEndorsement,
      chainExperience: assignment.employee.chainExperience,
      assignedRoute: assignment.route?.runNumber || 'FLOAT POOL',
      routeType: assignment.route?.type || '',
      routeOrigin: assignment.route?.origin || '',
      routeDestination: assignment.route?.destination || '',
      routeDays: assignment.route?.days || '',
      routeStartTime: assignment.route?.startTime || '',
      routeEndTime: assignment.route?.endTime || '',
      choiceReceived: assignment.choiceReceived || 'FLOAT',
      effectiveDate: assignment.effectiveDate.toISOString().split('T')[0],
    }));

    const filename = `assignments_${period.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvData = FileProcessor.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    } else {
      const excelData = FileProcessor.generateExcel(exportData, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(excelData);
    }

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPORT_ASSIGNMENTS',
        resource: 'Assignment',
        details: `Exported ${assignments.length} assignments for period ${period.name} in ${format} format`,
      },
    });
  } catch (error) {
    console.error('Assignments export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/export/seniority - Export seniority list
router.get('/seniority', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx' } = req.query;

    const employees = await prisma.employee.findMany({
      where: { isEligible: true },
      orderBy: [
        { hireDate: 'asc' },
        { lastName: 'asc' },
      ],
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        hireDate: true,
        doublesEndorsement: true,
        chainExperience: true,
        route: {
          select: {
            runNumber: true,
          },
        },
      },
    });

    const exportData = employees.map((employee, index) => ({
      seniorityRank: index + 1,
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      hireDate: employee.hireDate.toISOString().split('T')[0],
      doublesEndorsement: employee.doublesEndorsement,
      chainExperience: employee.chainExperience,
      currentRoute: employee.route?.runNumber || '',
    }));

    const filename = `seniority_list_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvData = FileProcessor.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvData);
    } else {
      const excelData = FileProcessor.generateExcel(exportData, filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(excelData);
    }

    // Log the export
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXPORT_SENIORITY',
        resource: 'Employee',
        details: `Exported seniority list with ${employees.length} employees in ${format} format`,
      },
    });
  } catch (error) {
    console.error('Seniority export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;