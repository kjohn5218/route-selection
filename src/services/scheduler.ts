import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import emailService from './email';

const prisma = new PrismaClient();

class SchedulerService {
  private reminderJob: any = null;

  constructor() {
    this.initializeJobs();
  }

  private initializeJobs() {
    // Run daily at 9:00 AM to check for periods ending tomorrow
    this.reminderJob = cron.schedule('0 9 * * *', async () => {
      console.log('Running daily reminder check for selection periods ending tomorrow...');
      await this.sendPeriodEndingReminders();
    });

    console.log('Scheduler service initialized - checking daily at 9:00 AM for periods ending tomorrow');
  }

  async sendPeriodEndingReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Find all active periods that end tomorrow
      const periodsEndingTomorrow = await prisma.selectionPeriod.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: tomorrow,
            lt: dayAfterTomorrow
          }
        }
      });

      console.log(`Found ${periodsEndingTomorrow.length} periods ending tomorrow`);

      for (const period of periodsEndingTomorrow) {
        // Get all qualified drivers who haven't submitted selections yet
        const driversWithoutSelections = await prisma.employee.findMany({
          where: {
            isEligible: true,
            deletedAt: null,
            selections: {
              none: {
                selectionPeriodId: period.id
              }
            }
          }
        });

        console.log(`Sending reminders to ${driversWithoutSelections.length} drivers for period: ${period.name}`);

        // Send reminder to each driver who hasn't made selections
        for (const driver of driversWithoutSelections) {
          if (driver.email) {
            try {
              await emailService.sendSelectionPeriodReminder(
                driver.email,
                `${driver.firstName} ${driver.lastName}`,
                {
                  name: period.name,
                  endDate: period.endDate
                }
              );
              console.log(`Reminder sent to ${driver.firstName} ${driver.lastName} (${driver.email})`);
            } catch (error) {
              console.error(`Failed to send reminder to ${driver.email}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in sendPeriodEndingReminders:', error);
    }
  }

  // Method to manually trigger reminder check (useful for testing)
  async triggerReminderCheck() {
    console.log('Manually triggering reminder check...');
    await this.sendPeriodEndingReminders();
  }

  stop() {
    if (this.reminderJob) {
      this.reminderJob.stop();
      console.log('Scheduler service stopped');
    }
  }
}

// Create and export singleton instance
const schedulerService = new SchedulerService();
export default schedulerService;