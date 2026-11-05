# AcaSchedule Runbook

Runbook for operating and troubleshooting the AcaSchedule platform.

## Table of Contents

1. [Service Architecture](#service-architecture)
2. [Health Checks](#health-checks)
3. [Common Issues](#common-issues)
4. [Rollback Procedure](#rollback-procedure)
5. [Backup & Restore](#backup--restore)
6. [Security Incidents](#security-incidents)

## Service Architecture

| Service | Port | Health Check | Dependencies |
|---------|------|-------------|-------------|
| PostgreSQL | 5432 | `pg_isready` | - |
| Redis | 6379 | `redis-cli ping` | - |
| MinIO | 9000 | `mc ready local` | - |
| AI Service | 8000 | `GET /health` | - |
| Backend API | 8000 | `GET /api/health` | PostgreSQL, Redis, MinIO, AI |
| Frontend | 80 | SPA (nginx) | Backend |
| Nginx | 80 | TCP port 80 | Backend, Frontend |

## Health Checks

All services have Docker healthchecks defined in `docker-compose.yml`:

- **PostgreSQL**: `pg_isready` every 5s
- **Redis**: `redis-cli ping` every 5s
- **MinIO**: `mc ready local` every 10s
- **AI Service**: HTTP GET `/health` every 10s
- **Backend**: `GET /api/health` checks DB, Redis, MinIO

## Common Issues

### Backend returns 503 (degraded)

**Cause**: One or more dependencies (PostgreSQL, Redis, MinIO) is down.

**Diagnosis**:
```bash
curl http://localhost:8000/api/health
```

**Resolution**:
1. Check container status: `docker compose ps`
2. Check logs: `docker compose logs backend`
3. Restart affected service: `docker compose restart <service>`

### AI service returns 502

**Cause**: AI service (Python/FastAPI) is not reachable.

**Diagnosis**:
```bash
curl http://localhost:8001/health
```

**Resolution**:
1. Check AI container: `docker compose logs ai`
2. Restart AI service: `docker compose restart ai`
3. Check `AI_SERVICE_URL` environment variable in backend

### MinIO bucket not found

**Cause**: `documents` bucket does not exist.

**Resolution**:
- The backend auto-creates the bucket on boot via `ensureBucket()`.
- If bucket is missing, restart backend: `docker compose restart backend`

### JWT authentication failures

**Cause**: JWT secrets mismatch or expired tokens.

**Resolution**:
1. Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` match across containers
2. Clear browser localStorage and re-login
3. Check Redis for refresh token rotation issues

## Rollback Procedure

### Rollback application code

1. Identify the previous stable image tag:
   ```bash
   docker images --filter=reference='ghcr.io/*/backend'
   ```

2. Update the image tag in `docker-compose.yml` or override via environment:
   ```bash
   MINIO_PUBLIC_ENDPOINT=localhost docker compose up -d --force-recreate backend
   ```

3. Verify the rollback:
   ```bash
   curl http://localhost:8000/api/health
   ```

### Rollback database migration

Migrations are idempotent and checksum-guarded. If a migration fails:

1. The backend will not start (exit code 1).
2. Fix the migration SQL or revert it.
3. Restart backend: `docker compose restart backend`

**Never manually edit applied migrations** — the checksum verification will detect tampering.

## Backup & Restore

### Backup

Run the backup script:
```bash
./scripts/backup.sh
```

Backups are stored in `/backups/` (or `$BACKUP_DIR` environment variable).

### Restore PostgreSQL

```bash
gunzip -c acaschedule_backup_YYYYMMDD_HHMMSS.sql.gz | \
  PGPASSWORD=acaschedule psql -h localhost -U acaschedule -d acaschedule
```

### Restore MinIO

```bash
mc alias set myminio http://localhost:9000 minioadmin minioadmin
mc mirror --overwrite minio_documents_YYYYMMDD_HHMMSS myminio/documents
```

## Security Incidents

### Suspected JWT token compromise

1. Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`
2. Revoke all refresh tokens:
   ```bash
   docker compose exec backend node -e "
     const { pool } = require('./dist/database/pool');
     pool.query(\"UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL\")
       .then(() => pool.end());
   "
   ```
3. Restart backend: `docker compose restart backend`

### Suspected data breach

1. Take offline snapshot: `docker compose stop`
2. Backup current state: `./scripts/backup.sh`
3. Review access logs in backend logs
4. Rotate all secrets (JWT, MinIO keys, DB passwords)
5. Restore from clean backup if necessary

## Contact

- On-call engineer: @acaschedule-oncall
- Escalation: #infra-slack-channel
