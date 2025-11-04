import prisma from '../src/utils/database.js';

async function debugAssignments() {
  try {
    console.log('Checking database for assignments...\n');

    // Get all selection periods
    const periods = await prisma.selectionPeriod.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
            selections: true,
          },
        },
      },
    });

    console.log(`Found ${periods.length} selection periods:`);
    periods.forEach(period => {
      console.log(`\nPeriod: ${period.name} (${period.id})`);
      console.log(`  Status: ${period.status}`);
      console.log(`  Assignments: ${period._count.assignments}`);
      console.log(`  Selections: ${period._count.selections}`);
    });

    // Get all assignments
    const assignments = await prisma.assignment.findMany({
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
        route: {
          select: {
            runNumber: true,
          },
        },
        selectionPeriod: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`\n\nTotal assignments in database: ${assignments.length}`);
    
    if (assignments.length > 0) {
      console.log('\nFirst few assignments:');
      assignments.slice(0, 5).forEach((assignment, index) => {
        console.log(`\n${index + 1}. Employee: ${assignment.employee.firstName} ${assignment.employee.lastName} (${assignment.employee.employeeId})`);
        console.log(`   Period: ${assignment.selectionPeriod.name}`);
        console.log(`   Route: ${assignment.route?.runNumber || 'Float Pool'}`);
        console.log(`   Choice: ${assignment.choiceReceived || 'Manual/Float'}`);
      });
    }

    // Check for completed periods without assignments
    const completedPeriodsWithoutAssignments = periods.filter(
      p => p.status === 'COMPLETED' && p._count.assignments === 0
    );

    if (completedPeriodsWithoutAssignments.length > 0) {
      console.log('\n⚠️  WARNING: Found completed periods without assignments:');
      completedPeriodsWithoutAssignments.forEach(p => {
        console.log(`   - ${p.name} (${p.id})`);
      });
    }

  } catch (error) {
    console.error('Error debugging assignments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAssignments();