import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { listVisibleNotifications } from './notifications.repository';

/**
 * Thông báo hệ thống cho người dùng.
 *
 * Frontend gọi endpoint này mỗi lần vào trang để lấy thông báo còn hiệu lực;
 * lớp thông báo có nút X để đóng.
 */
export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ notifications: await listVisibleNotifications() });
  }),
);
