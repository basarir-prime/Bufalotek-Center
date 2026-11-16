import React from 'react';

const HomePage = ({ user, onNavigate, onSignOut }) => {
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'Kullanıcı';

  return (
    <div className="app home-page">
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-brand">
            <p className="profile-eyebrow">Bufalotek Center</p>
            <span>Bilişim Topluluğu</span>
          </div>
          <div className="profile-header-actions">
            <button className="btn" onClick={() => onNavigate('profile')}>Profilim</button>
            <button className="btn btn-danger" onClick={onSignOut}>Çıkış Yap</button>
          </div>
        </div>
      </header>

      <main className="main-content home-content">
        <section className="home-welcome">
          <span className="home-welcome-mark" aria-hidden="true">B</span>
          <p className="profile-eyebrow">Topluluk alanına hoş geldin</p>
          <h1>Merhaba <span>{name}</span></h1>
          <p>Bufalotek Center’da devam etmek istediğin yeri seçebilirsin.</p>
        </section>

        <section className="section home-guide" aria-labelledby="home-guide-title">
          <div>
            <p className="profile-eyebrow">Hızlı başlangıç</p>
            <h2 id="home-guide-title">Nereye gitmek istersin?</h2>
            <p className="home-guide-description">Kişisel bilgilerine göz at veya topluluk departmanlarını keşfet.</p>
          </div>
          <div className="home-shortcut-grid">
            <article className="home-shortcut-card home-shortcut-profile">
              <span className="home-shortcut-icon" aria-hidden="true">01</span>
              <h3>Profilim</h3>
              <p>Görevlerini, toplantı takvimini, etkinliklerini ve bildirimlerini görüntüle.</p>
              <button className="btn btn-primary" onClick={() => onNavigate('profile')}>
                Profilime git <span aria-hidden="true">→</span>
              </button>
            </article>
            <article className="home-shortcut-card home-shortcut-departments">
              <span className="home-shortcut-icon" aria-hidden="true">02</span>
              <h3>Departmanlar</h3>
              <p>Topluluk departmanlarını, ekipleri ve departman projelerini keşfet.</p>
              <button className="btn btn-primary" onClick={() => onNavigate('departments')}>
                Departmanları keşfet <span aria-hidden="true">→</span>
              </button>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Bufalotek Center &copy; {new Date().getFullYear()} — Bilişim Topluluğu</p>
      </footer>
    </div>
  );
};

export default HomePage;
