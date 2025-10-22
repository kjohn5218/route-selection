import prisma from './utils/database.js';

async function clearMockData() {
  console.log('🗑️  Clearing mock data from database...');

  try {
    // Delete in correct order to respect foreign key constraints
    
    // First, delete all assignments
    const assignmentsDeleted = await prisma.assignment.deleteMany({});
    console.log(`✅ Deleted ${assignmentsDeleted.count} assignments`);

    // Delete all selections
    const selectionsDeleted = await prisma.selection.deleteMany({});
    console.log(`✅ Deleted ${selectionsDeleted.count} selections`);

    // Delete period routes
    const periodRoutesDeleted = await prisma.periodRoute.deleteMany({});
    console.log(`✅ Deleted ${periodRoutesDeleted.count} period routes`);

    // Delete selection periods
    const periodsDeleted = await prisma.selectionPeriod.deleteMany({});
    console.log(`✅ Deleted ${periodsDeleted.count} selection periods`);

    // Delete audit logs
    const auditLogsDeleted = await prisma.auditLog.deleteMany({});
    console.log(`✅ Deleted ${auditLogsDeleted.count} audit logs`);

    // Delete disqualifications
    const disqualificationsDeleted = await prisma.disqualification.deleteMany({});
    console.log(`✅ Deleted ${disqualificationsDeleted.count} disqualifications`);

    // Delete employees (except admin employee if exists)
    const employeesDeleted = await prisma.employee.deleteMany({
      where: {
        NOT: {
          email: 'admin@routeselection.com'
        }
      }
    });
    console.log(`✅ Deleted ${employeesDeleted.count} employees`);

    // Delete user accounts (except admin)
    const usersDeleted = await prisma.user.deleteMany({
      where: {
        NOT: {
          email: 'admin@routeselection.com'
        }
      }
    });
    console.log(`✅ Deleted ${usersDeleted.count} user accounts`);

    // Delete all routes (including mock routes)
    const routesDeleted = await prisma.route.deleteMany({});
    console.log(`✅ Deleted ${routesDeleted.count} routes`);

    console.log('\n🎉 Mock data cleared successfully!');
    console.log('📋 Admin account preserved: admin@routeselection.com / admin123');
    console.log('\n💡 You can now import your real data through the Import/Export page');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearMockData().catch(console.error);