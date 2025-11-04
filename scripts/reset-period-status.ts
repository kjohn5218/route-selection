import prisma from '../src/utils/database.js';

async function resetPeriodStatus() {
  try {
    const periodId = 'cmhkod0td0001abiy00cqcdyu';
    
    console.log('Resetting period status to OPEN...');
    
    const period = await prisma.selectionPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN' },
    });
    
    console.log(`Period "${period.name}" status reset to: ${period.status}`);
    
    // Check selections count
    const selectionsCount = await prisma.selection.count({
      where: { selectionPeriodId: periodId },
    });
    
    console.log(`Period has ${selectionsCount} selections ready for processing`);
    
  } catch (error) {
    console.error('Error resetting period status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPeriodStatus();