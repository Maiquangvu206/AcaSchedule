#!/bin/bash
# Backup script for AcaSchedule
# Backs up PostgreSQL database and MinIO data

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-acaschedule}"
DB_NAME="${POSTGRES_DB:-acaschedule}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="acaschedule_backup_${TIMESTAMP}.sql.gz"
MINIO_BACKUP="acaschedule_minio_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# Backup PostgreSQL
echo "[$(date)] Backing up PostgreSQL database: ${DB_NAME}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

echo "[$(date)] Database backup saved: ${BACKUP_DIR}/${BACKUP_FILE}"

# Backup MinIO data (if mc is available)
if command -v mc &> /dev/null; then
  echo "[$(date)] Backing up MinIO bucket: ${MINIO_BUCKET}"
  mc alias set myminio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"
  mc mirror --download "myminio/documents" "${BACKUP_DIR}/minio_documents_${TIMESTAMP}" || true
  tar -czf "${BACKUP_DIR}/${MINIO_BACKUP}" -C "${BACKUP_DIR}" "minio_documents_${TIMESTAMP}" || true
  rm -rf "${BACKUP_DIR}/minio_documents_${TIMESTAMP}"
  echo "[$(date)] MinIO backup saved: ${BACKUP_DIR}/${MINIO_BACKUP}"
else
  echo "[$(date)] mc not found, skipping MinIO backup"
fi

# Rotate old backups (keep last 7 days)
echo "[$(date)] Rotating old backups (keeping last 7 days)..."
find "${BACKUP_DIR}" -name "acaschedule_backup_*.sql.gz" -mtime +7 -delete
find "${BACKUP_DIR}" -name "acaschedule_minio_*.tar.gz" -mtime +7 -delete

echo "[$(date)] Backup complete."
