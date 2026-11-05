import { Router } from 'express';
import { pool } from '../../database/pool';
import { asyncHandler } from '../../lib/errors';

export const usersRouter = Router();

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      created_at: Date;
    }>(
      `SELECT id, email, full_name, role, created_at
         FROM users
        ORDER BY created_at DESC`,
    );

    res.json({
      users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        createdAt: row.created_at.toISOString(),
      })),
    });
  }),
);
