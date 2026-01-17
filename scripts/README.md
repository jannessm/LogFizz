# PostgreSQL Backup Scripts

This directory contains scripts for backing up and restoring the PostgreSQL database used by the Clock application.

## Overview

The backup system provides:
- **Daily backups**: Automatically creates a backup each time the script is run
- **Monthly backups**: Creates a monthly backup on the 1st of each month
- **Automatic retention**: Keeps the last 14 daily backups and last 3 monthly backups
- **Compression**: All backups are gzip-compressed to save space
- **Logging**: Maintains a backup log file for audit purposes

## Files

- `backup-postgres.sh` - Main backup script
- `restore-postgres.sh` - Database restore script
- `README.md` - This documentation file

## Setup

### 1. Prerequisites

- Docker and Docker Compose installed
- PostgreSQL container running (`clock-postgres`)
- Sufficient disk space for backups

### 2. Create Backup Directory

The scripts will automatically create the necessary directory structure, but you can pre-create it:

```bash
mkdir -p backups/daily
mkdir -p backups/monthly
```

## Usage

### Running a Backup

Run the backup script manually:

```bash
# From the repository root
./scripts/backup-postgres.sh

# Or specify a custom backup directory
./scripts/backup-postgres.sh /path/to/backup/directory
```

The default backup location is `./backups` relative to where you run the script.

### Automated Backups with Cron

To run backups automatically, add a cron job:

```bash
# Edit crontab
crontab -e

# Add one of these lines:

# Daily at 2:00 AM
0 2 * * * cd /path/to/TapShift && ./scripts/backup-postgres.sh >> backups/cron.log 2>&1

# Every 12 hours
0 */12 * * * cd /path/to/TapShift && ./scripts/backup-postgres.sh >> backups/cron.log 2>&1

# Every 6 hours
0 */6 * * * cd /path/to/TapShift && ./scripts/backup-postgres.sh >> backups/cron.log 2>&1
```

**Important**: Make sure to use absolute paths in your cron job.

### Restoring from a Backup

To restore the database from a backup:

```bash
# List available backups
ls -lh backups/daily/
ls -lh backups/monthly/

# Restore from a specific backup file
./scripts/restore-postgres.sh backups/daily/backup_20240112_120000.sql.gz
```

**Warning**: Restoring will replace all current data in the database. The script will:
1. Ask for confirmation before proceeding
2. Create a temporary backup of the current database
3. Drop and recreate the database
4. Restore from the specified backup file

## Backup Structure

```
backups/
├── daily/
│   ├── backup_20240112_120000.sql.gz
│   ├── backup_20240113_120000.sql.gz
│   └── ... (up to 14 daily backups)
├── monthly/
│   ├── backup_monthly_202401.sql.gz
│   ├── backup_monthly_202402.sql.gz
│   └── ... (up to 3 monthly backups)
└── backup.log
```

## Retention Policy

- **Daily backups**: Last 14 days are retained
- **Monthly backups**: Last 3 months are retained
- Older backups are automatically deleted when the script runs

## Monitoring

Check the backup log to monitor backup operations:

```bash
tail -f backups/backup.log
```

## Backup Outside Container

All backups are stored on the host filesystem (outside the Docker container), ensuring:
- Backups survive container restarts
- Backups can be easily copied to remote storage
- Data is protected from container failures

## Recommended Practices

1. **Store backups on a separate drive or remote location**: For disaster recovery, copy backups to a different physical location or cloud storage.

2. **Test restores regularly**: Periodically test the restore process to ensure backups are valid.

3. **Monitor disk space**: Ensure sufficient disk space is available for backups.

4. **Set up alerts**: Configure monitoring to alert you if backups fail.

## Troubleshooting

### Container not running
If you get an error that the container is not running:
```bash
docker ps | grep clock-postgres
docker-compose up -d postgres
```

### Permission denied
If you get permission errors:
```bash
chmod +x scripts/backup-postgres.sh
chmod +x scripts/restore-postgres.sh
```

### Disk space issues
Check disk space:
```bash
df -h
du -sh backups/
```

### Restore fails
The restore script creates a temporary backup before attempting to restore. If the restore fails, you can find the temporary backup at `/tmp/pre_restore_backup_TIMESTAMP.sql.gz`.

## Environment Variables

The scripts use these default values from `docker-compose.yml`:
- Container name: `clock-postgres` (override with `POSTGRES_CONTAINER`)
- Database: `clock_db` (override with `POSTGRES_DB`)
- User: `clock_user` (override with `POSTGRES_USER`)

You can customize these values using environment variables:

```bash
# Using environment variables
export POSTGRES_CONTAINER=my-postgres
export POSTGRES_DB=my_database
export POSTGRES_USER=my_user
./scripts/backup-postgres.sh

# Or inline
POSTGRES_CONTAINER=my-postgres ./scripts/backup-postgres.sh
```

**Note**: Passwords are not needed as the scripts use `docker exec` which authenticates via container access permissions.

## Security Notes

- The backup files contain sensitive data - protect them appropriately
- Ensure proper file permissions on backup directories
- Consider encrypting backups for production environments
- Don't commit backup files to version control (they're in `.gitignore`)
