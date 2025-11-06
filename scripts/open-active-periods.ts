#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function openActivePeriods() {
  try {
    const now = new Date();
    console.log(`🕐 Current time: ${now.toISOString()}`);
    console.log('\n🔍 Checking for periods that should be open based on dates...\n');

    // Find all periods where current date is between start and end date but status is not OPEN
    const periodsToOpen = await prisma.selectionPeriod.findMany({
      where: {
        AND: [
          { startDate: { lte: now } },
          { endDate: { gte: now } },
          { status: { not: 'OPEN' } },
          { status: { not: 'CLOSED' } },
          { status: { not: 'PROCESSING' } },
          { status: { not: 'COMPLETED' } }
        ]
      },
      include: {
        terminal: true
      }
    });

    if (periodsToOpen.length === 0) {
      console.log('✅ No periods need to be opened. All active periods are already open.');
      
      // Show current periods and their status
      const allPeriods = await prisma.selectionPeriod.findMany({
        select: {
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          terminal: {
            select: { name: true }
          }
        },
        orderBy: { startDate: 'asc' }
      });
      
      if (allPeriods.length > 0) {
        console.log('\n📊 Current selection periods:');
        allPeriods.forEach(period => {
          const isActive = now >= period.startDate && now <= period.endDate;
          const dateRange = `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`;
          console.log(`   - ${period.name} (${period.terminal.name}): ${period.status} | ${dateRange} ${isActive ? '⚡ ACTIVE' : ''}`);
        });
      }
      return;
    }

    console.log(`📋 Found ${periodsToOpen.length} period(s) that should be open:`);
    periodsToOpen.forEach(period => {
      console.log(`   - ${period.name} (${period.terminal.name})`);
      console.log(`     Current status: ${period.status}`);
      console.log(`     Date range: ${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`);
    });

    // Update each period to OPEN status
    console.log('\n🔄 Updating period statuses...');
    for (const period of periodsToOpen) {
      await prisma.selectionPeriod.update({
        where: { id: period.id },
        data: { 
          status: 'OPEN',
          updatedAt: new Date()
        }
      });
      console.log(`   ✓ Updated "${period.name}" to OPEN status`);
    }

    console.log('\n✅ Successfully opened all active selection periods!');

    // Also check for periods that should be closed
    const periodsToClose = await prisma.selectionPeriod.findMany({
      where: {
        AND: [
          { endDate: { lt: now } },
          { status: 'OPEN' }
        ]
      }
    });

    if (periodsToClose.length > 0) {
      console.log(`\n⚠️  Found ${periodsToClose.length} period(s) that should be closed:`);
      periodsToClose.forEach(period => {
        console.log(`   - ${period.name} (ended ${period.endDate.toLocaleDateString()})`);
      });
      console.log('   Run "npm run db:close-expired-periods" to close these periods.');
    }

  } catch (error) {
    console.error('❌ Error updating period statuses:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
openActivePeriods();