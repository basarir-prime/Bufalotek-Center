import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './authContext';
import * as fs from './firestoreService';

// Bugünü YYYY-MM-DD formatında al
const getTodayISO = () => {
  return new Date().toISOString().split('T')[0];
};

function App() {
  const { user, role, loading, isAdmin } = useAuth();

  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendeeMap, setAttendeeMap] = useState({});
  const [greyList, setGreyList] = useState([]);
  const [hasTodayPermission, setHasTodayPermission] = useState(false);

  const [activeTab, setActiveTab] = useState('meetings');
  const [loadingData, setLoadingData] = useState(true);
  const [globalError, setGlobalError] = useState('');

  // Form State'leri
  const [memberForm, setMemberForm] = useState({ name: '', email: '' });
  const [editingMember, setEditingMember] = useState(null);
  const [memberError, setMemberError] = useState('');

  const [meetingForm, setMeetingForm] = useState({ title: '', date: getTodayISO(), gundem: '', kararlar: '', gorevler: '' });
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [meetingError, setMeetingError] = useState('');
  const [newMeetingAttendees, setNewMeetingAttendees] = useState([]);

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState([]);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // Admin Paneli State'leri
  const [usersList, setUsersList] = useState([]);
  const [permDate, setPermDate] = useState(getTodayISO());
  const [datePerms, setDatePerms] = useState([]);
  const [targetUid, setTargetUid] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const [busy, setBusy] = useState(false);

  /* =========================================================
   * VERI YUKLEME
   * ========================================================= */
  const refreshAllData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setGlobalError('');
    try {
      const [mems, meets, atts, greys, perms] = await Promise.all([
        fs.getMembersFS(),
        fs.getMeetingsFS(),
        fs.getAttendanceFS(),
        fs.getGreyListFS(),
        fs.getLogPermissionsForDate(getTodayISO()),
      ]);

      setMembers(mems);
      setMeetings(meets);
      setGreyList(greys);

      // Katılımcı haritasını oluştur
      const newAttendeeMap = {};
      meets.forEach((meeting) => {
        const meetingAtts = atts.filter((a) => a.meetingId === meeting.id || String(a.meetingId) === String(meeting.id));
        const attIds = new Set(meetingAtts.map((a) => a.memberId));
        newAttendeeMap[meeting.id] = mems.filter((m) => attIds.has(m.id) || attIds.has(Number(m.id)));
      });
      setAttendeeMap(newAttendeeMap);

      // İzin kontrolü
      const hasPerm = perms.some((p) => p.targetUid === user.uid);
      setHasTodayPermission(hasPerm);

    } catch (e) {
      setGlobalError('Firebase verileri yüklenirken bir hata oluştu: ' + (e?.message || ''));
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // Auth durumu değişince veya yüklenince verileri çek
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Bugüne ait izinleri canlı dinle (onSnapshot)
  useEffect(() => {
    if (!user) return;
    const today = getTodayISO();
    const unsub = fs.subscribeTodayPermissions(today, (perms) => {
      const hasPerm = perms.some((p) => p.targetUid === user.uid);
      setHasTodayPermission(hasPerm);
    });
    return () => unsub();
  }, [user]);

  // Admin panelinde tarih değiştiğinde izinleri tazele
  useEffect(() => {
    if (user && isAdmin && activeTab === 'admin-panel') {
      fs.getLogPermissionsForDate(permDate).then(setDatePerms).catch(() => {});
      fs.getUsersFS().then(setUsersList).catch(() => {});
    }
  }, [user, isAdmin, permDate, activeTab]);

  /* =========================================================
   * OTOMATIK GRI LISTE KONTROLU (Sadece Admin veya Yetkili trigger eder)
   * ========================================================= */
  useEffect(() => {
    if (!user || (!isAdmin && !hasTodayPermission) || meetings.length < 3 || members.length === 0) return;

    const runAutoGreyListCheck = async () => {
      const sortedMeetings = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));
      const last3Meetings = sortedMeetings.slice(0, 3);
      const last3Ids = last3Meetings.map((m) => m.id);

      let updated = false;

      for (const member of members) {
        if (!member.isActive) continue;

        let attendedAny = false;
        last3Ids.forEach((mId) => {
          const attendees = attendeeMap[mId] || [];
          if (attendees.some((att) => String(att.id) === String(member.id))) {
            attendedAny = true;
          }
        });

        const isCurrentlyGrey = greyList.some((g) => String(g.memberId) === String(member.id));

        if (!attendedAny && !isCurrentlyGrey) {
          await fs.addToGreyListFS(member.id, 'Son 3 toplantıya üst üste katılmadı');
          updated = true;
        } else if (attendedAny && isCurrentlyGrey) {
          await fs.removeFromGreyListFS(member.id);
          updated = true;
        }
      }

      if (updated) {
        fs.getGreyListFS().then(setGreyList);
      }
    };

    runAutoGreyListCheck().catch(() => {});
  }, [meetings, members, attendeeMap, greyList, isAdmin, hasTodayPermission, user]);

  /* =========================================================
   * YETKI KONTROL FONKSIYONLARI
   * ========================================================= */
  const checkLogPermission = (meetingDate) => {
    if (isAdmin) return true;
    const today = getTodayISO();
    // Eğer toplantı tarihi bugünse ve bugün için log izni varsa izin verilir
    return hasTodayPermission && meetingDate === today;
  };

  /* =========================================================
   * MEMBER CRUD (Sadece Admin veya o gün yetkisi olan)
   * ========================================================= */
  const validateMember = () => {
    if (!memberForm.name.trim()) return 'İsim zorunludur.';
    if (!memberForm.email.trim()) return 'E-posta zorunludur.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberForm.email.trim()))
      return 'Geçerli bir e-posta adresi girin.';
    const dup = members.find(
      (m) => m.email.toLowerCase() === memberForm.email.trim().toLowerCase() && m.id !== editingMember?.id
    );
    if (dup) return 'Bu e-posta zaten kayıtlı.';
    return '';
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin && !hasTodayPermission) return;
    const err = validateMember();
    if (err) { setMemberError(err); return; }
    setBusy(true);
    try {
      if (editingMember) {
        await fs.updateMemberFS(editingMember.id, {
          name: memberForm.name.trim(),
          email: memberForm.email.trim().toLowerCase(),
        });
        setEditingMember(null);
      } else {
        await fs.addMemberFS(memberForm);
      }
      setMemberForm({ name: '', email: '' });
      setMemberError('');
      await refreshAllData();
      setActiveTab('members');
    } catch (err) {
      setMemberError('Üye kaydedilirken hata: ' + (err?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const startEditMember = (m) => {
    if (!isAdmin && !hasTodayPermission) return;
    setEditingMember(m);
    setMemberForm({ name: m.name, email: m.email });
    setMemberError('');
    setActiveTab('new-member');
  };

  const cancelEditMember = () => {
    setEditingMember(null);
    setMemberForm({ name: '', email: '' });
    setMemberError('');
    setActiveTab('members');
  };

  const toggleMemberActive = async (m) => {
    if (!isAdmin && !hasTodayPermission) return;
    try {
      await fs.updateMemberFS(m.id, { isActive: !m.isActive });
      await refreshAllData();
    } catch (e) {
      alert('Üye güncellenemedi: ' + e.message);
    }
  };

  const deleteMember = async (id, name) => {
    if (!isAdmin) { alert('Sadece Admin üyeleri silebilir.'); return; }
    if (!window.confirm(`${name} üyesini silmek istediğinize emin misiniz?`)) return;
    try {
      await fs.deleteMemberFS(id);
      await refreshAllData();
    } catch (e) {
      alert('Üye silinemedi: ' + e.message);
    }
  };

  /* =========================================================
   * MEETING CRUD
   * ========================================================= */
  const validateMeeting = () => {
    if (!meetingForm.title.trim()) return 'Başlık zorunludur.';
    if (!meetingForm.date) return 'Tarih zorunludur.';
    if (!meetingForm.gundem.trim()) return 'Gündem ve Konuşulanlar zorunludur.';
    if (!meetingForm.kararlar.trim()) return 'Alınan Kararlar zorunludur.';
    if (!meetingForm.gorevler.trim()) return 'Aksiyon Planı / Görevler zorunludur.';
    return '';
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!checkLogPermission(meetingForm.date)) {
      setMeetingError('Bu tarihteki bir toplantıyı kaydetmek için yetkiniz yok.');
      return;
    }
    const err = validateMeeting();
    if (err) { setMeetingError(err); return; }
    setBusy(true);
    try {
      const payload = {
        title: meetingForm.title.trim(),
        date: meetingForm.date,
        gundem: meetingForm.gundem.trim(),
        kararlar: meetingForm.kararlar.trim(),
        gorevler: meetingForm.gorevler.trim(),
      };

      if (editingMeeting) {
        await fs.updateMeetingFS(editingMeeting.id, payload);
        setEditingMeeting(null);
      } else {
        const newMeet = await fs.addMeetingFS(payload);
        if (newMeet && newMeetingAttendees.length > 0) {
          await fs.addAttendanceFS(newMeet.id, newMeetingAttendees);
        }
        setNewMeetingAttendees([]);
      }

      setMeetingForm({ title: '', date: getTodayISO(), gundem: '', kararlar: '', gorevler: '' });
      setMeetingError('');
      await refreshAllData();
      setActiveTab('meetings');
    } catch (err) {
      setMeetingError('Toplantı kaydedilirken hata: ' + (err?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const startEditMeeting = (m) => {
    if (!checkLogPermission(m.date)) {
      alert('Bu toplantıyı düzenleme yetkiniz yok.');
      return;
    }
    setEditingMeeting(m);
    setMeetingForm({
      title: m.title,
      date: m.date,
      gundem: m.gundem || '',
      kararlar: m.kararlar || '',
      gorevler: m.gorevler || '',
    });
    setMeetingError('');
    setActiveTab('new-meeting');
  };

  const cancelEditMeeting = () => {
    setEditingMeeting(null);
    setMeetingForm({ title: '', date: getTodayISO(), gundem: '', kararlar: '', gorevler: '' });
    setMeetingError('');
    setNewMeetingAttendees([]);
    setActiveTab('meetings');
  };

  const deleteMeeting = async (id, title) => {
    if (!isAdmin) {
      alert('Sadece Admin toplantıları silebilir.');
      return;
    }
    if (!window.confirm(`"${title}" toplantısını silmek istediğinize emin misiniz?`)) return;
    try {
      await fs.deleteMeetingFS(id);
      await refreshAllData();
    } catch (e) {
      alert('Toplantı silinemedi: ' + e.message);
    }
  };

  /* =========================================================
   * YOKLAMA (ATTENDANCE) METOTLARI
   * ========================================================= */
  const openAttendance = (meeting) => {
    if (!checkLogPermission(meeting.date)) {
      alert('Bu toplantının yoklamasını düzenleme yetkiniz yok.');
      return;
    }
    setSelectedMeeting(meeting);
    const attendees = attendeeMap[meeting.id] || [];
    setAttendanceForm(attendees.map((a) => a.id));
  };

  const closeAttendance = () => {
    setSelectedMeeting(null);
    setAttendanceForm([]);
  };

  const toggleAttendee = (memberId) => {
    setAttendanceForm((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveAttendance = async () => {
    if (!selectedMeeting) return;
    setBusy(true);
    try {
      const currentAttendees = (attendeeMap[selectedMeeting.id] || []).map((a) => a.id);
      const toAdd = attendanceForm.filter((id) => !currentAttendees.includes(id));
      const toRemove = currentAttendees.filter((id) => !attendanceForm.includes(id));

      if (toAdd.length) {
        await fs.addAttendanceFS(selectedMeeting.id, toAdd);
      }
      for (const id of toRemove) {
        await fs.removeAttendanceFS(selectedMeeting.id, id);
      }

      await refreshAllData();
      closeAttendance();
    } catch (e) {
      alert('Katılım güncellenirken hata: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
   * ADMIN PANELI METOTLARI
   * ========================================================= */
  const grantPermission = async () => {
    if (!targetUid) { setAdminMsg('Önce kullanıcı seçmelisiniz.'); return; }
    setBusy(true);
    setAdminMsg('');
    try {
      await fs.grantLogPermission(targetUid, permDate);
      setAdminMsg(`${permDate} tarihi için yetki verildi.`);
      const updatedPerms = await fs.getLogPermissionsForDate(permDate);
      setDatePerms(updatedPerms);
    } catch (e) {
      setAdminMsg('Hata: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const revokePermission = async (permId) => {
    if (!window.confirm('Bu günlük yetkiyi iptal etmek istiyor musunuz?')) return;
    setBusy(true);
    try {
      await fs.revokeLogPermission(permId);
      setAdminMsg('Yetki iptal edildi.');
      const updatedPerms = await fs.getLogPermissionsForDate(permDate);
      setDatePerms(updatedPerms);
    } catch (e) {
      setAdminMsg('Hata: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (uid, newRole) => {
    if (!window.confirm(`Kullanıcının veritabanı rolünü "${newRole}" yapmak istiyor musunuz?`)) return;
    setBusy(true);
    try {
      await fs.updateUserRoleFS(uid, newRole);
      setAdminMsg('Kullanıcı veritabanı rolü güncellendi. Not: Tam yetki için Firebase Console custom claims güncellemelisiniz.');
      const u = await fs.getUsersFS();
      setUsersList(u);
    } catch (e) {
      setAdminMsg('Hata: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
   * ARTIKLAR, FILTRELEMELER VE TAKVIM
   * ========================================================= */
  const filteredMembers = members
    .filter((m) => showInactive || m.isActive)
    .filter((m) => {
      if (!search) return true;
      const hay = (m.name + ' ' + m.email).toLowerCase();
      return hay.includes(search.toLowerCase());
    });

  const filteredMeetings = meetings
    .filter((m) => {
      if (!search) return true;
      const hay = (
        m.title + ' ' +
        (m.gundem || '') + ' ' +
        (m.kararlar || '') + ' ' +
        (m.gorevler || '') + ' ' +
        (m.notes || '') + ' ' +
        m.date
      ).toLowerCase();
      return hay.includes(search.toLowerCase());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getCalendarDays = () => {
    const days = [];
    const firstDay = new Date(2022, 0, 1);
    const today = new Date();
    for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days.reverse();
  };

  const dayHasMeeting = (date) => {
    const ds = date.toISOString().split('T')[0];
    return meetings.some((m) => m.date === ds);
  };

  const dayMeetings = (date) => {
    const ds = date.toISOString().split('T')[0];
    return meetings.filter((m) => m.date === ds);
  };

  const activeMemberCount = members.filter((m) => m.isActive).length;
  const totalMeetingCount = meetings.length;
  const averageAttendees =
    meetings.length > 0
      ? Math.round(
          meetings.reduce((sum, m) => {
            const a = attendeeMap[m.id] || [];
            return sum + a.length;
          }, 0) / meetings.length
        )
      : 0;

  /* =========================================================
   * YUKLEME VE HATA EKRANLARI
   * ========================================================= */
  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-purple)' }}>Bufalotek Center</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Sistem yükleniyor, lütfen bekleyin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app">
      {/* ---- HEADER ---- */}
      <header className="header">
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.displayName || 'Kullanıcı'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email} | <span style={{ color: 'var(--accent-blue)', fontWeight: 600, textTransform: 'uppercase' }}>{role || 'user'}</span></div>
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => fs.signOutFS()}>Çıkış Yap</button>
        </div>
        <h1 className="header-title">Bufalotek Center</h1>
        <p className="header-sub">Bilişim Topluluğu — Toplantı Log Sistemi</p>
      </header>

      {/* ---- CANLI IZIN BILDIRIMI (Regular User ise) ---- */}
      {!isAdmin && hasTodayPermission && (
        <div style={{ background: 'var(--success-bg)', borderBottom: '1px solid var(--success-border)', padding: '0.5rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
          ✓ Bugün için Toplantı Logu tutma yetkiniz bulunmaktadır. Toplantı ekleyebilir ve yoklama alabilirsiniz.
        </div>
      )}

      {/* ---- STATS ---- */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{members.length}</span>
          <span className="stat-label">Üye</span>
          <span className="stat-sub">({activeMemberCount} aktif)</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMeetingCount}</span>
          <span className="stat-label">Toplantı</span>
        </div>
        <div className="stat">
          <span className="stat-value">{averageAttendees}</span>
          <span className="stat-label">Ort. Katılım</span>
        </div>
      </div>

      {/* ---- GREY LIST ALERT BANNER ---- */}
      {greyList.length > 0 && (
        <div className="alert-banner" onClick={() => setActiveTab('grey-list')} role="button" tabIndex={0}>
          <span className="alert-icon">⚠</span>
          <span className="alert-text">
            <strong>Sistem Uyarısı:</strong> {greyList.length} üye son 3 toplantıya üst üste katılmadı, gri listeye alındı.
          </span>
          <span className="alert-cta">Görüntüle →</span>
        </div>
      )}

      {globalError && (
        <div style={{ margin: '1rem auto 0 auto', maxWidth: '1000px', width: 'calc(100% - 2rem)' }} className="form-error">
          {globalError}
        </div>
      )}

      {/* ---- SEARCH + TABS ---- */}
      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'meetings' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('meetings')}
          >
            Toplantılar
          </button>
          <button
            className={`tab ${activeTab === 'members' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Üyeler
          </button>
          <button
            className={`tab ${activeTab === 'grey-list' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('grey-list')}
          >
            Gri Liste{greyList.length > 0 && <span className="tab-badge">{greyList.length}</span>}
          </button>
          <button
            className={`tab ${activeTab === 'calendar' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Takvim
          </button>
          {isAdmin && (
            <button
              className={`tab ${activeTab === 'admin-panel' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('admin-panel')}
            >
              Admin Paneli
            </button>
          )}
        </div>
      </div>

      {/* ---- CONTENT ---- */}
      <main className="main-content">
        {loadingData ? (
          <div className="empty-msg" style={{ padding: '4rem 0' }}>Veriler güncelleniyor...</div>
        ) : (
          <>
            {/* === MEETINGS TAB === */}
            {activeTab === 'meetings' && (
              <section className="section">
                <div className="section-header">
                  <h2>Toplantı Listesi</h2>
                  {(isAdmin || hasTodayPermission) && (
                    <button className="btn btn-primary" onClick={() => setActiveTab('new-meeting')}>
                      + Yeni Toplantı
                    </button>
                  )}
                </div>
                {filteredMeetings.length === 0 ? (
                  <p className="empty-msg">
                    {search ? 'Aramanızla eşleşen toplantı bulunamadı.' : 'Henüz toplantı kaydı yok.'}
                  </p>
                ) : (
                  <div className="card-grid">
                    {filteredMeetings.map((m) => {
                      const attendees = attendeeMap[m.id] || [];
                      const canManage = checkLogPermission(m.date);
                      return (
                        <div className="card" key={m.id}>
                          <div className="card-body">
                            <h3 className="card-title">{m.title}</h3>
                            <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                            
                            <div className="notes-grouped">
                              <div className="notes-group">
                                <strong className="notes-group-title">Gündem ve Konuşulanlar:</strong>
                                <p className="notes-group-text">{m.gundem || m.notes || '-'}</p>
                              </div>
                              <div className="notes-group">
                                <strong className="notes-group-title">Alınan Kararlar:</strong>
                                <p className="notes-group-text">{m.kararlar || '-'}</p>
                              </div>
                              <div className="notes-group">
                                <strong className="notes-group-title">Görevler:</strong>
                                <p className="notes-group-text">{m.gorevler || '-'}</p>
                              </div>
                            </div>

                            <div className="card-attendees">
                              <strong>Katılımcılar ({attendees.length}):</strong>
                              {attendees.length > 0 ? (
                                <ul className="attendee-list">
                                  {attendees.map((a) => (
                                    <li key={a.id}>{a.name}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="no-attendees">Henüz katılımcı eklenmedi</span>
                              )}
                            </div>
                          </div>
                          <div className="card-actions">
                            {canManage && (
                              <>
                                <button className="btn btn-sm" onClick={() => openAttendance(m)}>
                                  Katılım Yönet
                                </button>
                                <button className="btn btn-sm" onClick={() => startEditMeeting(m)}>
                                  Düzenle
                                </button>
                              </>
                            )}
                            {isAdmin && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => deleteMeeting(m.id, m.title)}
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* === NEW/EDIT MEETING FORM === */}
            {activeTab === 'new-meeting' && (
              <section className="section">
                <h2>{editingMeeting ? 'Toplantıyı Düzenle' : 'Yeni Toplantı Ekle'}</h2>
                <form className="form" onSubmit={handleMeetingSubmit}>
                  <div className="form-group">
                    <label>Başlık</label>
                    <input
                      type="text"
                      value={meetingForm.title}
                      onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                      placeholder="Toplantı başlığı"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tarih</label>
                    <input
                      type="date"
                      value={meetingForm.date}
                      onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                      disabled={!!editingMeeting && !isAdmin} // logger gününü değiştiremesin
                    />
                  </div>
                  <div className="form-group">
                    <label>Gündem ve Konuşulanlar</label>
                    <textarea
                      rows={4}
                      value={meetingForm.gundem}
                      onChange={(e) => setMeetingForm({ ...meetingForm, gundem: e.target.value })}
                      placeholder="Toplantıda gündeme alınanlar ve konuşulanlar..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Alınan Kararlar</label>
                    <textarea
                      rows={4}
                      value={meetingForm.kararlar}
                      onChange={(e) => setMeetingForm({ ...meetingForm, kararlar: e.target.value })}
                      placeholder="Toplantıda alınan kararlar..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Aksiyon Planı / Görevler</label>
                    <textarea
                      rows={4}
                      value={meetingForm.gorevler}
                      onChange={(e) => setMeetingForm({ ...meetingForm, gorevler: e.target.value })}
                      placeholder="Yapılacak işler, aksiyon kalemleri, sorumlular..."
                    />
                  </div>

                  {/* ---- Yeni toplantıda katılımcı seçimi ---- */}
                  {!editingMeeting && (
                    <div className="form-group">
                      <label>
                        Katılımcılar
                        {newMeetingAttendees.length > 0 && (
                          <span className="attendee-count">{` (${newMeetingAttendees.length} seçili)`}</span>
                        )}
                      </label>
                      <div className="checkbox-list">
                        {members
                          .filter((m) => m.isActive)
                          .map((m) => (
                            <label key={m.id} className="checkbox-item" title={m.email}>
                              <input
                                type="checkbox"
                                checked={newMeetingAttendees.includes(m.id)}
                                onChange={() =>
                                  setNewMeetingAttendees((prev) =>
                                    prev.includes(m.id)
                                      ? prev.filter((id) => id !== m.id)
                                      : [...prev, m.id]
                                  )
                                }
                              />
                              <span>{m.name}</span>
                            </label>
                          ))}
                        {members.filter((m) => m.isActive).length === 0 && (
                          <p className="empty-msg" style={{ padding: '0.5rem 0' }}>
                            Henüz aktif üye yok. Önce üye ekleyin.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {meetingError && <p className="form-error">{meetingError}</p>}
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? 'Kaydediliyor...' : (editingMeeting ? 'Güncelle' : 'Kaydet')}
                    </button>
                    <button type="button" className="btn" onClick={cancelEditMeeting}>
                      İptal
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* === MEMBERS TAB === */}
            {activeTab === 'members' && (
              <section className="section">
                <div className="section-header">
                  <h2>Üye Listesi</h2>
                  <div className="section-header-right">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                      />
                      Pasif üyeleri göster
                    </label>
                  </div>
                </div>
                {(isAdmin || hasTodayPermission) && (
                  <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setActiveTab('new-member')}>
                    + Yeni Üye
                  </button>
                )}
                {filteredMembers.length === 0 ? (
                  <p className="empty-msg">
                    {search ? 'Aramanızla eşleşen üye bulunamadı.' : 'Henüz üye kaydı yok.'}
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>İsim</th>
                          <th>E-posta</th>
                          <th>Durum</th>
                          <th>Katıldığı Toplantı</th>
                          {(isAdmin || hasTodayPermission) && <th>İşlemler</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((m) => {
                          const memberMeetingCount = Object.values(attendeeMap).filter((list) =>
                            list?.some((a) => String(a.id) === String(m.id))
                          ).length;
                          return (
                            <tr key={m.id} className={!m.isActive ? 'row-inactive' : ''}>
                              <td>{m.name}</td>
                              <td>{m.email}</td>
                              <td>
                                <span className={`badge ${m.isActive ? 'badge-active' : 'badge-inactive'}`}>
                                  {m.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                              </td>
                              <td>{memberMeetingCount}</td>
                              {(isAdmin || hasTodayPermission) && (
                                <td className="action-cell">
                                  <button className="btn btn-sm" onClick={() => startEditMember(m)}>
                                    Düzenle
                                  </button>
                                  <button
                                    className={`btn btn-sm ${m.isActive ? 'btn-warn' : 'btn-success'}`}
                                    onClick={() => toggleMemberActive(m)}
                                  >
                                    {m.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                                  </button>
                                  {isAdmin && (
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => deleteMember(m.id, m.name)}
                                    >
                                      Sil
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* === NEW/EDIT MEMBER FORM === */}
            {activeTab === 'new-member' && (
              <section className="section">
                <h2>{editingMember ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle'}</h2>
                <form className="form" onSubmit={handleMemberSubmit}>
                  <div className="form-group">
                    <label>İsim</label>
                    <input
                      type="text"
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="Ad Soyad"
                    />
                  </div>
                  <div className="form-group">
                    <label>E-posta</label>
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="ornek@mail.com"
                    />
                  </div>
                  {memberError && <p className="form-error">{memberError}</p>}
                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? 'Kaydediliyor...' : (editingMember ? 'Güncelle' : 'Kaydet')}
                    </button>
                    <button type="button" className="btn" onClick={cancelEditMember}>
                      İptal
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* === GREY LIST TAB === */}
            {activeTab === 'grey-list' && (
              <section className="section">
                <div className="section-header">
                  <h2>Gri Liste</h2>
                  {meetings.length < 3 && (
                    <span className="info-pill">
                      Gri liste için en az 3 toplantı kaydı gerekli ({meetings.length}/3)
                    </span>
                  )}
                </div>
                <p className="section-desc">
                  Son 3 toplantıya üst üste katılmayan aktif üyeler otomatik olarak gri listeye alınır.
                  Bir üye bir toplantıya katıldığında veya manuel listeden çıkarıldığında listeden otomatik çıkarılır.
                </p>
                {greyList.length === 0 ? (
                  <p className="empty-msg">
                    {meetings.length < 3
                      ? 'Henüz gri liste için yeterli toplantı kaydı yok.'
                      : 'Tüm aktif üyeler son 3 toplantıdan en az birine katılmış. Gri liste boş.'}
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>İsim</th>
                          <th>E-posta</th>
                          <th>Gri Listeye Eklenme</th>
                          <th>Sebep</th>
                          {isAdmin && <th>İşlemler</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {greyList.map((g) => {
                          const member = members.find((m) => String(m.id) === String(g.memberId));
                          if (!member) return null;
                          return (
                            <tr key={g.memberId} className="row-grey">
                              <td>{member.name}</td>
                              <td>{member.email}</td>
                              <td>{g.addedAt?.seconds ? new Date(g.addedAt.seconds * 1000).toLocaleString('tr-TR') : 'Şimdi'}</td>
                              <td className="reason-cell">{g.reason}</td>
                              {isAdmin && (
                                <td className="action-cell">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={async () => {
                                      await fs.removeFromGreyListFS(g.memberId);
                                      fs.getGreyListFS().then(setGreyList);
                                    }}
                                  >
                                    Listeden Çıkar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* === CALENDAR TAB === */}
            {activeTab === 'calendar' && (
              <section className="section">
                <h2>Toplantı Takvimi</h2>
                <div className="calendar-grid">
                  {getCalendarDays().map((day) => {
                    const iso = day.toISOString().split('T')[0];
                    const has = dayHasMeeting(day);
                    const meetingsOnDay = dayMeetings(day);
                    return (
                      <div key={iso} className={`calendar-day ${has ? 'calendar-day-active' : ''}`}>
                        <div className="calendar-date">
                          <span className="calendar-day-num">{day.getDate()}</span>
                          <span className="calendar-month">
                            {day.toLocaleDateString('tr-TR', { month: 'short' })}
                          </span>
                          <span className="calendar-year">{day.getFullYear()}</span>
                        </div>
                        {has && (
                          <div className="calendar-meetings">
                            {meetingsOnDay.map((m) => (
                              <div key={m.id} className="calendar-meeting-dot" title={m.title}>
                                {m.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* === ADMIN PANEL TAB === */}
            {activeTab === 'admin-panel' && isAdmin && (
              <AdminPanel
                users={usersList}
                perms={datePerms}
                permDate={permDate}
                setPermDate={setPermDate}
                targetUid={targetUid}
                setTargetUid={setTargetUid}
                adminMsg={adminMsg}
                grantPermission={grantPermission}
                revokePermission={revokePermission}
                handleRoleChange={handleRoleChange}
                busy={busy}
              />
            )}
          </>
        )}
      </main>

      {/* ---- ATTENDANCE MODAL ---- */}
      {selectedMeeting && (
        <div className="modal-overlay" onClick={closeAttendance}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Katılım Yönetimi — {selectedMeeting.title}</h2>
            <p className="modal-date">
              {new Date(selectedMeeting.date).toLocaleDateString('tr-TR')}
            </p>
            <div className="attendance-list">
              {members
                .filter((m) => m.isActive)
                .map((m) => {
                  const isChecked = attendanceForm.includes(m.id) || attendanceForm.includes(Number(m.id));
                  return (
                    <label
                      key={m.id}
                      className={`attendance-item ${isChecked ? 'attendance-item-checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAttendee(m.id)}
                      />
                      <span className="attendance-status-icon">
                        {isChecked ? '✓' : '✗'}
                      </span>
                      <span>{m.name}</span>
                      <span className="attendance-email">{m.email}</span>
                    </label>
                  );
                })}
              {members.filter((m) => m.isActive).length === 0 && (
                <p className="empty-msg">Henüz aktif üye yok.</p>
              )}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveAttendance} disabled={busy}>
                {busy ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button className="btn" onClick={closeAttendance}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- FOOTER ---- */}
      <footer className="footer">
        <p>Bufalotek Center &copy; {new Date().getFullYear()} — Firebase Firestore tabanlı, Rol Yetkilendirmeli</p>
      </footer>
    </div>
  );
}

/* =========================================================
 * AUTH SCREEN (LOGIN & SIGNUP)
 * ========================================================= */
const AuthScreen = () => {
  const { authError, resetAuthError } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    resetAuthError();
    if (!email.trim() || !password) {
      setError('Tüm alanları doldurun.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await fs.signInFS(email.trim(), password);
      } else {
        if (!name.trim()) throw new Error('İsim zorunludur.');
        if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        await fs.signUpFS(email.trim(), password, name.trim());
      }
    } catch (err) {
      let msg = err?.message || 'Bir hata oluştu';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password')) {
        msg = 'E-posta veya şifre hatalı.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'Bu e-posta zaten kayıtlı.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Geçersiz e-posta adresi.';
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Bufalotek Center</h1>
        <p className="auth-sub">Bilişim Topluluğu — Toplantı Log Sistemi</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >Giriş</button>
          <button
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
          >Kayıt Ol</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label>İsim</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" />
            </div>
          )}
          <div className="form-group">
            <label>E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@mail.com" />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••••••" />
          </div>
          {(error || authError) && <p className="form-error">{error || authError}</p>}
          <button type="submit" className="btn btn-primary auth-submit" style={{ width: '100%', marginTop: '0.5rem' }} disabled={busy}>
            {busy ? 'Bekleyin...' : (mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol')}
          </button>
        </form>

        <p className="auth-hint">
          Sistem tamamen Firebase Firestore korumalıdır. İlk kullanıcı kaydından sonra Firebase console üzerinden rol ataması yapılması gerekir.
        </p>
      </div>
    </div>
  );
};

/* =========================================================
 * ADMIN PANEL COMPONENT
 * ========================================================= */
const AdminPanel = ({
  users, perms, permDate, setPermDate, targetUid, setTargetUid,
  adminMsg, grantPermission, revokePermission, handleRoleChange, busy
}) => {
  return (
    <section className="section">
      <h2>Admin Paneli</h2>
      <p className="section-desc">
        Admin yetkilerini ve kullanıcıların günlük log tutma (toplantı ve yoklama ekleme/düzenleme) izinlerini buradan yönetebilirsiniz.
      </p>

      {adminMsg && <div className="info-pill" style={{ display: 'inline-block', marginBottom: '1rem', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>{adminMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', color: 'var(--accent-purple)' }}>A. Kullanıcı Rolleri</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>İsim</th><th>E-posta</th><th>Rol</th><th>Aksiyon</th></tr>
              </thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan={4} className="empty-msg">Kullanıcı yok.</td></tr>}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || 'İsimsiz'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-inactive'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="action-cell">
                      {u.role !== 'admin' ? (
                        <button className="btn btn-sm btn-success" onClick={() => handleRoleChange(u.id, 'admin')} disabled={busy}>Admin Yap</button>
                      ) : (
                        <button className="btn btn-sm btn-danger" onClick={() => handleRoleChange(u.id, 'user')} disabled={busy}>User Yap</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', color: 'var(--accent-blue)' }}>B. Günlük Log İzni</h3>
          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Tarih</label>
              <input type="date" value={permDate} onChange={(e) => setPermDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Kullanıcı</label>
              <select value={targetUid} onChange={(e) => setTargetUid(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: '6px' }}>
                <option value="">Seçiniz...</option>
                {users.filter(u => u.role !== 'admin').map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={grantPermission} style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Veriliyor...' : 'Log Tutma İzni Ver'}
            </button>
          </div>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>İzin Atanan Kişiler ({permDate})</h4>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Kullanıcı</th><th>İşlem</th></tr>
              </thead>
              <tbody>
                {perms.length === 0 && <tr><td colSpan={2} className="empty-msg">Bu tarihte izinli üye yok.</td></tr>}
                {perms.map((p) => {
                  const matchedUser = users.find((u) => String(u.id) === String(p.targetUid));
                  return (
                    <tr key={p.id}>
                      <td>{matchedUser ? matchedUser.name : p.targetUid}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => revokePermission(p.id)} disabled={busy}>İptal Et</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default App;