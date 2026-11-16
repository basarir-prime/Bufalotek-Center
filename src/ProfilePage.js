import React, { useState } from 'react';
import Sidebar from './Sidebar';

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('tr-TR');

const ProfilePage = ({
  user,
  role,
  userDepartments,
  userProjects,
  calendarDays,
  dayStatus,
  dayMeetings,
  userTasks,
  onAddTask,
  busy,
  upcomingMeetings,
  attendedMeetings,
  attendeeMap,
  notifs,
  unreadNotifCount,
  onMarkNotifRead,
  onClearNotifs,
  onNavigate,
  onSignOut,
  isAdmin,
  greyListCount,
  loading,
  error,
}) => {
  const [newTask, setNewTask] = useState({ title: '', dueDate: '' });
  const [taskError, setTaskError] = useState('');

  const handleAddTask = async (event) => {
    event.preventDefault();
    setTaskError('');
    if (!newTask.title.trim()) {
      setTaskError('Görev başlığı zorunludur.');
      return;
    }

    try {
      const saved = await onAddTask(newTask);
      if (saved) setNewTask({ title: '', dueDate: '' });
    } catch (error) {
      setTaskError(`Görev eklenemedi: ${error?.message || 'Bilinmeyen bir hata oluştu.'}`);
    }
  };

  return (
    <div className="app app-shell profile-page">
      <Sidebar
        user={user}
        role={role}
        activePage="profile"
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
        greyListCount={greyListCount}
        unreadNotifCount={unreadNotifCount}
      />
      <div className="app-main">
      <header className="workspace-header">
        <div><p className="profile-eyebrow">KİŞİSEL ALAN</p><h1>Profilim</h1><p className="header-sub">Topluluk hesabın ve kişisel etkinliklerin</p></div>
        <button className="btn" onClick={() => onNavigate('meetings')}>Topluluğa Dön <span aria-hidden="true">→</span></button>
      </header>

      <main className="main-content profile-content">
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? (
          <p className="empty-msg" role="status">Profil bilgileriniz yükleniyor...</p>
        ) : (
          <>
            <section className="section">
              <h2>Kişisel Bilgiler</h2>
              <div className="profile-overview-grid">
                <div className="profile-card profile-identity">
                  <div className="profile-avatar">
                    {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <h3>{user.displayName || 'Kullanıcı'}</h3>
                  <p className="profile-email">{user.email}</p>
                  <span className="badge badge-active profile-role">{role || 'user'}</span>
                </div>

                <div className="profile-card">
                  <h4 className="profile-department-heading">Departmanlar</h4>
                  {userDepartments.length > 0 ? (
                    <ul className="profile-list">
                      {userDepartments.map((department) => (
                        <li key={department.departmentId}>{department.departmentName || 'Departman'}</li>
                      ))}
                    </ul>
                  ) : <p className="empty-msg profile-empty">Departman atanmamış.</p>}
                </div>

                <div className="profile-card">
                  <h4 className="profile-project-heading">Projeler</h4>
                  {userProjects.length > 0 ? (
                    <ul className="profile-list">
                      {userProjects.map((project) => (
                        <li key={project.projectId}>{project.projectName || 'Proje'}</li>
                      ))}
                    </ul>
                  ) : <p className="empty-msg profile-empty">Proje atanmamış.</p>}
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-header">
                <h2>Toplantı Takvimim</h2>
                <div className="calendar-legend">
                  <span><i className="calendar-legend-dot calendar-day-upcoming" />Planlandı</span>
                  <span><i className="calendar-legend-dot calendar-day-attended" />Katıldım</span>
                  <span><i className="calendar-legend-dot calendar-day-missed" />Katılmadım</span>
                </div>
              </div>
              <div className="calendar-grid profile-calendar">
                {calendarDays.map((day) => {
                  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  const status = dayStatus(day);
                  const meetingsOnDay = dayMeetings(day);
                  const statusClass = status === 'attended' ? 'calendar-day-attended' :
                    status === 'missed' ? 'calendar-day-missed' :
                      status === 'upcoming' ? 'calendar-day-upcoming' : '';
                  return (
                    <div className={`calendar-day ${statusClass}`} key={iso} title={meetingsOnDay.map((meeting) => meeting.title).join(', ')}>
                      <div className="calendar-date">
                        <span className="calendar-day-num">{day.getDate()}</span>
                        <span className="calendar-month">{day.toLocaleDateString('tr-TR', { month: 'short' })}</span>
                        <span className="calendar-year">{day.getFullYear()}</span>
                      </div>
                      {meetingsOnDay.length > 0 && (
                        <div className="calendar-meetings">
                          {meetingsOnDay.map((meeting) => (
                            <div key={meeting.id} className="calendar-meeting-dot">{meeting.title}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="section">
              <div className="section-header"><h2>Yapılacak Görevler</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Görev</th><th>Açıklama</th><th>Bitiş</th><th>Öncelik</th><th>Durum</th></tr></thead>
                  <tbody>
                    {userTasks.length === 0 ? (
                      <tr><td colSpan={5} className="empty-msg">Henüz görev yok.</td></tr>
                    ) : userTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td className="profile-task-description">{task.description || '-'}</td>
                        <td>{task.dueDate || '-'}</td>
                        <td><span className={`badge ${task.priority === 'high' ? 'badge-active' : 'badge-inactive'}`}>{task.priority || 'medium'}</span></td>
                        <td><span className={`badge ${task.status === 'completed' ? 'badge-active' : 'badge-inactive'}`}>{task.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form className="profile-task-form" onSubmit={handleAddTask}>
                <label htmlFor="profile-task-title">Yeni görev ekle</label>
                <div className="profile-task-fields">
                  <input
                    id="profile-task-title"
                    className="search-input"
                    type="text"
                    value={newTask.title}
                    placeholder="Görev başlığı"
                    onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                  />
                  <input
                    className="search-input"
                    type="date"
                    aria-label="Görev bitiş tarihi"
                    value={newTask.dueDate}
                    onChange={(event) => setNewTask({ ...newTask, dueDate: event.target.value })}
                  />
                  <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
                {taskError && <p className="form-error" role="alert">{taskError}</p>}
              </form>
            </section>

            <section className="section">
              <h2>Gelecek Etkinlikler</h2>
              {upcomingMeetings.length === 0 ? <p className="empty-msg">Gelecek etkinlik yok.</p> : (
                <div className="card-grid">
                  {upcomingMeetings.map((meeting) => {
                    const didAttend = attendeeMap[meeting.id]?.some((attendee) => String(attendee.id) === String(user.uid));
                    return (
                      <article className="card" key={meeting.id}>
                        <div className="card-body">
                          <h3 className="card-title">{meeting.title}</h3>
                          <span className="card-date">{formatDate(meeting.date)}</span>
                          <p className="card-notes">{meeting.gundem || meeting.notes || '-'}</p>
                          <span className={`badge ${didAttend ? 'badge-active' : 'badge-inactive'}`}>
                            {didAttend ? 'Katılımınız Onaylandı' : 'Henüz Onaylanmadı'}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="section">
              <h2>Katıldığım Etkinlikler</h2>
              {attendedMeetings.length === 0 ? <p className="empty-msg">Henüz hiçbir etkinliğe katılmadınız.</p> : (
                <div className="card-grid">
                  {attendedMeetings.map((meeting) => (
                    <article className="card" key={meeting.id}>
                      <div className="card-body">
                        <h3 className="card-title">{meeting.title}</h3>
                        <span className="card-date">{formatDate(meeting.date)}</span>
                        <span className="badge badge-active">✓ Katıldınız</span>
                        <p className="card-notes">{meeting.kararlar || meeting.notes || '-'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-header">
                <h2>Bildirimler {unreadNotifCount > 0 && <span className="tab-badge profile-notif-count">{unreadNotifCount}</span>}</h2>
                {notifs.length > 0 && <button className="btn btn-sm btn-danger" onClick={onClearNotifs}>Temizle</button>}
              </div>
              <div className="profile-notifications">
                {notifs.length === 0 ? <p className="empty-msg">Hiç bildiriminiz yok.</p> : notifs.map((notification) => {
                  const icon = notification.type === 'warning' ? '⚠️' : notification.type === 'meeting' ? '📅' : 'ℹ️';
                  return (
                    <button
                      type="button"
                      key={notification.id}
                      className={`profile-notification ${notification.read ? 'profile-notification-read' : ''}`}
                      onClick={() => onMarkNotifRead(notification.id)}
                    >
                      <span aria-hidden="true">{icon}</span>
                      <span className="profile-notification-message">
                        <span>{notification.message}</span>
                        <small>{new Date(notification.created).toLocaleString('tr-TR')}</small>
                      </span>
                      {!notification.read && <i className="profile-notification-unread" title="Okunmadı" />}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="footer">
        <p>Bufalotek Center &copy; {new Date().getFullYear()} — Firebase Firestore tabanlı, Rol Yetkilendirmeli</p>
      </footer>
      </div>
    </div>
  );
};

export default ProfilePage;
