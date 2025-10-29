import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import prisma from '../utils/database.js';

const router = Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Get total employees (only for admin/manager)
    let totalEmployees = 0;
    if (req.user?.role === 'ADMIN') {
      totalEmployees = await prisma.employee.count();
    }

    // Get total routes
    const totalRoutes = await prisma.route.count();

    // Get active period
    const activePeriod = await prisma.selectionPeriod.findFirst({
      where: {
        status: 'OPEN',
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    // Get selection counts
    let pendingSelections = 0;
    let completedSelections = 0;

    if (activePeriod) {
      if (req.user?.role === 'DRIVER') {
        // For drivers, only show their own selections
        const selection = await prisma.selection.findFirst({
          where: {
            selectionPeriodId: activePeriod.id,
            employeeId: req.user.employeeId || '',
          },
        });
        
        // If driver has submitted a selection, it's completed; otherwise it's pending
        if (selection) {
          completedSelections = 1;
          pendingSelections = 0;
        } else {
          completedSelections = 0;
          pendingSelections = 1;
        }
      } else {
        // For admin/manager, count all selections for the active period
        const totalSelections = await prisma.selection.count({
          where: {
            selectionPeriodId: activePeriod.id,
          },
        });
        
        // For admin view, we'll show all submitted selections as completed
        completedSelections = totalSelections;
        
        // Count eligible employees who haven't submitted
        const eligibleEmployees = await prisma.employee.count({
          where: { isEligible: true },
        });
        
        pendingSelections = Math.max(0, eligibleEmployees - totalSelections);
      }
    }

    res.json({
      totalEmployees,
      totalRoutes,
      activePeriod,
      pendingSelections,
      completedSelections,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activity
router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    let where: any = {};
    
    // For drivers, only show their own activity
    if (req.user?.role === 'DRIVER') {
      where.userId = req.user.id;
    }
    
    // Get recent audit logs
    const activities = await prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            role: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    
    // Format activities for frontend
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      resource: activity.resource,
      details: activity.details,
      timestamp: activity.timestamp,
      user: activity.user?.employee ? 
        `${activity.user.employee.firstName} ${activity.user.employee.lastName}` : 
        activity.user?.email || 'Unknown User',
      userRole: activity.user?.role || 'Unknown',
    }));
    
    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

export default router;