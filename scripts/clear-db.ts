import prisma from '../src/utils/database.js';

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');

  try {
    // Delete in correct order to respect foreign key constraints
    
    console.log('Deleting audit logs...');
    const auditLogs = await prisma.auditLog.deleteMany();
    console.log(`✅ Deleted ${auditLogs.count} audit logs`);

    console.log('Deleting password reset tokens...');
    const passwordResetTokens = await prisma.passwordResetToken.deleteMany();
    console.log(`✅ Deleted ${passwordResetTokens.count} password reset tokens`);

    console.log('Deleting assignments...');
    const assignments = await prisma.assignment.deleteMany();
    console.log(`✅ Deleted ${assignments.count} assignments`);

    console.log('Deleting selections...');
    const selections = await prisma.selection.deleteMany();
    console.log(`✅ Deleted ${selections.count} selections`);

    console.log('Deleting disqualifications...');
    const disqualifications = await prisma.disqualification.deleteMany();
    console.log(`✅ Deleted ${disqualifications.count} disqualifications`);

    console.log('Deleting period routes...');
    const periodRoutes = await prisma.periodRoute.deleteMany();
    console.log(`✅ Deleted ${periodRoutes.count} period routes`);

    console.log('Deleting selection periods...');
    const periods = await prisma.selectionPeriod.deleteMany();
    console.log(`✅ Deleted ${periods.count} selection periods`);

    console.log('Deleting employees...');
    const employees = await prisma.employee.deleteMany();
    console.log(`✅ Deleted ${employees.count} employees`);

    console.log('Deleting routes...');
    const routes = await prisma.route.deleteMany();
    console.log(`✅ Deleted ${routes.count} routes`);

    console.log('Deleting users (except admin)...');
    const users = await prisma.user.deleteMany({
      where: {
        email: {
          not: 'admin@routeselection.com'
        }
      }
    });
    console.log(`✅ Deleted ${users.count} users (kept admin)`);

    console.log('\n✅ Database cleared successfully!');
    console.log('ℹ️  Admin account preserved: admin@routeselection.com / admin123');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
clearDatabase();