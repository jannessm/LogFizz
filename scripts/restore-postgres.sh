#!/bin/bash

# PostgreSQL Restore Script
# This script restores a PostgreSQL database from a backup file
# Usage: ./restore-postgres.sh <backup_file>

set -e  # Exit on error

# Configuration
CONTAINER_NAME="clock-postgres"
DB_NAME="clock_db"
DB_USER="clock_user"
DB_PASSWORD="clock_password"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    error "No backup file specified!"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Examples:"
    echo "  $0 backups/daily/backup_20240112_120000.sql.gz"
    echo "  $0 backups/monthly/backup_monthly_202401.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    error "Backup file '${BACKUP_FILE}' not found!"
    exit 1
fi

log "Starting PostgreSQL restore process..."
log "Backup file: ${BACKUP_FILE}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "PostgreSQL container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Confirm restore operation
warning "WARNING: This will replace all data in the database '${DB_NAME}'!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "${confirm}" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Create a temporary backup before restore
TEMP_BACKUP="/tmp/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
log "Creating temporary backup before restore: ${TEMP_BACKUP}"
if docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${TEMP_BACKUP}"; then
    success "Temporary backup created"
else
    error "Failed to create temporary backup!"
    exit 1
fi

# Drop and recreate database
log "Dropping and recreating database..."
if docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DB_NAME};" postgres && \
   docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};" postgres; then
    success "Database recreated"
else
    error "Failed to recreate database!"
    warning "You may need to restore from temporary backup: ${TEMP_BACKUP}"
    exit 1
fi

# Restore from backup
log "Restoring database from backup..."
if gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" "${DB_NAME}"; then
    success "Database restored successfully!"
    log "Temporary backup saved at: ${TEMP_BACKUP}"
    log "You can delete it once you verify the restore was successful"
else
    error "Failed to restore database!"
    warning "Restoring from temporary backup..."
    
    # Attempt to restore from temporary backup
    if gunzip -c "${TEMP_BACKUP}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" "${DB_NAME}"; then
        success "Database restored from temporary backup"
    else
        error "Failed to restore from temporary backup!"
        error "Database may be in an inconsistent state!"
    fi
    exit 1
fi

log "Restore process completed successfully!"
