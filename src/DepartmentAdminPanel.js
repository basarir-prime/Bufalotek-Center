import React, { useState } from 'react';

const DepartmentAdminPanel = ({
  department,
  users,
  members,
  userDepartments,
  projects,
  userUid,
  isAdmin,
  busy,
  onAddMember,
  onRemoveMember,
  onAddProject,
  onDeleteProject,
}) => {
  const [memberUid, setMemberUid] = useState('');
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const authorized = isAdmin || department.presidentUid === userUid;

  if (!authorized) return null;

  const departmentMemberships = userDepartments.filter(
    (membership) => String(membership.departmentId) === String(department.id)
  );
  const departmentMemberUids = new Set(departmentMemberships.map((membership) => String(membership.uid)));
  const departmentProjects = projects.filter(
    (project) => String(project.departmentId) === String(department.id)
  );

  const userName = (uid) => {
    const user = users.find((item) => String(item.id) === String(uid));
    const member = members.find((item) => String(item.id) === String(uid));
    return user?.name || member?.name || user?.email || member?.email || uid;
  };

  const runAction = async (action, successMessage) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (actionError) {
      setError(actionError?.message || 'İşlem tamamlanamadı.');
      return false;
    }
  };

  const addMember = async (event) => {
    event.preventDefault();
    if (!memberUid) return;
    if (await runAction(() => onAddMember(department.id, memberUid), 'Üye departmana eklendi.')) {
      setMemberUid('');
    }
  };

  const addProject = async (event) => {
    event.preventDefault();
    if (!projectName.trim()) return;
    if (await runAction(() => onAddProject(department.id, projectName), 'Proje oluşturuldu.')) {
      setProjectName('');
    }
  };

  return (
    <section className="section department-admin-panel" aria-labelledby={`department-admin-${department.id}`}>
      <div className="section-header">
        <div>
          <h2 id={`department-admin-${department.id}`}>{department.name} Yönetim Paneli</h2>
          <p className="section-desc">Yalnızca bu departmanın başkanı ve genel başkan yönetim işlemi yapabilir.</p>
        </div>
        <span className="badge badge-active">{isAdmin ? 'Genel Başkan' : 'Departman Başkanı'}</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="department-admin-success" role="status">{message}</p>}

      <div className="department-admin-grid">
        <div className="department-admin-card">
          <h3>Departman Üyeleri</h3>
          <form className="department-admin-form" onSubmit={addMember}>
            <label htmlFor={`department-member-${department.id}`}>Üye ekle</label>
            <div className="department-admin-controls">
              <select
                id={`department-member-${department.id}`}
                value={memberUid}
                onChange={(event) => setMemberUid(event.target.value)}
              >
                <option value="">Kullanıcı seçin...</option>
                {users.filter((user) => !departmentMemberUids.has(String(user.id))).map((user) => (
                  <option key={user.id} value={user.id}>{user.name || user.email || user.id}</option>
                ))}
              </select>
              <button className="btn btn-sm btn-primary" type="submit" disabled={busy || !memberUid}>Üye Ekle</button>
            </div>
          </form>

          {departmentMemberships.length === 0 ? (
            <p className="empty-msg">Bu departmana henüz üye atanmamış.</p>
          ) : (
            <div className="department-admin-list">
              {departmentMemberships.map((membership) => (
                <div className="department-admin-list-row" key={membership.id || `${membership.uid}_${membership.departmentId}`}>
                  <span>{userName(membership.uid)}</span>
                  <button
                    className="btn btn-sm btn-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`${userName(membership.uid)} kullanıcısını departmandan çıkarmak istiyor musunuz?`)) {
                        runAction(
                          () => onRemoveMember(membership.uid, department.id),
                          'Üye departmandan çıkarıldı.'
                        );
                      }
                    }}
                  >
                    Çıkar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="department-admin-card">
          <h3>Departman Projeleri</h3>
          <form className="department-admin-form" onSubmit={addProject}>
            <label htmlFor={`department-project-${department.id}`}>Proje oluştur</label>
            <div className="department-admin-controls">
              <input
                id={`department-project-${department.id}`}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Proje adı"
              />
              <button className="btn btn-sm btn-primary" type="submit" disabled={busy || !projectName.trim()}>Oluştur</button>
            </div>
          </form>

          {departmentProjects.length === 0 ? (
            <p className="empty-msg">Bu departmana ait proje yok.</p>
          ) : (
            <div className="department-admin-list">
              {departmentProjects.map((project) => (
                <div className="department-admin-list-row" key={project.id}>
                  <span>{project.name}</span>
                  <button
                    className="btn btn-sm btn-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`"${project.name}" projesini silmek istiyor musunuz?`)) {
                        runAction(
                          () => onDeleteProject(project.id),
                          'Proje silindi.'
                        );
                      }
                    }}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export const DepartmentPresidentAssignments = ({ departments, users, busy, onAssign }) => {
  const [assignments, setAssignments] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const save = async (department) => {
    setError('');
    setMessage('');
    try {
      await onAssign(department.id, assignments[department.id] ?? department.presidentUid ?? '');
      setMessage(`${department.name} başkanlığı güncellendi.`);
    } catch (saveError) {
      setError(saveError?.message || 'Başkan ataması kaydedilemedi.');
    }
  };

  return (
    <section className="admin-card-modern">
      <div style={{ marginBottom: '1rem' }}>
        <h3 className="department-president-heading">Departman Başkanlıkları</h3>
        <p className="department-president-description">Her departmanın başkanını yalnızca genel başkan atayabilir veya görevden alabilir.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="department-admin-success" role="status">{message}</p>}
      <div className="department-president-list">
        {departments.map((department) => (
          <div className="department-president-row" key={department.id}>
            <label htmlFor={`department-president-${department.id}`}>{department.name}</label>
            <select
              id={`department-president-${department.id}`}
              value={assignments[department.id] ?? department.presidentUid ?? ''}
              onChange={(event) => setAssignments({ ...assignments, [department.id]: event.target.value })}
            >
              <option value="">Başkan atanmadı</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name || user.email || user.id}</option>
              ))}
            </select>
            <button
              className="admin-action-btn primary"
              type="button"
              disabled={busy}
              onClick={() => save(department)}
            >
              Kaydet
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DepartmentAdminPanel;
