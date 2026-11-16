import React from 'react';

const NAV_ITEMS = [
  { id: 'home', label: 'Genel Bakış', icon: '⌂' },
  { id: 'meetings', label: 'Toplantılar', icon: '▤' },
  { id: 'departments', label: 'Departmanlar', icon: '◇' },
  { id: 'calendar', label: 'Takvim', icon: '▦' },
  { id: 'grey-list', label: 'Gri Liste', icon: '◉' },
  { id: 'profile', label: 'Profilim', icon: '◎' },
];

const Sidebar = ({ user, role, activePage, onNavigate, onSignOut, isAdmin, unreadNotifCount = 0, greyListCount = 0 }) => {
  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Kullanıcı';

  const navigate = (event, page) => {
    event.preventDefault();
    onNavigate(page);
  };

  return (
    <aside className="sidebar">
      <a className="sidebar-brand" href="#home" onClick={(event) => navigate(event, 'home')}>
        <span className="brand-mark">B</span>
        <span><strong>Bufalotek</strong><small>COMMUNITY CENTER</small></span>
      </a>

      <div className="sidebar-section-label">ÇALIŞMA ALANI</div>
      <nav className="sidebar-nav" aria-label="Ana gezinme">
        {NAV_ITEMS.map((item) => (
          <a
            href={`#${item.id}`}
            key={item.id}
            className={`sidebar-link ${activePage === item.id ? 'sidebar-link-active' : ''}`}
            aria-current={activePage === item.id ? 'page' : undefined}
            onClick={(event) => navigate(event, item.id)}
          >
            <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'grey-list' && greyListCount > 0 && <span className="sidebar-count">{greyListCount}</span>}
            {item.id === 'profile' && unreadNotifCount > 0 && <span className="sidebar-count">{unreadNotifCount}</span>}
          </a>
        ))}
        {isAdmin && (
          <a
            href="#admin-panel"
            className={`sidebar-link ${activePage === 'admin-panel' ? 'sidebar-link-active' : ''}`}
            aria-current={activePage === 'admin-panel' ? 'page' : undefined}
            onClick={(event) => navigate(event, 'admin-panel')}
          >
            <span className="sidebar-link-icon" aria-hidden="true">⚙</span>
            <span>Yönetim</span>
          </a>
        )}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <span className="sidebar-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span className="sidebar-user-copy"><strong>{name}</strong><small>{role || 'Üye'}</small></span>
        <button className="sidebar-signout" type="button" aria-label="Çıkış yap" onClick={onSignOut}>↗</button>
      </div>
    </aside>
  );
};

export default Sidebar;
