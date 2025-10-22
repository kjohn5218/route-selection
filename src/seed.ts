import prisma from './utils/database.js';
import { hashPassword } from './utils/auth.js';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create admin user
    const adminPassword = await hashPassword('admin123');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@routeselection.com' },
      update: {},
      create: {
        email: 'admin@routeselection.com',
        password: adminPassword,
        role: 'ADMIN',
      },
    });
    console.log('✅ Created admin user');

    // Create sample routes
    const routes = [
      {
        runNumber: 'R001',
        type: 'SINGLES',
        origin: 'Seattle Terminal',
        destination: 'Tacoma Warehouse',
        days: 'Mon-Fri',
        startTime: '06:00',
        endTime: '14:00',
        distance: 45.5,
        rateType: 'HOURLY',
        workTime: 8.0,
        requiresDoublesEndorsement: false,
        requiresChainExperience: false,
      },
      {
        runNumber: 'R002',
        type: 'DOUBLES',
        origin: 'Seattle Terminal',
        destination: 'Portland Hub',
        days: 'Mon-Fri',
        startTime: '05:00',
        endTime: '17:00',
        distance: 173.2,
        rateType: 'MILEAGE',
        workTime: 12.0,
        requiresDoublesEndorsement: true,
        requiresChainExperience: true,
      },
      {
        runNumber: 'R003',
        type: 'DOUBLES',
        origin: 'Seattle Terminal',
        destination: 'Los Angeles Distribution',
        days: 'Mon-Thu',
        startTime: '04:00',
        endTime: '20:00',
        distance: 1135.8,
        rateType: 'MILEAGE',
        workTime: 16.0,
        requiresDoublesEndorsement: true,
        requiresChainExperience: false,
      },
      {
        runNumber: 'R004',
        type: 'SINGLES',
        origin: 'Spokane Terminal',
        destination: 'Coeur d\'Alene Store',
        days: 'Tue-Sat',
        startTime: '07:00',
        endTime: '15:00',
        distance: 33.1,
        rateType: 'HOURLY',
        workTime: 8.0,
        requiresDoublesEndorsement: false,
        requiresChainExperience: true,
      },
      {
        runNumber: 'R005',
        type: 'SINGLES',
        origin: 'Bellevue Customer Site',
        destination: 'Various Locations',
        days: 'Mon-Fri',
        startTime: '08:00',
        endTime: '16:00',
        distance: 89.3,
        rateType: 'FLAT_RATE',
        workTime: 8.0,
        requiresDoublesEndorsement: false,
        requiresChainExperience: false,
      },
    ];

    for (const route of routes) {
      await prisma.route.upsert({
        where: { runNumber: route.runNumber },
        update: {},
        create: route,
      });
    }
    console.log('✅ Created sample routes');

    // Create sample employees
    const employees = [
      {
        employeeId: 'EMP001',
        firstName: 'John',
        lastName: 'Anderson',
        email: 'john.anderson@company.com',
        phone: '206-555-0101',
        hireDate: new Date('2018-03-15'),
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
      {
        employeeId: 'EMP002',
        firstName: 'Sarah',
        lastName: 'Brown',
        email: 'sarah.brown@company.com',
        phone: '206-555-0102',
        hireDate: new Date('2019-07-22'),
        doublesEndorsement: false,
        chainExperience: true,
        isEligible: true,
      },
      {
        employeeId: 'EMP003',
        firstName: 'Michael',
        lastName: 'Davis',
        email: 'michael.davis@company.com',
        phone: '206-555-0103',
        hireDate: new Date('2020-01-08'),
        doublesEndorsement: true,
        chainExperience: false,
        isEligible: true,
      },
      {
        employeeId: 'EMP004',
        firstName: 'Lisa',
        lastName: 'Johnson',
        email: 'lisa.johnson@company.com',
        phone: '206-555-0104',
        hireDate: new Date('2021-05-12'),
        doublesEndorsement: false,
        chainExperience: false,
        isEligible: true,
      },
      {
        employeeId: 'EMP005',
        firstName: 'Robert',
        lastName: 'Wilson',
        email: 'robert.wilson@company.com',
        phone: '206-555-0105',
        hireDate: new Date('2017-11-03'),
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
    ];

    for (const employee of employees) {
      // Create driver user account first
      const driverPassword = await hashPassword('driver123');
      await prisma.user.upsert({
        where: { email: employee.email },
        update: {},
        create: {
          email: employee.email,
          password: driverPassword,
          role: 'DRIVER',
        },
      });

      // Then create employee
      await prisma.employee.upsert({
        where: { employeeId: employee.employeeId },
        update: {},
        create: employee,
      });
    }
    console.log('✅ Created sample employees and driver accounts');

    // Create a sample selection period
    const existingPeriod = await prisma.selectionPeriod.findFirst({
      where: { name: 'Fall 2024 Route Selection' },
    });

    if (!existingPeriod) {
      await prisma.selectionPeriod.create({
        data: {
          name: 'Fall 2024 Route Selection',
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-10-15'),
          status: 'UPCOMING',
        },
      });
    }
    console.log('✅ Created sample selection period');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample accounts created:');
    console.log('🔑 Admin: admin@routeselection.com / admin123');
    console.log('👨‍💼 Drivers: [employee-email] / driver123');
    console.log('   - john.anderson@company.com');
    console.log('   - sarah.brown@company.com');
    console.log('   - michael.davis@company.com');
    console.log('   - lisa.johnson@company.com');
    console.log('   - robert.wilson@company.com');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seed;