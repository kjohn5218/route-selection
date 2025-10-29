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
    if (req.user?.role !== 'Driver') {
      totalEmployees = await prisma.employee.count();
    }

    // Get total routes
    const totalRoutes = await prisma.route.count();

    // Get active period
    const activePeriod = await prisma.selectionPeriod.findFirst({
      where: {
        status: 'Active',
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
      if (req.user?.role === 'Driver') {
        // For drivers, only show their own selections
        const selections = await prisma.selection.findMany({
          where: {
            periodId: activePeriod.id,
            employeeId: req.user.employeeId || '',
          },
        });
        
        pendingSelections = selections.filter(s => s.status === 'Pending').length;
        completedSelections = selections.filter(s => s.status === 'Confirmed').length;
      } else {
        // For admin/manager, show all selections
        const selectionCounts = await prisma.selection.groupBy({
          by: ['status'],
          where: {
            periodId: activePeriod.id,
          },
          _count: true,
        });

        selectionCounts.forEach(count => {
          if (count.status === 'Pending') {
            pendingSelections = count._count;
          } else if (count.status === 'Confirmed') {
            completedSelections = count._count;
          }
        });
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
            name: true,
            role: true,
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
      user: activity.user?.name || 'Unknown User',
      userRole: activity.user?.role || 'Unknown',
    }));
    
    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

export default router;