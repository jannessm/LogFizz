#!/bin/bash

# PostgreSQL Backup Script
# This script creates daily and monthly backups of PostgreSQL database
# Retention: Last 14 daily backups + Last 3 monthly backups
# Usage: ./backup-postgres.sh [backup_dir]

set -e  # Exit on error

# Configuration
BACKUP_DIR="${1:-./backups}"
DAILY_DIR="${BACKUP_DIR}/daily"
MONTHLY_DIR="${BACKUP_DIR}/monthly"
# Read from environment variables or use defaults from docker-compose.yml
CONTAINER_NAME="${POSTGRES_CONTAINER:-clock-postgres}"
DB_NAME="${POSTGRES_DB:-clock_db}"
DB_USER="${POSTGRES_USER:-clock_user}"
# Note: Password is not needed as we use docker exec (authenticated by container access)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
DAY_OF_MONTH=$(date +%d)
LOG_FILE="${BACKUP_DIR}/backup.log"

# Retention policies
DAILY_RETENTION=14   # Keep last 14 daily backups
MONTHLY_RETENTION=3  # Keep last 3 monthly backups

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

# Create backup directories
mkdir -p "${DAILY_DIR}"
mkdir -p "${MONTHLY_DIR}"

log "Starting PostgreSQL backup process..."
log "Backup directory: ${BACKUP_DIR}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error "PostgreSQL container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Perform daily backup
DAILY_BACKUP_FILE="${DAILY_DIR}/backup_${DATE_ONLY}_${TIMESTAMP}.sql.gz"
log "Creating daily backup: ${DAILY_BACKUP_FILE}"

if docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${DAILY_BACKUP_FILE}" | cut -f1)
    success "Daily backup created successfully (Size: ${BACKUP_SIZE})"
else
    error "Failed to create daily backup!"
    exit 1
fi

# Create monthly backup on the 1st of each month
if [ "${DAY_OF_MONTH}" = "01" ]; then
    MONTH_YEAR=$(date +%Y%m)
    MONTHLY_BACKUP_FILE="${MONTHLY_DIR}/backup_monthly_${MONTH_YEAR}.sql.gz"
    log "Creating monthly backup: ${MONTHLY_BACKUP_FILE}"
    
    # Copy the daily backup to monthly (or create a new one)
    if cp "${DAILY_BACKUP_FILE}" "${MONTHLY_BACKUP_FILE}"; then
        MONTHLY_SIZE=$(du -h "${MONTHLY_BACKUP_FILE}" | cut -f1)
        success "Monthly backup created successfully (Size: ${MONTHLY_SIZE})"
    else
        error "Failed to create monthly backup!"
    fi
fi

# Clean up old daily backups (keep last DAILY_RETENTION)
log "Cleaning up old daily backups (keeping last ${DAILY_RETENTION})..."
DAILY_COUNT=$(find "${DAILY_DIR}" -name "backup_*.sql.gz" -type f | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETENTION}" ]; then
    REMOVE_COUNT=$((DAILY_COUNT - DAILY_RETENTION))
    # Use ls -t for portability across different systems (macOS, Linux, BSD)
    ls -t "${DAILY_DIR}"/backup_*.sql.gz | tail -n "${REMOVE_COUNT}" | while read -r file; do
        log "Removing old daily backup: $(basename "${file}")"
        rm -f "${file}"
    done
    success "Removed ${REMOVE_COUNT} old daily backup(s)"
else
    log "No daily backups to remove (current count: ${DAILY_COUNT})"
fi

# Clean up old monthly backups (keep last MONTHLY_RETENTION)
log "Cleaning up old monthly backups (keeping last ${MONTHLY_RETENTION})..."
MONTHLY_COUNT=$(find "${MONTHLY_DIR}" -name "backup_monthly_*.sql.gz" -type f | wc -l)
if [ "${MONTHLY_COUNT}" -gt "${MONTHLY_RETENTION}" ]; then
    REMOVE_COUNT=$((MONTHLY_COUNT - MONTHLY_RETENTION))
    # Use ls -t for portability across different systems (macOS, Linux, BSD)
    ls -t "${MONTHLY_DIR}"/backup_monthly_*.sql.gz | tail -n "${REMOVE_COUNT}" | while read -r file; do
        log "Removing old monthly backup: $(basename "${file}")"
        rm -f "${file}"
    done
    success "Removed ${REMOVE_COUNT} old monthly backup(s)"
else
    log "No monthly backups to remove (current count: ${MONTHLY_COUNT})"
fi

# Summary
log "=== Backup Summary ==="
log "Daily backups: $(find "${DAILY_DIR}" -name "backup_*.sql.gz" -type f | wc -l)"
log "Monthly backups: $(find "${MONTHLY_DIR}" -name "backup_monthly_*.sql.gz" -type f | wc -l)"
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log "Total backup size: ${TOTAL_SIZE}"
success "Backup process completed successfully!"
