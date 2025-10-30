import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function restoreDatabase() {
  const backupDir = path.join(process.cwd(), 'backups');
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

  try {
    // Check if backups directory exists
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No backups directory found');
      process.exit(1);
    }

    // List available backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      console.error('❌ No backup files found');
      process.exit(1);
    }

    console.log('📁 Available backups:\n');
    backups.forEach((backup, index) => {
      const backupPath = path.join(backupDir, backup);
      const stats = fs.statSync(backupPath);
      const date = backup.replace('backup-', '').replace('.db', '').replace(/T/g, ' ').replace(/-/g, ':');
      console.log(`${index + 1}. ${date} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    });

    const answer = await question('\nEnter backup number to restore (or q to quit): ');
    
    if (answer.toLowerCase() === 'q') {
      console.log('Restore cancelled');
      rl.close();
      return;
    }

    const backupIndex = parseInt(answer) - 1;
    if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backups.length) {
      console.error('❌ Invalid selection');
      rl.close();
      process.exit(1);
    }

    const selectedBackup = backups[backupIndex];
    const backupPath = path.join(backupDir, selectedBackup);

    // Create a backup of current database before restoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const currentBackupPath = path.join(backupDir, `pre-restore-${timestamp}.db`);
    
    if (fs.existsSync(dbPath)) {
      console.log('\n🔄 Backing up current database before restore...');
      await execAsync(`sqlite3 "${dbPath}" ".backup '${currentBackupPath}'"`);
      console.log('✅ Current database backed up');
    }

    // Restore the selected backup
    console.log(`\n🔄 Restoring from ${selectedBackup}...`);
    await execAsync(`sqlite3 "${dbPath}" ".restore '${backupPath}'"`);
    
    console.log('✅ Database restored successfully!');
    console.log('\n⚠️  Remember to restart your server for changes to take effect');

    rl.close();
  } catch (error) {
    console.error('❌ Restore failed:', error);
    rl.close();
    process.exit(1);
  }
}

// Run restore
restoreDatabase();