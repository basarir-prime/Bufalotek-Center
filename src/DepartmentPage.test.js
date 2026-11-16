import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentPage from './DepartmentPage';

const baseProps = {
  department: { id: 'pr', name: 'PR Departmanı', desc: 'İletişim ve marka çalışmaları', color: '#8b5cf6' },
  meetings: [{ id: 'meeting-1', title: 'İçerik toplantısı', date: '2026-11-18', gundem: 'Kampanya planı' }],
  projects: [{ id: 'project-1', name: 'Yeni web sitesi' }],
  memberCount: 4,
  presidentName: 'Ada',
  news: [{ id: 'news-1', title: 'Yeni etkinlik', body: 'Duyuru içeriği', departmentId: 'pr' }],
  departments: [{ id: 'pr', name: 'PR Departmanı' }],
  canManage: false,
  onPublishNews: jest.fn(),
  onDeleteNews: jest.fn(),
  canDeleteNews: jest.fn(() => false),
  onNavigate: jest.fn(),
};

test('provides department home, meetings, projects, and news sections', () => {
  render(<DepartmentPage {...baseProps} />);

  expect(screen.getByRole('heading', { name: 'PR Departmanı' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Son Haberler' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Toplantılar/ }));
  expect(screen.getByRole('heading', { name: 'İçerik toplantısı' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Projeler/ }));
  expect(screen.getByRole('heading', { name: 'Yeni web sitesi' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Haberler/ }));
  expect(screen.getByRole('heading', { name: 'PR Departmanı Haberleri' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Yeni etkinlik' })).toBeInTheDocument();
});

test('shows the news composer only to department managers', () => {
  const { rerender } = render(<DepartmentPage {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: /Haberler/ }));
  expect(screen.queryByRole('heading', { name: 'Haber paylaş' })).not.toBeInTheDocument();

  rerender(<DepartmentPage {...baseProps} canManage />);
  fireEvent.click(screen.getByRole('button', { name: /Haberler/ }));
  expect(screen.getByRole('heading', { name: 'Haber paylaş' })).toBeInTheDocument();
});
