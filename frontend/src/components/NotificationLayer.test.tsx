import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationLayer } from './NotificationLayer';

const fetchNotifications = vi.fn();

/** Token giả lập trong AuthContext — đổi được giữa các test. */
let mockToken = 'token-1';

vi.mock('../lib/api', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotifications(...args),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'student' }, token: mockToken }),
}));

function renderLayer() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<NotificationLayer />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Đợi các promise pending (fetch + effect) được xử lý xong. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

const notification = (id: string, title: string) => ({
  id,
  title,
  message: `Nội dung ${title}`,
  level: 'info' as const,
  isActive: true,
  expiresAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('NotificationLayer', () => {
  beforeEach(() => {
    fetchNotifications.mockReset();
    mockToken = 'token-1';
    window.sessionStorage.clear();
  });

  it('hiện thông báo khi vào trang', async () => {
    fetchNotifications.mockResolvedValue([notification('n1', 'Nghỉ lễ')]);

    renderLayer();

    expect(await screen.findByText('Nghỉ lễ')).toBeInTheDocument();
    expect(screen.getByText('Nội dung Nghỉ lễ')).toBeInTheDocument();
    expect(screen.getByLabelText('Đóng thông báo')).toBeInTheDocument();
  });

  it('nút X đóng thông báo', async () => {
    fetchNotifications.mockResolvedValue([notification('n1', 'Nghỉ lễ')]);
    renderLayer();

    await screen.findByText('Nghỉ lễ');

    await act(async () => {
      screen.getByLabelText('Đóng thông báo').click();
    });

    expect(screen.queryByText('Nghỉ lễ')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nhiều thông báo thì hiện từng cái một, đóng cái hiện tại thì hiện cái tiếp', async () => {
    fetchNotifications.mockResolvedValue([
      notification('n1', 'Thông báo 1'),
      notification('n2', 'Thông báo 2'),
    ]);
    renderLayer();

    await screen.findByText('Thông báo 1');
    expect(screen.queryByText('Thông báo 2')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByLabelText('Đóng thông báo').click();
    });

    expect(await screen.findByText('Thông báo 2')).toBeInTheDocument();
    expect(screen.queryByText('Thông báo 1')).not.toBeInTheDocument();
  });

  it('không hiện gì khi không có thông báo', async () => {
    fetchNotifications.mockResolvedValue([]);

    renderLayer();
    await flush();

    expect(fetchNotifications).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lỗi mạng không được làm hỏng giao diện', async () => {
    fetchNotifications.mockRejectedValue(new Error('mất mạng'));

    renderLayer();
    await flush();

    expect(fetchNotifications).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mỗi phiên đăng nhập chỉ hiện một lần: tải lại trang không hiện lại', async () => {
    fetchNotifications.mockResolvedValue([notification('n1', 'Nghỉ lễ')]);

    const view = renderLayer();
    await screen.findByText('Nghỉ lễ');
    view.unmount();

    // Mount lại (giống tải lại trang / mở tab mới trong cùng phiên).
    renderLayer();
    await flush();

    expect(fetchNotifications).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('đăng nhập lại (token mới) thì thông báo hiện lại', async () => {
    fetchNotifications.mockResolvedValue([notification('n1', 'Nghỉ lễ')]);

    const view = renderLayer();
    await screen.findByText('Nghỉ lễ');
    view.unmount();

    // Giả lập đăng nhập lại: token trong AuthContext đổi.
    mockToken = 'token-2';

    renderLayer();

    expect(await screen.findByText('Nghỉ lễ')).toBeInTheDocument();
    expect(fetchNotifications).toHaveBeenCalledWith('token-2');
  });
});
