import React from 'react';
import Sidebar from './Sidebar';
import NewsBoard from './NewsBoard';

const HomePage = ({ user, role, isAdmin, greyListCount, unreadNotifCount, news, newsError, departments, onNavigate, onSignOut }) => {
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'Kullanıcı';

  return (
    <div className="app app-shell home-page">
      <Sidebar
        user={user}
        role={role}
        activePage="home"
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
        greyListCount={greyListCount}
        unreadNotifCount={unreadNotifCount}
      />
      <div className="app-main">
        <header className="workspace-header">
          <div><p className="profile-eyebrow">TOPLULUK ALANI</p><h1>Genel Bakış</h1></div>
          <span className="workspace-date">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </header>
        <main className="main-content home-content">
          <section className="home-welcome">
            <div className="home-welcome-copy">
              <p className="profile-eyebrow">BUFALOTEK CENTER · BİLİŞİM TOPLULUĞU</p>
              <h2>Merhaba <span>{name}</span></h2>
              <p>Topluluk çalışmalarına kaldığın yerden devam et.</p>
            </div>
            <span className="home-welcome-mark" aria-hidden="true">B</span>
          </section>

          <section className="section home-guide" aria-labelledby="home-guide-title">
            <div className="section-header home-guide-heading">
              <div>
                <p className="profile-eyebrow">HIZLI ERİŞİM</p>
                <h2 id="home-guide-title">Nereden başlayalım?</h2>
                <p className="home-guide-description">Kişisel alanına geç veya topluluk ekiplerini keşfet.</p>
              </div>
            </div>
            <div className="home-shortcut-grid">
              <article className="home-shortcut-card home-shortcut-profile">
                <span className="home-shortcut-icon" aria-hidden="true">◎</span>
                <span className="shortcut-kicker">KİŞİSEL ALAN</span>
                <h3>Profilim</h3>
                <p>Görevlerini, toplantı takvimini, etkinliklerini ve bildirimlerini tek yerde görüntüle.</p>
                <button className="btn btn-primary" onClick={() => onNavigate('profile')}>
                  Profilime git <span aria-hidden="true">→</span>
                </button>
              </article>
              <article className="home-shortcut-card home-shortcut-departments">
                <span className="home-shortcut-icon" aria-hidden="true">◇</span>
                <span className="shortcut-kicker">TOPLULUK</span>
                <h3>Departmanlar</h3>
                <p>Topluluk ekiplerini, üyeleri ve devam eden projeleri keşfet.</p>
                <button className="btn btn-primary" onClick={() => onNavigate('departments')}>
                  Departmanları keşfet <span aria-hidden="true">→</span>
                </button>
              </article>
            </div>
          </section>
          <section className="section home-news">
            <div className="section-header">
              <div><p className="profile-eyebrow">TOPLULUKTAN</p><h2>Son Haberler</h2></div>
              <button className="btn btn-sm" onClick={() => onNavigate('news')}>Tüm haberler <span aria-hidden="true">→</span></button>
            </div>
            <NewsBoard news={(news || []).slice(0, 3)} departments={departments || []} loadError={newsError} />
          </section>
        </main>
        <footer className="footer"><p>Bufalotek Center &copy; {new Date().getFullYear()} — Bilişim Topluluğu</p></footer>
      </div>
    </div>
  );
};

export default HomePage;
