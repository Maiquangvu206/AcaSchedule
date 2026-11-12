import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../lib/errors';
import {
  NOTIFICATION_LEVELS,
  createNotification,
  deleteNotification,
  listAllNotifications,
  updateNotification,
  type NotificationLevel,
} from '../notifications/notifications.repository';

/**
 * Quản trị thông báo hệ thống.
 *
 * Admin soạn thông báo, bật/ẩn và xoá. Thông báo đang bật sẽ hiện trong lớp
 * thông báo của sinh viên mỗi lần vào trang.
 */

const levelSchema = z.enum(['info', 'success', 'warning', 'error']);

const createSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
  message: z.string().trim().min(1, 'Nội dung không được để trống').max(5000),
  level: levelSchema.default('info'),
  isActive: z.boolean().default(true),
  /** ISO string; null = không hết hạn. */
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(5000).optional(),
    level: levelSchema.optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Không có trường nào để cập nhật.',
  });

function parseExpiresAt(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw AppError.badRequest('Ngày hết hạn không hợp lệ.');
  return parsed;
}

export const adminNotificationsRouter = Router();

adminNotificationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ notifications: await listAllNotifications() });
  }),
);

adminNotificationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const notification = await createNotification(
      {
        title: input.title,
        message: input.message,
        level: input.level as NotificationLevel,
        isActive: input.isActive,
        expiresAt: parseExpiresAt(input.expiresAt),
      },
      req.user?.id ?? null,
    );
    res.status(201).json({ notification });
  }),
);

adminNotificationsRouter.patch(
  '/:notificationId',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const notification = await updateNotification(req.params.notificationId, {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.message === undefined ? {} : { message: input.message }),
      ...(input.level === undefined ? {} : { level: input.level as NotificationLevel }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: parseExpiresAt(input.expiresAt) }),
    });
    if (!notification) throw AppError.notFound('Không tìm thấy thông báo');
    res.json({ notification });
  }),
);

adminNotificationsRouter.delete(
  '/:notificationId',
  asyncHandler(async (req, res) => {
    const removed = await deleteNotification(req.params.notificationId);
    if (!removed) throw AppError.notFound('Không tìm thấy thông báo');
    res.status(204).send();
  }),
);
