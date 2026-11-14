import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePage from './ProfilePage';

const createProps = (overrides = {}) => ({
  user: { uid: 'user-1', displayName: 'Ada Lovelace', email: 'ada@example.com' },
  role: 'user',
  userDepartments: [],
  userProjects: [],
  calendarDays: [],
  dayStatus: () => 'none',
  dayMeetings: () => [],
  userTasks: [],
  onAddTask: jest.fn().mockResolvedValue(true),
  busy: false,
  upcomingMeetings: [],
  attendedMeetings: [],
  attendeeMap: {},
  notifs: [],
  unreadNotifCount: 0,
  onMarkNotifRead: jest.fn(),
  onClearNotifs: jest.fn(),
  onNavigate: jest.fn(),
  onSignOut: jest.fn(),
  loading: false,
  error: '',
  ...overrides,
});

test('renders as an independent page with a return-to-community action', () => {
  const props = createProps();
  render(<ProfilePage {...props} />);

  expect(screen.getByRole('heading', { name: 'Profilim' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Topluluğa Dön' }));
  expect(props.onNavigate).toHaveBeenCalledWith('meetings');
});

test('adds a personal task and clears the form only after it succeeds', async () => {
  const props = createProps();
  render(<ProfilePage {...props} />);

  const title = screen.getByPlaceholderText('Görev başlığı');
  fireEvent.change(title, { target: { value: 'Plan workshop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));

  await waitFor(() => expect(props.onAddTask).toHaveBeenCalledWith({ title: 'Plan workshop', dueDate: '' }));
  await waitFor(() => expect(title).toHaveValue(''));
});

test('keeps task input and shows a useful error when saving fails', async () => {
  const props = createProps({ onAddTask: jest.fn().mockRejectedValue(new Error('permission denied')) });
  render(<ProfilePage {...props} />);

  const title = screen.getByPlaceholderText('Görev başlığı');
  fireEvent.change(title, { target: { value: 'Plan workshop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Görev eklenemedi: permission denied');
  expect(title).toHaveValue('Plan workshop');
});
