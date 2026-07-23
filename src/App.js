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
  const [notifs, setNotifs] = useState([]);
  const [hasTodayPermission, setHasTodayPermission] = useState(false);

  const [activeTab, setActiveTab] = useState('meetings');
  const [loadingData, setLoadingData] = useState(true);
  const [globalError, setGlobalError] = useState('');

  // Toplantı Form State'leri
  const [meetingForm, setMeetingForm] = useState({ title: '', date: getTodayISO(), gundem: '', kararlar: '', gorevler: '' });
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [meetingError, setMeetingError] = useState('');
  const [newMeetingAttendees, setNewMeetingAttendees] = useState([]);

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState([]);

  const [search, setSearch] = useState('');

  // Admin Paneli State'leri
  const [usersList, setUsersList] = useState([]);
  const [permDate, setPermDate] = useState(getTodayISO());
  const [datePerms, setDatePerms] = useState([]);
  const [targetUid, setTargetUid] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const [busy, setBusy] = useState(false);

  /* =========================================================
   * BİLDİRİM OKUMA / YAZMA
   * ========================================================= */
  const refreshNotifs = useCallback(() => {
    if (user) {
      setNotifs(fs.getNotifs(user.uid));
    }
  }, [user]);

  useEffect(() => {
    refreshNotifs();
    const interval = setInterval(refreshNotifs, 10000);
    return () => clearInterval(interval);
  }, [refreshNotifs]);

  const handleMarkNotifRead = (id) => {
    if (user) {
      fs.markNotifRead(user.uid, id);
      refreshNotifs();
    }
  };

  const handleClearNotifs = () => {
    if (user) {
      fs.clearNotifs(user.uid);
      refreshNotifs();
    }
  };

  /* =========================================================
   * VERİ YÜKLEME
   * ========================================================= */
  const refreshAllData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setGlobalError('');
    try {
      const [mems, meets, atts, greys, perms, usersSnap] = await Promise.all([
        fs.getMembersFS(),
        fs.getMeetingsFS(),
        fs.getAttendanceFS(),
        fs.getGreyListFS(),
        fs.getLogPermissionsForDate(getTodayISO()),
        fs.getUsersFS(),
      ]);

      // Eksik kullanıcıları members'a otomatik ekle
      const memberUidSet = new Set(mems.map((m) => String(m.id)));
      for (const u of usersSnap) {
        if (!memberUidSet.has(String(u.id))) {
          await fs.addMemberFS({ name: u.name || 'İsimsiz', email: u.email }, u.id);
        }
      }

      // Güncel members listesini tekrar çek
      const updatedMems = await fs.getMembersFS();
      setMembers(updatedMems);
      setMeetings(meets);
      setGreyList(greys);

      // Katılımcı haritasını oluştur
      const newAttendeeMap = {};
      meets.forEach((meeting) => {
        const meetingAtts = atts.filter((a) => a.meetingId === meeting.id || String(a.meetingId) === String(meeting.id));
        const attIds = new Set(meetingAtts.map((a) => a.memberId));
        newAttendeeMap[meeting.id] = updatedMems.filter((m) => attIds.has(m.id) || attIds.has(String(m.id)));
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

  // Admin panelinde veri değişimi
  useEffect(() => {
    if (user && isAdmin && activeTab === 'admin-panel') {
      fs.getLogPermissionsForDate(permDate).then(setDatePerms).catch(() => {});
      fs.getUsersFS().then(setUsersList).catch(() => {});
    }
  }, [user, isAdmin, permDate, activeTab]);

  /* =========================================================
   * OTOMATİK GRİ LİSTE VE BİLDİRİM ENTREGASYONU
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
          // Gri listeye ekle
          await fs.addToGreyListFS(member.id, 'Son 3 toplantıya üst üste katılmadı');
          
          // Üyeye bildirim gönder
          fs.addNotif(member.id, 'Sistem Uyarısı: Son 3 toplantıya üst üste katılmadığınız için Gri Liste\'ye eklendiniz!', 'warning');
          
          // Adminlere bildirim gönder
          await fs.pushNotifToAdmins(`Sistem Uyarısı: ${member.name} (${member.email}) son 3 toplantıya üst üste katılmadığı için gri listeye eklendi!`, 'warning');
          
          updated = true;
        } else if (attendedAny && isCurrentlyGrey) {
          // Gri listeden çıkar
          await fs.removeFromGreyListFS(member.id);
          
          // Üyeye bildirim gönder
          fs.addNotif(member.id, 'Sistem Bilgisi: Toplantı katılımınız nedeniyle Gri Liste\'den çıkarıldınız. Teşekkürler!', 'info');
          
          updated = true;
        }
      }

      if (updated) {
        fs.getGreyListFS().then(setGreyList);
        refreshNotifs();
      }
    };

    runAutoGreyListCheck().catch(() => {});
  }, [meetings, members, attendeeMap, greyList, isAdmin, hasTodayPermission, user, refreshNotifs]);

  /* =========================================================
   * YETKİ KONTROL FONKSİYONLARI
   * ========================================================= */
  const checkLogPermission = (meetingDate) => {
    if (isAdmin) return true;
    const today = getTodayISO();
    return hasTodayPermission && meetingDate === today;
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
        
        // BÜTÜN ÜYELERE TOPLANTI BİLDİRİMİ GÖNDER
        await fs.pushNotifAllMembers(`Yeni Toplantı Eklendi: ${payload.title} (${new Date(payload.date).toLocaleDateString('tr-TR')})`, 'meeting');
        
        setNewMeetingAttendees([]);
      }

      setMeetingForm({ title: '', date: getTodayISO(), gundem: '', kararlar: '', gorevler: '' });
      setMeetingError('');
      await refreshAllData();
      refreshNotifs();
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
      fs.addNotif(targetUid, `Tebrikler! Admin tarafından ${new Date(permDate).toLocaleDateString('tr-TR')} tarihi için Toplantı Logu yazma izni aldınız.`, 'info');
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

  const handleToggleUserActive = async (uid, currentActive) => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await fs.updateMemberFS(uid, { isActive: !currentActive });
      setAdminMsg('Kullanıcı aktiflik durumu güncellendi.');
      await refreshAllData();
    } catch (e) {
      setAdminMsg('Hata: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
   * PROFİL & İSTATİSTİK HESAPLAMA
   * ========================================================= */
  const getProfileStats = () => {
    if (!user) return { attended: 0, missed: 0, total: 0, rate: 0, history: [] };

    let attended = 0;
    let missed = 0;
    const history = [];

    // Toplantıları tarihe göre sıralayalım
    const sortedMeetings = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedMeetings.forEach((m) => {
      const attendees = attendeeMap[m.id] || [];
      const didAttend = attendees.some((a) => String(a.id) === String(user.uid));

      if (didAttend) {
        attended++;
      } else {
        missed++;
      }

      history.push({
        id: m.id,
        title: m.title,
        date: m.date,
        attended: didAttend,
      });
    });

    const total = meetings.length;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 100;

    return { attended, missed, total, rate, history };
  };

  const profileStats = getProfileStats();

  /* =========================================================
   * ARTIKLAR, FİLTRELEMELER VE TAKVİM
   * ========================================================= */
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

  const unreadNotifCount = notifs.filter((n) => !n.read).length;

  /* =========================================================
   * YÜKLEME VE HATA EKRANLARI
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

      {/* ---- CANLI İZİN BİLDİRİMİ ---- */}
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
          <button
            className={`tab ${activeTab === 'profile' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profil{unreadNotifCount > 0 && <span className="tab-badge" style={{ background: 'var(--accent-blue)' }}>{unreadNotifCount}</span>}
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

            {/* === PROFIL TAB (Yeni Eklenen) === */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* A. Profil Detayı & İstatistikler */}
                <div className="section" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
                      {user.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{user.displayName}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{user.email}</p>
                    <span className="badge badge-active" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                      {role || 'user'}
                    </span>

                    <div style={{ marginTop: '2rem', width: '100%' }}>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>KATILIM ORANI</strong>
                      <div style={{ background: 'var(--bg-tertiary)', height: '24px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                        <div style={{ width: `${profileStats.rate}%`, background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))', height: '100%', borderRadius: '12px', transition: 'width 0.5s ease-out' }} />
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>%{profileStats.rate}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-purple)' }}>Toplantı Katılım İstatistikleriniz</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-blue)', display: 'block' }}>{profileStats.total}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Toplam Toplantı</span>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)', display: 'block' }}>{profileStats.attended}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Katıldığınız</span>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)', display: 'block' }}>{profileStats.missed}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kaçırdığınız</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--accent-blue)' }}>Katılım Geçmişiniz</h3>
                    <div className="table-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr><th>Toplantı</th><th>Tarih</th><th>Durum</th></tr>
                        </thead>
                        <tbody>
                          {profileStats.history.length === 0 && (
                            <tr><td colSpan={3} className="empty-msg">Kayıtlı toplantı yok.</td></tr>
                          )}
                          {profileStats.history.map((h) => (
                            <tr key={h.id}>
                              <td>{h.title}</td>
                              <td>{new Date(h.date).toLocaleDateString('tr-TR')}</td>
                              <td>
                                <span className={`badge ${h.attended ? 'badge-active' : 'badge-inactive'}`}>
                                  {h.attended ? '✓ Katıldı' : '✗ Katılmadı'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* B. Bildirimler Bölümü */}
                <div className="section">
                  <div className="section-header">
                    <h2>Bildirimler {unreadNotifCount > 0 && <span className="tab-badge" style={{ background: 'var(--danger)', display: 'inline-block' }}>{unreadNotifCount}</span>}</h2>
                    {notifs.length > 0 && (
                      <div className="section-header-right">
                        <button className="btn btn-sm btn-danger" onClick={handleClearNotifs}>Bildirimleri Temizle</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {notifs.length === 0 ? (
                      <p className="empty-msg" style={{ padding: '2rem 0' }}>Hiç bildiriminiz yok.</p>
                    ) : (
                      notifs.map((n) => {
                        let icon = 'ℹ️';
                        let borderStyle = '1px solid var(--border-color)';
                        if (n.type === 'warning') { icon = '⚠️'; borderStyle = '1px solid var(--warn-border)'; }
                        if (n.type === 'meeting') { icon = '📅'; borderStyle = '1px solid rgba(88,166,255,0.4)'; }
                        return (
                          <div
                            key={n.id}
                            onClick={() => handleMarkNotifRead(n.id)}
                            style={{
                              background: n.read ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                              border: borderStyle,
                              borderRadius: '8px',
                              padding: '0.75rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              cursor: 'pointer',
                              opacity: n.read ? 0.7 : 1,
                              transition: 'all 0.15s'
                            }}
                          >
                            <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, fontWeight: n.read ? 'normal' : 'bold' }}>{n.message}</p>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(n.created).toLocaleString('tr-TR')}</span>
                            </div>
                            {!n.read && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }} title="Okunmadı" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* === ADMIN PANEL TAB === */}
            {activeTab === 'admin-panel' && isAdmin && (
              <AdminPanel
                users={usersList}
                members={members}
                perms={datePerms}
                permDate={permDate}
                setPermDate={setPermDate}
                targetUid={targetUid}
                setTargetUid={setTargetUid}
                adminMsg={adminMsg}
                grantPermission={grantPermission}
                revokePermission={revokePermission}
                handleRoleChange={handleRoleChange}
                handleToggleUserActive={handleToggleUserActive}
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
  users, members, perms, permDate, setPermDate, targetUid, setTargetUid,
  adminMsg, grantPermission, revokePermission, handleRoleChange, handleToggleUserActive, busy
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
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', color: 'var(--accent-purple)' }}>A. Kullanıcı Rolleri & Aktiflik</h3>
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
                      {((mbr) =>
                        mbr && (
                          <button
                            className={`btn btn-sm ${mbr.isActive ? 'btn-warn' : 'btn-success'}`}
                            onClick={() => handleToggleUserActive(u.id, mbr.isActive)}
                            disabled={busy}
                          >
                            {mbr.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        )
                      )(members.find((m) => String(m.id) === String(u.id)))}
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