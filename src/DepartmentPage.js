import React, { useState } from 'react';
import NewsBoard from './NewsBoard';

const formatDate = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('tr-TR');
};

const DepartmentPage = ({
  department,
  meetings,
  projects,
  memberCount,
  presidentName,
  news,
  departments,
  canManage,
  onPublishNews,
  onDeleteNews,
  canDeleteNews,
  onNavigate,
  adminPanel,
}) => {
  const [section, setSection] = useState('home');
  const sections = [
    { id: 'home', label: 'Ana Sayfa' },
    { id: 'meetings', label: 'Toplantılar', count: meetings.length },
    { id: 'projects', label: 'Projeler', count: projects.length },
    { id: 'news', label: 'Haberler', count: news.length },
  ];

  return (
    <div className="department-page">
      <section className="department-hero" style={{ '--department-color': department.color || '#9c8cff' }}>
        <button className="department-back" type="button" onClick={() => onNavigate('departments')}>
          <span aria-hidden="true">←</span> Tüm departmanlar
        </button>
        <div className="department-hero-content">
          <span className="department-symbol" aria-hidden="true">{department.name.slice(0, 1)}</span>
          <div>
            <p className="profile-eyebrow">BUFALOTEK CENTER · DEPARTMAN</p>
            <h2>{department.name}</h2>
            <p>{department.desc || 'Departman çalışmaları ve topluluk güncellemeleri.'}</p>
          </div>
        </div>
        <div className="department-hero-stats">
          <span><strong>{memberCount}</strong> Üye</span>
          <span><strong>{meetings.length}</strong> Toplantı</span>
          <span><strong>{projects.length}</strong> Proje</span>
          <span><strong>{presidentName || 'Atanmadı'}</strong> Başkan</span>
        </div>
      </section>

      <nav className="department-tabs" aria-label={`${department.name} sayfa bölümleri`}>
        {sections.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`department-tab ${section === item.id ? 'department-tab-active' : ''}`}
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => setSection(item.id)}
          >
            {item.label}
            {item.count > 0 && <span>{item.count}</span>}
          </button>
        ))}
      </nav>

      {section === 'home' && (
        <div className="department-home-grid">
          <section className="section department-overview">
            <p className="profile-eyebrow">DEPARTMAN HAKKINDA</p>
            <h3>Birlikte üretiyor, birlikte ilerliyoruz.</h3>
            <p>{department.desc || 'Bu departmandaki ekip çalışmaları, toplantılar, projeler ve haberler bu sayfada bir araya gelir.'}</p>
            <button type="button" className="btn" onClick={() => setSection('news')}>Son haberleri gör <span aria-hidden="true">→</span></button>
          </section>
          <section className="section department-home-news">
            <div className="section-header"><h2>Son Haberler</h2><button className="btn btn-sm" onClick={() => setSection('news')}>Tüm haberler</button></div>
            <NewsBoard news={news.slice(0, 3)} departments={departments} />
          </section>
          <section className="section department-home-summary">
            <div className="section-header"><h2>Projeler</h2><button className="btn btn-sm" onClick={() => setSection('projects')}>Tüm projeler</button></div>
            {projects.length === 0 ? <p className="empty-msg">Henüz proje eklenmemiş.</p> : (
              <ul className="department-project-list">
                {projects.slice(0, 4).map((project) => <li key={project.id}>{project.name}</li>)}
              </ul>
            )}
          </section>
        </div>
      )}

      {section === 'meetings' && (
        <section className="section">
          <div className="section-header"><div><p className="profile-eyebrow">EKİP ÇALIŞMALARI</p><h2>Toplantılar</h2></div></div>
          {meetings.length === 0 ? <p className="empty-msg">Bu departman için toplantı kaydı bulunamadı.</p> : (
            <div className="department-meeting-list">
              {meetings.map((meeting) => (
                <article className="department-meeting-card" key={meeting.id}>
                  <span className="department-meeting-date">{formatDate(meeting.date)}</span>
                  <div><h3>{meeting.title}</h3><p>{meeting.gundem || meeting.notes || 'Toplantı gündemi eklenmemiş.'}</p></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {section === 'projects' && (
        <>
          <section className="section">
            <div className="section-header"><div><p className="profile-eyebrow">ÜRETİM ALANI</p><h2>Departman Projeleri</h2></div></div>
            {projects.length === 0 ? <p className="empty-msg">Henüz bu departmana ait proje yok.</p> : (
              <div className="card-grid department-project-grid">
                {projects.map((project) => (
                  <article className="department-project-card" key={project.id}>
                    <span aria-hidden="true">◇</span><h3>{project.name}</h3>
                    <p>{project.description || `${department.name} projesi`}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
          {canManage && adminPanel}
        </>
      )}

      {section === 'news' && (
        <section className="section">
          <div className="section-header"><div><p className="profile-eyebrow">GÜNCELLEMELER</p><h2>{department.name} Haberleri</h2></div></div>
          <NewsBoard
            news={news}
            departments={departments}
            canPublish={canManage}
            canDelete={canDeleteNews}
            onPublish={onPublishNews}
            onDelete={onDeleteNews}
          />
        </section>
      )}

      {section === 'home' && canManage && adminPanel}
    </div>
  );
};

export default DepartmentPage;
