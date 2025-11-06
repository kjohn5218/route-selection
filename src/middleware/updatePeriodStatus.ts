import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to automatically update selection period statuses based on dates
 * This runs before handling period-related requests
 */
export async function updatePeriodStatusMiddleware(req: any, res: any, next: any) {
  try {
    const now = new Date();
    
    // Update UPCOMING periods that should be OPEN
    const openedPeriods = await prisma.selectionPeriod.updateMany({
      where: {
        AND: [
          { status: 'UPCOMING' },
          { startDate: { lte: now } },
          { endDate: { gte: now } }
        ]
      },
      data: {
        status: 'OPEN',
        updatedAt: now
      }
    });
    
    if (openedPeriods.count > 0) {
      console.log(`Auto-opened ${openedPeriods.count} selection period(s)`);
    }
    
    // Update OPEN periods that should be CLOSED
    const closedPeriods = await prisma.selectionPeriod.updateMany({
      where: {
        AND: [
          { status: 'OPEN' },
          { endDate: { lt: now } }
        ]
      },
      data: {
        status: 'CLOSED',
        updatedAt: now
      }
    });
    
    if (closedPeriods.count > 0) {
      console.log(`Auto-closed ${closedPeriods.count} selection period(s)`);
    }
    
    next();
  } catch (error) {
    console.error('Error updating period statuses:', error);
    // Don't fail the request if status update fails
    next();
  }
}