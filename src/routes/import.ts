import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { checkTerminalAccess, validateTerminalAccess } from '../middleware/terminalAccess.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx, .xls, and .csv files are allowed.'));
    }
  },
});

// POST /api/import/routes/preview - Preview route import
router.post('/routes/preview', authenticateToken, requireAdmin, checkTerminalAccess, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get terminal ID from query or user's terminal
    const terminalId = req.query.terminalId as string || req.user?.terminalId;
    
    if (!terminalId) {
      return res.status(400).json({
        error: 'Terminal ID is required for importing routes'
      });
    }

    const result = await FileProcessor.processRouteFile(req.file.buffer, req.file.originalname);

    res.json({
      preview: true,
      result,
      filename: req.file.originalname,
      terminalId,
    });
  } catch (error) {
    console.error('Route import preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/import/routes/execute - Execute route import
router.post('/routes/execute', authenticateToken, requireAdmin, checkTerminalAccess, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { overwrite = false } = req.body;
    
    // Get terminal ID from query or user's terminal
    const terminalId = req.query.terminalId as string || req.user?.terminalId;
    
    if (!terminalId) {
      return res.status(400).json({
        error: 'Terminal ID is required for importing routes'
      });
    }
    
    const result = await FileProcessor.processRouteFile(req.file.buffer, req.file.originalname);

    if (!result.success) {
      return res.status(400).json({
        error: 'Import validation failed',
        result,
      });
    }

    // Process the import
    const importResults = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const routeData of result.data) {
      try {
        // Add terminalId to route data
        const routeWithTerminal = {
          ...routeData,
          terminalId
        };

        const existingRoute = await prisma.route.findUnique({
          where: { 
            runNumber_terminalId: {
              runNumber: routeData.runNumber,
              terminalId: terminalId
            }
          },
        });

        if (existingRoute) {
          if (overwrite) {
            await prisma.route.update({
              where: { 
                runNumber_terminalId: {
                  runNumber: routeData.runNumber,
                  terminalId: terminalId
                }
              },
              data: routeWithTerminal,
            });
            importResults.updated++;
          } else {
            importResults.skipped++;
          }
        } else {
          await prisma.route.create({
            data: routeWithTerminal,
          });
          importResults.created++;
        }
      } catch (error) {
        importResults.errors.push(`Route ${routeData.runNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'IMPORT_ROUTES',
        resource: 'Route',
        details: `Imported ${importResults.created} new routes, updated ${importResults.updated}, skipped ${importResults.skipped}`,
      },
    });

    res.json({
      success: true,
      importResults,
      originalResult: result,
    });
  } catch (error) {
    console.error('Route import execute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/import/employees/preview - Preview employee import
router.post('/employees/preview', authenticateToken, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await FileProcessor.processEmployeeFile(req.file.buffer, req.file.originalname);

    res.json({
      preview: true,
      result,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('Employee import preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/import/employees/execute - Execute employee import
router.post('/employees/execute', authenticateToken, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { overwrite = false, createUserAccounts = true } = req.body;
    const result = await FileProcessor.processEmployeeFile(req.file.buffer, req.file.originalname);

    if (!result.success) {
      return res.status(400).json({
        error: 'Import validation failed',
        result,
      });
    }

    // Process the import
    const importResults = {
      created: 0,
      updated: 0,
      skipped: 0,
      userAccountsCreated: 0,
      errors: [] as string[],
    };

    for (const employeeData of result.data) {
      try {
        // Look up terminal by code
        const terminal = await prisma.terminal.findUnique({
          where: { code: employeeData.terminal },
        });

        if (!terminal) {
          importResults.errors.push(`Employee ${employeeData.employeeId}: Terminal '${employeeData.terminal}' not found`);
          continue;
        }

        // Replace terminal code with terminalId
        const { terminal: terminalCode, ...employeeWithoutTerminal } = employeeData;
        const processedEmployeeData = {
          ...employeeWithoutTerminal,
          terminalId: terminal.id,
        };

        const existingEmployee = await prisma.employee.findUnique({
          where: { employeeId: employeeData.employeeId },
        });

        if (existingEmployee) {
          if (overwrite) {
            await prisma.employee.update({
              where: { employeeId: employeeData.employeeId },
              data: processedEmployeeData,
            });
            importResults.updated++;
          } else {
            importResults.skipped++;
          }
        } else {
          // Create user account first if requested
          let userCreated = false;
          if (createUserAccounts) {
            try {
              const existingUser = await prisma.user.findUnique({
                where: { email: employeeData.email },
              });

              if (!existingUser) {
                const { hashPassword } = await import('../utils/auth.js');
                const defaultPassword = await hashPassword('driver123');
                
                await prisma.user.create({
                  data: {
                    email: employeeData.email,
                    password: defaultPassword,
                    role: 'DRIVER',
                    terminalId: terminal.id,
                  },
                });
                
                userCreated = true;
                importResults.userAccountsCreated++;
              }
            } catch (userError) {
              importResults.errors.push(`Employee ${employeeData.employeeId}: Failed to create user account - ${userError instanceof Error ? userError.message : 'Unknown error'}`);
            }
          }

          // Create employee
          await prisma.employee.create({
            data: processedEmployeeData,
          });
          importResults.created++;
        }
      } catch (error) {
        importResults.errors.push(`Employee ${employeeData.employeeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'IMPORT_EMPLOYEES',
        resource: 'Employee',
        details: `Imported ${importResults.created} new employees, updated ${importResults.updated}, skipped ${importResults.skipped}`,
      },
    });

    res.json({
      success: true,
      importResults,
      originalResult: result,
    });
  } catch (error) {
    console.error('Employee import execute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/templates/routes - Download route import template
router.get('/templates/routes', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  try {
    const template = FileProcessor.generateRouteTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="route_import_template.xlsx"');
    res.send(template);
  } catch (error) {
    console.error('Route template generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/templates/employees - Download employee import template
router.get('/templates/employees', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  try {
    const template = FileProcessor.generateEmployeeTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
    res.send(template);
  } catch (error) {
    console.error('Employee template generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;