#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearSelectionPeriods() {
  try {
    console.log('🔍 Finding completed and upcoming selection periods...');
    
    // Find all selection periods with status COMPLETED or UPCOMING
    const periodsToDelete = await prisma.selectionPeriod.findMany({
      where: {
        OR: [
          { status: 'COMPLETED' },
          { status: 'UPCOMING' }
        ]
      },
      select: {
        id: true,
        name: true,
        status: true,
        _count: {
          select: {
            selections: true,
            assignments: true
          }
        }
      }
    });

    if (periodsToDelete.length === 0) {
      console.log('✅ No completed or upcoming selection periods found.');
      return;
    }

    console.log(`\n📋 Found ${periodsToDelete.length} selection periods to delete:`);
    periodsToDelete.forEach(period => {
      console.log(`   - ${period.name} (${period.status}) - ${period._count.selections} selections, ${period._count.assignments} assignments`);
    });

    console.log('\n🗑️  Deleting related data...');

    // Delete in the correct order to respect foreign key constraints
    for (const period of periodsToDelete) {
      console.log(`\n   Processing: ${period.name}`);
      
      // Delete assignments first
      const deletedAssignments = await prisma.assignment.deleteMany({
        where: { selectionPeriodId: period.id }
      });
      if (deletedAssignments.count > 0) {
        console.log(`   ✓ Deleted ${deletedAssignments.count} assignments`);
      }

      // Delete selections
      const deletedSelections = await prisma.selection.deleteMany({
        where: { selectionPeriodId: period.id }
      });
      if (deletedSelections.count > 0) {
        console.log(`   ✓ Deleted ${deletedSelections.count} selections`);
      }

      // Delete period routes
      const deletedPeriodRoutes = await prisma.periodRoute.deleteMany({
        where: { selectionPeriodId: period.id }
      });
      if (deletedPeriodRoutes.count > 0) {
        console.log(`   ✓ Deleted ${deletedPeriodRoutes.count} period routes`);
      }

      // Finally delete the selection period
      await prisma.selectionPeriod.delete({
        where: { id: period.id }
      });
      console.log(`   ✓ Deleted selection period: ${period.name}`);
    }

    console.log('\n✅ Successfully cleared all completed and upcoming selection periods!');
    
    // Show remaining periods
    const remainingPeriods = await prisma.selectionPeriod.findMany({
      select: {
        name: true,
        status: true
      }
    });
    
    if (remainingPeriods.length > 0) {
      console.log('\n📊 Remaining selection periods:');
      remainingPeriods.forEach(period => {
        console.log(`   - ${period.name} (${period.status})`);
      });
    } else {
      console.log('\n📊 No selection periods remaining in the system.');
    }

  } catch (error) {
    console.error('❌ Error clearing selection periods:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearSelectionPeriods();