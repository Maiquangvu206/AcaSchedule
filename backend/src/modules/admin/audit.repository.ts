import { pool } from '../../database/pool';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(entry: AuditEntry): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, action, method, path, status_code, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.userId ?? null,
      entry.action,
      entry.method ?? null,
      entry.path ?? null,
      entry.statusCode ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.metadata ?? {},
    ],
  );
}

export async function listAuditLogs(limit = 100) {
  const result = await pool.query(
    `SELECT a.id, a.action, a.method, a.path, a.status_code, a.ip_address,
            a.user_agent, a.metadata, a.created_at, a.user_id,
            u.email, u.full_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    method: row.method,
    path: row.path,
    statusCode: row.status_code,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
  }));
}
