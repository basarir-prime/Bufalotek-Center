import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NewsBoard from './NewsBoard';

const departments = [{ id: 'pr', name: 'PR Departmanı' }];

test('shows department news with its department label in the shared feed', () => {
  render(
    <NewsBoard
      news={[{ id: 'news-1', title: 'Yeni duyuru', body: 'Etkinlik tarihi açıklandı.', departmentId: 'pr' }]}
      departments={departments}
    />
  );

  expect(screen.getByRole('heading', { name: 'Yeni duyuru' })).toBeInTheDocument();
  expect(screen.getByText('PR Departmanı')).toBeInTheDocument();
});

test('publishes the article and clears the form only after success', async () => {
  const onPublish = jest.fn().mockResolvedValue(undefined);
  render(
    <NewsBoard news={[]} departments={departments} canPublish onPublish={onPublish} />
  );
  fireEvent.change(screen.getByLabelText('Başlık'), { target: { value: 'Atölye' } });
  fireEvent.change(screen.getByLabelText('İçerik'), { target: { value: 'Yeni atölyemiz yakında.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Haberi yayımla' }));

  await waitFor(() => expect(onPublish).toHaveBeenCalledWith({
    title: 'Atölye',
    body: 'Yeni atölyemiz yakında.',
  }));
  await waitFor(() => expect(screen.getByLabelText('Başlık')).toHaveValue(''));
});

test('shows a useful error when publishing fails', async () => {
  const onPublish = jest.fn().mockRejectedValue(new Error('permission denied'));
  render(
    <NewsBoard news={[]} departments={departments} canPublish onPublish={onPublish} />
  );
  fireEvent.change(screen.getByLabelText('Başlık'), { target: { value: 'Atölye' } });
  fireEvent.change(screen.getByLabelText('İçerik'), { target: { value: 'Yeni atölyemiz yakında.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Haberi yayımla' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Haber yayımlanamadı: permission denied');
  expect(screen.getByLabelText('Başlık')).toHaveValue('Atölye');
});

test('shows read errors instead of hiding a failed news feed', () => {
  render(<NewsBoard news={[]} departments={departments} loadError="Firestore rules yayımlanmalı." />);
  expect(screen.getByRole('alert')).toHaveTextContent('Firestore rules yayımlanmalı.');
});
