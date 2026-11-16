import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentAdminPanel, { DepartmentPresidentAssignments } from './DepartmentAdminPanel';

const department = {
  id: 'pr-id',
  name: 'PR Departmanı',
  presidentUid: 'chair-1',
};

test('hides department controls from users who are neither chair nor admin', () => {
  render(
    <DepartmentAdminPanel
      department={department}
      users={[]}
      members={[]}
      userDepartments={[]}
      projects={[]}
      userUid="member-1"
      isAdmin={false}
      busy={false}
      onAddMember={jest.fn()}
      onRemoveMember={jest.fn()}
      onAddProject={jest.fn()}
      onDeleteProject={jest.fn()}
    />
  );

  expect(screen.queryByRole('heading', { name: 'PR Departmanı Yönetim Paneli' })).not.toBeInTheDocument();
});

test('allows the assigned chair to manage department members and projects', async () => {
  const onAddMember = jest.fn().mockResolvedValue(undefined);
  const onAddProject = jest.fn().mockResolvedValue(undefined);
  render(
    <DepartmentAdminPanel
      department={department}
      users={[{ id: 'member-2', name: 'Ada' }]}
      members={[]}
      userDepartments={[]}
      projects={[]}
      userUid="chair-1"
      isAdmin={false}
      busy={false}
      onAddMember={onAddMember}
      onRemoveMember={jest.fn()}
      onAddProject={onAddProject}
      onDeleteProject={jest.fn()}
    />
  );

  fireEvent.change(screen.getByLabelText('Üye ekle'), { target: { value: 'member-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Üye Ekle' }));
  await waitFor(() => expect(onAddMember).toHaveBeenCalledWith('pr-id', 'member-2'));

  fireEvent.change(screen.getByLabelText('Proje oluştur'), { target: { value: 'Topluluk duyuruları' } });
  fireEvent.click(screen.getByRole('button', { name: 'Oluştur' }));
  await waitFor(() => expect(onAddProject).toHaveBeenCalledWith('pr-id', 'Topluluk duyuruları'));
});

test('lets only the general admin save department chair assignments', async () => {
  const onAssign = jest.fn().mockResolvedValue(undefined);
  render(
    <DepartmentPresidentAssignments
      departments={[department]}
      users={[{ id: 'chair-2', name: 'Deniz', role: 'user' }]}
      busy={false}
      onAssign={onAssign}
    />
  );

  fireEvent.change(screen.getByLabelText('PR Departmanı'), { target: { value: 'chair-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  await waitFor(() => expect(onAssign).toHaveBeenCalledWith('pr-id', 'chair-2'));
});
