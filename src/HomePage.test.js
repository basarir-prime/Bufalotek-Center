import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from './HomePage';

test('greets the signed-in user and links to their profile and departments', () => {
  const onNavigate = jest.fn();
  render(
    <HomePage
      user={{ displayName: 'Ada Lovelace', email: 'ada@example.com' }}
      onNavigate={onNavigate}
      onSignOut={jest.fn()}
    />
  );

  expect(screen.getByRole('heading', { name: 'Merhaba Ada Lovelace' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Profilime git/ }));
  expect(onNavigate).toHaveBeenLastCalledWith('profile');

  fireEvent.click(screen.getByRole('button', { name: /Departmanları keşfet/ }));
  expect(onNavigate).toHaveBeenLastCalledWith('departments');
});

test('uses the account name when the display name is missing', () => {
  render(<HomePage user={{ email: 'deniz@example.com' }} onNavigate={jest.fn()} onSignOut={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Merhaba deniz' })).toBeInTheDocument();
});
