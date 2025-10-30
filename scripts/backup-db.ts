import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(process.cwd(), 'backups');
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('✅ Created backups directory');
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found at:', dbPath);
      process.exit(1);
    }

    // Create backup using SQLite's backup command
    console.log('🔄 Creating database backup...');
    await execAsync(`sqlite3 "${dbPath}" ".backup '${backupPath}'"`);
    
    // Verify backup was created
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      console.log(`✅ Backup created successfully: ${backupPath}`);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // List recent backups
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .sort()
        .reverse()
        .slice(0, 5);
      
      console.log('\n📁 Recent backups:');
      backups.forEach(backup => {
        const backupStats = fs.statSync(path.join(backupDir, backup));
        console.log(`   - ${backup} (${(backupStats.size / 1024 / 1024).toFixed(2)} MB)`);
      });
      
      // Clean up old backups (keep last 10)
      const allBackups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
        .sort();
      
      if (allBackups.length > 10) {
        const toDelete = allBackups.slice(0, allBackups.length - 10);
        console.log(`\n🧹 Cleaning up ${toDelete.length} old backup(s)...`);
        toDelete.forEach(oldBackup => {
          fs.unlinkSync(path.join(backupDir, oldBackup));
          console.log(`   - Deleted: ${oldBackup}`);
        });
      }
    } else {
      console.error('❌ Backup failed - file not created');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
backupDatabase();