import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './utils/database.js';
import { FileProcessor } from './utils/fileProcessor.js';
import { hashPassword } from './utils/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importData() {
  console.log('📥 Starting data import...\n');

  try {
    // Import Routes
    console.log('📍 Importing routes...');
    const routesFile = path.join(__dirname, '../sample-routes-full.csv');
    const routesBuffer = fs.readFileSync(routesFile);
    
    const routesResult = await FileProcessor.processRouteFile(routesBuffer, 'sample-routes-full.csv');
    
    if (routesResult.success) {
      console.log(`✅ Validated ${routesResult.data.length} routes`);
      
      let routesImported = 0;
      for (const route of routesResult.data) {
        try {
          await prisma.route.create({
            data: route
          });
          routesImported++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`⚠️  Route ${route.runNumber} already exists, skipping...`);
          } else {
            console.error(`❌ Error importing route ${route.runNumber}:`, error);
          }
        }
      }
      console.log(`✅ Imported ${routesImported} new routes\n`);
    } else {
      console.log('❌ Route validation errors:');
      routesResult.errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.field ? `${err.field} - ` : ''}${err.message}`);
      });
    }

    // Import Employees
    console.log('👥 Importing employees...');
    const employeesFile = path.join(__dirname, '../sample-employees-full.csv');
    const employeesBuffer = fs.readFileSync(employeesFile);
    
    const employeesResult = await FileProcessor.processEmployeeFile(employeesBuffer, 'sample-employees-full.csv');
    
    if (employeesResult.success) {
      console.log(`✅ Validated ${employeesResult.data.length} employees`);
      
      let employeesImported = 0;
      let usersCreated = 0;
      
      for (const employee of employeesResult.data) {
        try {
          // Create user account first
          const existingUser = await prisma.user.findUnique({
            where: { email: employee.email }
          });

          if (!existingUser) {
            const defaultPassword = await hashPassword('driver123');
            await prisma.user.create({
              data: {
                email: employee.email,
                password: defaultPassword,
                role: 'DRIVER',
              }
            });
            usersCreated++;
          }

          // Create employee
          await prisma.employee.create({
            data: employee
          });
          employeesImported++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`⚠️  Employee ${employee.employeeId} already exists, skipping...`);
          } else {
            console.error(`❌ Error importing employee ${employee.employeeId}:`, error);
          }
        }
      }
      console.log(`✅ Imported ${employeesImported} new employees`);
      console.log(`✅ Created ${usersCreated} user accounts (password: driver123)\n`);
    } else {
      console.log('❌ Employee validation errors:');
      employeesResult.errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.field ? `${err.field} - ` : ''}${err.message}`);
      });
    }

    // Show summary
    const totalRoutes = await prisma.route.count();
    const totalEmployees = await prisma.employee.count();
    
    console.log('📊 Import Summary:');
    console.log(`   Total routes in database: ${totalRoutes}`);
    console.log(`   Total employees in database: ${totalEmployees}`);
    console.log('\n🎉 Data import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importData().catch(console.error);