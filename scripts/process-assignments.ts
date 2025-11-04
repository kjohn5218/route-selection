import { AssignmentEngine } from '../src/services/assignmentEngine.js';
import prisma from '../src/utils/database.js';

async function processAssignments() {
  const periodId = 'cmhkod0td0001abiy00cqcdyu';
  
  try {
    console.log('Starting assignment processing...\n');
    
    // Check period status
    const period = await prisma.selectionPeriod.findUnique({
      where: { id: periodId },
      include: {
        _count: {
          select: {
            selections: true,
            routes: true,
          },
        },
      },
    });
    
    if (!period) {
      throw new Error('Period not found');
    }
    
    console.log(`Period: ${period.name}`);
    console.log(`Status: ${period.status}`);
    console.log(`Selections: ${period._count.selections}`);
    console.log(`Routes available: ${period._count.routes}`);
    
    if (period.status !== 'OPEN') {
      throw new Error(`Period status must be OPEN, current status: ${period.status}`);
    }
    
    // Update status to processing
    await prisma.selectionPeriod.update({
      where: { id: periodId },
      data: { status: 'PROCESSING' },
    });
    
    console.log('\nProcessing assignments...');
    const engine = new AssignmentEngine();
    const assignments = await engine.processAssignments(periodId);
    
    console.log(`\nGenerated ${assignments.length} assignments`);
    
    // Validate assignments
    const validation = engine.validateAssignments();
    if (!validation.isValid) {
      console.error('Validation failed:', validation.errors);
      throw new Error('Assignment validation failed');
    }
    
    const summary = engine.getAssignmentSummary();
    console.log('\nAssignment Summary:');
    console.log(`  Total Employees: ${summary.totalEmployees}`);
    console.log(`  Assigned Routes: ${summary.assignedRoutes}`);
    console.log(`  Float Pool: ${summary.floatPoolEmployees}`);
    console.log(`  First Choice: ${summary.firstChoice}`);
    console.log(`  Second Choice: ${summary.secondChoice}`);
    console.log(`  Third Choice: ${summary.thirdChoice}`);
    
    // Save assignments
    console.log('\nSaving assignments to database...');
    await engine.saveAssignments(periodId);
    
    // Update period status to completed
    await prisma.selectionPeriod.update({
      where: { id: periodId },
      data: { status: 'COMPLETED' },
    });
    
    console.log('\n✅ Assignment processing completed successfully!');
    
    // Show first few assignments
    const savedAssignments = await prisma.assignment.findMany({
      where: { selectionPeriodId: periodId },
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
      },
      take: 5,
    });
    
    console.log('\nFirst few assignments:');
    savedAssignments.forEach((assignment, index) => {
      console.log(`${index + 1}. ${assignment.employee.firstName} ${assignment.employee.lastName} (${assignment.employee.employeeId})`);
      console.log(`   Route: ${assignment.route?.runNumber || 'Float Pool'}`);
      console.log(`   Choice: ${assignment.choiceReceived || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error processing assignments:', error);
    
    // Reset status back to OPEN on error
    await prisma.selectionPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN' },
    }).catch(console.error);
    
  } finally {
    await prisma.$disconnect();
  }
}

processAssignments();