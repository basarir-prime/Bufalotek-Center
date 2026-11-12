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

  const [activeTab, setActiveTab] = useState('profile');
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
   * KİŞİSEL DASHBOARD STATE
   * ========================================================= */
  const [userDepartments, setUserDepartments] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [userTasks, setUserTasks] = useState([]);

  /* =========================================================
   * DEPARTMAN STATE VE YAPILANDIRMA
   * ========================================================= */
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [deptViewMode, setDeptViewMode] = useState('list'); // 'list' | 'detail'

  const DEPARTMENT_CONFIG = [
    {
      id: 'proje',
      name: 'Proje Departmanı',
      color: '#3b82f6',
      icon: 'project',
      desc: 'Proje yönetimi, planlama ve takip işlemleri',
    },
    {
      id: 'donanim',
      name: 'Donanım Departmanı',
      color: '#ef4444',
      icon: 'hardware',
      desc: 'Donanım altyapısı, cihaz bakımı ve teknik destek',
    },
    {
      id: 'yazilim',
      name: 'Yazılım Departmanı',
      color: '#10b981',
      icon: 'code',
      desc: 'Yazılım geliştirme, kodlama ve sistem yazılımı',
    },
    {
      id: 'pr',
      name: 'PR Departmanı',
      color: '#8b5cf6',
      icon: 'megaphone',
      desc: 'Halkla ilişkiler, iletişim ve marka image çalışmaları',
    },
    {
      id: 'grafik',
      name: 'Grafik Tasarım Departmanı',
      color: '#ec4899',
      icon: 'palette',
      desc: 'Görsel tasarım, marka kimliği ve grafik işleri',
    },
  ];

  const DEPT_ICONS = {
    project: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2v18h18V2H3zM5 4h14v16H5V4zM7 8h10v12H7V8z" fill="currentColor"/></svg>`,
    hardware: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>`,
    code: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5z" fill="currentColor"/></svg>`,
    megaphone: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c-4 0-8 .5-8 4v12c0 3.5 4 4 8 4s8-.5 8-4V6c0-3.5-4-4-8-4zM4 13c0-1.1.9-2 2-2s2 .9 2 2c0 .6-.4 1-1 1s-1-.4-1-1zM20 13c0-1.1.9-2 2-2s2 .9 2 2c0 .6-.4 1-1 1s-1-.4-1-1z" fill="currentColor"/></svg>`,
    palette: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 16.83C7.89 18.83 4 14.91 4 11s3.89-7.83 8-7.83c3.64 0 6.89 2.45 7.83 5.91l1.28-3.86c-.92-3.05-3.73-5.25-7.07-5.9C12.76 3.14 10.47 2 8 2 4.69 2 2 4.69 2 8s2.69 6 6 6c2.47 0 4.76-1.14 6.24-2.91l1.29 3.88c-.93 3.46-4.15 5.91-7.53 5.91" fill="currentColor"/></svg>`,
  };

  const getDeptIcon = (iconName) => DEPT_ICONS[iconName] || DEPT_ICONS.project;
  const [newTask, setNewTask] = useState({ title: '', dueDate: '' });

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
      const [mems, meets, atts, greys, perms, usersSnap, freshDeps, projs, userDeps, userProjs, userTsks] = await Promise.all([
        fs.getMembersFS(),
        fs.getMeetingsFS(),
        fs.getAttendanceFS(),
        fs.getGreyListFS(),
        fs.getLogPermissionsForDate(getTodayISO()),
        fs.getUsersFS(),
        fs.getDepartmentsFS(),
        fs.getProjectsFS(),
        fs.getUserDepartmentsFS(),
        fs.getUserProjectsFS(),
        fs.getUserTasksFS(user.uid),
      ]);

      // Eksik kullanıcıları members'a otomatik ekle
      const memberUidSet = new Set(mems.map((m) => String(m.id)));
      for (const u of usersSnap) {
        if (!memberUidSet.has(String(u.id))) {
          await fs.addMemberFS({ name: u.name || 'İsimsiz', email: u.email }, u.id);
        }
      }

      // Departmanları başlat (ilk kurulumda)
      await fs.initDepartmentsFS();

      // Güncel members listesini tekrar çek
      const updatedMems = await fs.getMembersFS();
      setMembers(updatedMems);
      setMeetings(meets);
      setGreyList(greys);
      setUserDepartments(userDeps.map((ud) => ({ ...ud, departmentName: freshDeps.find((d) => String(d.id) === String(ud.departmentId))?.name || '' })));
      setUserProjects(userProjs.map((up) => ({ ...up, projectName: projs.find((p) => String(p.id) === String(up.projectId))?.name || '' })));
      setUserTasks(userTsks);

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

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    setBusy(true);
    try {
      await fs.addTaskFS({
        userId: user.uid,
        title: newTask.title,
        description: '',
        dueDate: newTask.dueDate,
        priority: 'medium',
        status: 'pending',
      });
      setNewTask({ title: '', dueDate: '' });
      setUserTasks([...userTasks, {}]); // placeholder, refresh will update
      await fs.getUserTasksFS(user.uid).then(setUserTasks);
    } catch (e) {
      alert('Görev eklenemedi: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const attendedMeetings = meetings.filter((m) => {
    const attendees = attendeeMap[m.id] || [];
    return attendees.some((a) => String(a.id) === String(user.uid));
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  /* =========================================================
   * ARTIKLAR, FİLTRELEMELER VE TAKVİM
   * ========================================================= */
  const todayISO = getTodayISO();

  const upcomingMeetings = meetings
    .filter((m) => m.date >= todayISO)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastMeetings = meetings
    .filter((m) => m.date < todayISO)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
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
    });

  const getCalendarDays = () => {
    const days = [];
    const firstDay = new Date(2022, 0, 1);
    const today = new Date();
    for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days.reverse();
  };

  const dayMeetings = (date) => {
    const ds = date.toISOString().split('T')[0];
    return meetings.filter((m) => m.date === ds);
  };

  const dayStatus = (date) => {
    const ds = date.toISOString().split('T')[0];
    const ms = meetings.filter((m) => m.date === ds);
    if (ms.length === 0) return 'none';
    // Bugün veya gelecekse: planlı
    if (ds >= todayISO) return 'upcoming';
    // Geçmiş: katıldıysa success, kaçıracaksa danger
    const meeting = ms[0];
    const atts = attendeeMap[meeting.id] || [];
    const didAttend = atts.some((a) => String(a.id) === String(user.uid));
    return didAttend ? 'attended' : 'missed';
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
            className={`tab ${activeTab === 'departments' ? 'tab-active' : ''}`}
            onClick={() => { setActiveTab('departments'); setDeptViewMode('list'); setSelectedDepartment(null); }}
          >
            Departmanlar
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
                  <h2>Toplantılar</h2>
                  {(isAdmin || hasTodayPermission) && (
                    <button className="btn btn-primary" onClick={() => setActiveTab('new-meeting')}>
                      + Yeni Toplantı
                    </button>
                  )}
                </div>

                {/* GELECEK TOPLANTILAR */}
                {upcomingMeetings.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '1.5rem', fontSize: '1.1rem', color: 'var(--accent-blue)' }}>
                      📅 Gelecek Toplantılar
                    </h3>
                    <div className="card-grid">
                      {upcomingMeetings.map((m) => {
                        const attendees = attendeeMap[m.id] || [];
                        const canManage = checkLogPermission(m.date);
                        return (
                          <div className="card" key={m.id}>
                            <div className="card-body">
                              <h3 className="card-title">{m.title}</h3>
                              <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                              <p className="card-notes" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{m.gundem || m.notes || '-'}</p>
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
                  </>
                )}

                {/* GEÇMİŞ TOPLANTILAR */}
                {pastMeetings.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '2rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                      📋 Geçmiş Toplantılar
                    </h3>
                    <div className="card-grid">
                      {pastMeetings.map((m) => {
                        const attendees = attendeeMap[m.id] || [];
                        const didAttend = attendees.some((a) => String(a.id) === String(user.uid));
                        const canManage = checkLogPermission(m.date);
                        return (
                          <div className={`card ${didAttend ? '' : 'row-grey'}`} key={m.id}>
                            <div className="card-body">
                              <h3 className="card-title">{m.title}</h3>
                              <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                              <span className={`badge ${didAttend ? 'badge-active' : 'badge-inactive'}`} style={{ marginLeft: '0.5rem' }}>
                                {didAttend ? 'Katıldınız' : 'Katılmadınız'}
                              </span>
                              <p className="card-notes" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{m.gundem || m.notes || '-'}</p>
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
                  </>
                )}

                {upcomingMeetings.length === 0 && pastMeetings.length === 0 && (
                  <p className="empty-msg">
                    {search ? 'Aramanızla eşleşen toplantı bulunamadı.' : 'Henüz toplantı kaydı yok.'}
                  </p>
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
                    const status = dayStatus(day);
                    const meetingsOnDay = dayMeetings(day);
                    const statusClass =
                      status === 'attended' ? 'calendar-day-attended' :
                      status === 'missed' ? 'calendar-day-missed' :
                      status === 'upcoming' ? 'calendar-day-upcoming' : '';
                    return (
                      <div key={iso} className={`calendar-day ${statusClass}`}>
                        <div className="calendar-date">
                          <span className="calendar-day-num">{day.getDate()}</span>
                          <span className="calendar-month">
                            {day.toLocaleDateString('tr-TR', { month: 'short' })}
                          </span>
                          <span className="calendar-year">{day.getFullYear()}</span>
                        </div>
                        {status !== 'none' && (
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

            {/* === PROFIL TAB (Kişisel Dashboard) === */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* A. KİŞİSEL BİLGİLER */}
                <div className="section">
                  <h2>Kişisel Bilgiler</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div className="profile-card">
                      <div className="profile-avatar">
                        {user.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
                      </div>
                      <h3>{user.displayName}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user.email}</p>
                      <span className="badge badge-active" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                        {role || 'user'}
                      </span>
                    </div>

                    <div className="profile-card">
                      <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>Departmanlar</h4>
                      {userDepartments.length > 0 ? (
                        <ul className="profile-list">
                          {userDepartments.map((d) => (
                            <li key={d.departmentId}>
                              <span className="badge badge-active">{d.departmentName}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="empty-msg" style={{ fontSize: '0.85rem' }}>Departman atanmamış.</p>
                      )}
                    </div>

                    <div className="profile-card">
                      <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Projeler</h4>
                      {userProjects.length > 0 ? (
                        <ul className="profile-list">
                          {userProjects.map((p) => (
                            <li key={p.projectId}>
                              <span className="badge badge-active">{p.projectName}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="empty-msg" style={{ fontSize: '0.85rem' }}>Proje atanmamış.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* B. TOPLANTI TAKVIMI (Kişiye Özel) */}
                <div className="section">
                  <h2>Toplantı Takvimi</h2>
                  <div className="calendar-grid">
                    {getCalendarDays().map((day) => {
                      const iso = day.toISOString().split('T')[0];
                      const status = dayStatus(day);
                      const meetingsOnDay = dayMeetings(day);
                      const statusClass =
                        status === 'attended' ? 'calendar-day-attended' :
                        status === 'missed' ? 'calendar-day-missed' :
                        status === 'upcoming' ? 'calendar-day-upcoming' : '';
                      return (
                        <div key={iso} className={`calendar-day ${statusClass}`}>
                          <div className="calendar-date">
                            <span className="calendar-day-num">{day.getDate()}</span>
                            <span className="calendar-month">
                              {day.toLocaleDateString('tr-TR', { month: 'short' })}
                            </span>
                            <span className="calendar-year">{day.getFullYear()}</span>
                          </div>
                          {status !== 'none' && (
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
                </div>

                {/* C. YAPACAK GÖREVLER */}
                <div className="section">
                  <div className="section-header">
                    <h2>Yapılacak Görevler</h2>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>Görev</th><th>Açıklama</th><th>Bitiş</th><th>Öncelik</th><th>Durum</th></tr>
                      </thead>
                      <tbody>
                        {userTasks.length === 0 && (
                          <tr><td colSpan={5} className="empty-msg">Henüz görev yok.</td></tr>
                        )}
                        {userTasks.map((t) => (
                          <tr key={t.id}>
                            <td>{t.title}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.description || '-'}</td>
                            <td>{t.dueDate || '-'}</td>
                            <td>
                              <span className={`badge ${t.priority === 'high' ? 'badge-active' : 'badge-inactive'}`}>
                                {t.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${t.status === 'completed' ? 'badge-active' : 'badge-inactive'}`}>
                                {t.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Yeni Görev Ekle</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="search-input"
                        type="text"
                        value={newTask.title}
                        placeholder="Görev başlığı"
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      />
                      <input
                        className="search-input"
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      />
                      <button className="btn btn-sm btn-primary" onClick={addTask}>
                        Ekle
                      </button>
                    </div>
                  </div>
                </div>

                {/* D. GELECEK ETKINLIKLER */}
                <div className="section">
                  <h2>Gelecek Etkinlikler</h2>
                  <div className="card-grid">
                    {upcomingMeetings.length === 0 && (
                      <p className="empty-msg">Gelecek etkinlik yok.</p>
                    )}
                    {upcomingMeetings.map((m) => {
                      const didAttend = attendeeMap[m.id]?.some((a) => String(a.id) === String(user.uid));
                      return (
                        <div className="card" key={m.id}>
                          <div className="card-body">
                            <h3 className="card-title">{m.title}</h3>
                            <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                            <p className="card-notes" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{m.gundem || m.notes || '-'}</p>
                            <span className={`badge ${didAttend ? 'badge-active' : 'badge-inactive'}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                              {didAttend ? 'Katılımınız Onaylandı' : 'Henüz Onaylanmadı'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* E. KATILDIĞI ETKINLIKLER */}
                <div className="section">
                  <h2>Katıldığım Etkinlikler</h2>
                  <div className="card-grid">
                    {attendedMeetings.length === 0 && (
                      <p className="empty-msg">Henüz hiçbir etkinliğe katılmadınız.</p>
                    )}
                    {attendedMeetings.map((m) => (
                      <div className="card" key={m.id}>
                        <div className="card-body">
                          <h3 className="card-title">{m.title}</h3>
                          <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                          <span className="badge badge-active">✓ Katıldınız</span>
                          <p className="card-notes" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{m.kararlar || m.notes || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* F. BİLDİRİMLER */}
                <div className="section">
                  <div className="section-header">
                    <h2>Bildirimler {unreadNotifCount > 0 && <span className="tab-badge" style={{ background: 'var(--danger)', display: 'inline-block' }}>{unreadNotifCount}</span>}</h2>
                    {notifs.length > 0 && (
                      <div className="section-header-right">
                        <button className="btn btn-sm btn-danger" onClick={handleClearNotifs}>Temizle</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
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

            {/* === DEPARTMANLAR LISTESİ === */}
            {activeTab === 'departments' && deptViewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="section">
                  <div className="section-header">
                    <h2>Departmanlar</h2>
                    <button className="btn btn-sm" onClick={() => setDeptViewMode('list')}>Tüm Departmanlar</button>
                  </div>
                  <p className="section-desc">
                    Departman bazlı toplantı, görev ve etkinlik takibi. Bir departmana tıklayarak içeriğini görüntüleyebilirsiniz.
                  </p>
                  <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {DEPARTMENT_CONFIG.map((dept) => {
                      const deptMembers = members.filter((m) => {
                        const ud = userDepartments.find((ud) => String(ud.departmentId) === dept.id && String(ud.uid) === String(m.id));
                        return !!ud;
                      });
                      return (
                        <div
                          key={dept.id}
                          className="card"
                          onClick={() => { setSelectedDepartment(dept); setDeptViewMode('detail'); }}
                          style={{ cursor: 'pointer', borderTop: `4px solid ${dept.color}`, transition: 'transform 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div className="card-body" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                              position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
                              background: dept.color, borderRadius: '50%', opacity: 0.15, filter: 'blur(20px)'
                            }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: dept.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: dept.color
                              }} dangerouslySetInnerHTML={{ __html: getDeptIcon(dept.icon) }} />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                {dept.name.replace(' Departmanı', '')}
                              </span>
                            </div>
                            <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                              {dept.name}
                            </h3>
                            <p className="card-notes" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                              {dept.desc}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="badge badge-active" style={{ background: dept.color + '15', color: dept.color, border: '1px solid ' + dept.color + '40', fontSize: '0.75rem' }}>
                                {deptMembers.length} Üye
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Detaya git →</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === DEPARTMAN DETAY === */}
            {activeTab === 'departments' && deptViewMode === 'detail' && selectedDepartment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <button className="btn btn-sm" onClick={() => setDeptViewMode('list')} style={{ marginRight: 'auto' }}>
                      ← Geri
                    </button>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      background: selectedDepartment.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', boxShadow: '0 4px 12px ' + selectedDepartment.color + '40'
                    }} dangerouslySetInnerHTML={{ __html: getDeptIcon(selectedDepartment.icon) }} />
                    <div>
                      <h1 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--text-primary)' }}>{selectedDepartment.name}</h1>
                      <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {selectedDepartment.desc} · {members.filter((m) => userDepartments.some((ud) => String(ud.departmentId) === selectedDepartment.id && String(ud.uid) === String(m.id))).length} üye
                      </p>
                    </div>
                  </div>

                  {/* Departman İstatistikleri */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toplantı</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent-blue)', marginTop: '0.25rem' }}>
                        {meetings.filter((m) => m.gundem?.includes(selectedDepartment.name) || m.notes?.includes(selectedDepartment.name)).length}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Üye</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: selectedDepartment.color, marginTop: '0.25rem' }}>
                        {members.filter((m) => userDepartments.some((ud) => String(ud.departmentId) === selectedDepartment.id && String(ud.uid) === String(m.id))).length}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Görev</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent-purple)', marginTop: '0.25rem' }}>
                        {userTasks.filter((t) => t.title?.includes(selectedDepartment.name)).length}
                      </div>
                    </div>
                  </div>

                  {/* Departman Üyeleri */}
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>Üye</th><th>E-posta</th><th>Rol</th><th>Durum</th></tr>
                      </thead>
                      <tbody>
                        {members.filter((m) => userDepartments.some((ud) => String(ud.departmentId) === selectedDepartment.id && String(ud.uid) === String(m.id))).length === 0 && (
                          <tr><td colSpan={4} className="empty-msg">Bu departmanda henüz üye yok.</td></tr>
                        )}
                        {members.filter((m) => userDepartments.some((ud) => String(ud.departmentId) === selectedDepartment.id && String(ud.uid) === String(m.id))).map((m) => (
                          <tr key={m.id}>
                            <td>{m.name}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.email}</td>
                            <td>
                              <span className={`badge ${m.id === user.uid ? 'badge-active' : 'badge-inactive'}`}>
                                {m.id === user.uid ? 'Siz' : 'Üye'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${m.isActive ? 'badge-active' : 'badge-inactive'}`}>
                                {m.isActive ? 'Aktif' : 'Pasif'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Departman Toplantıları */}
                  <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-purple)', marginBottom: '1rem' }}>Departman Toplantıları</h3>
                    <div className="card-grid">
                      {meetings.filter((m) => m.gundem?.includes(selectedDepartment.name) || m.notes?.includes(selectedDepartment.name) || m.title?.includes(selectedDepartment.name)).length === 0 && (
                        <p className="empty-msg">Bu departmana özgü toplantı henüz yok.</p>
                      )}
                      {meetings.filter((m) => m.gundem?.includes(selectedDepartment.name) || m.notes?.includes(selectedDepartment.name) || m.title?.includes(selectedDepartment.name)).map((m) => {
                        const attendees = attendeeMap[m.id] || [];
                        return (
                          <div className="card" key={m.id}>
                            <div className="card-body">
                              <h3 className="card-title">{m.title}</h3>
                              <span className="card-date">{new Date(m.date).toLocaleDateString('tr-TR')}</span>
                              <p className="card-notes" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{m.gundem || m.notes || '-'}</p>
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
                              {checkLogPermission(m.date) && (
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
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'admin-panel' && isAdmin && (
              <AdminPanel
                users={usersList}
                members={members}
                meetings={meetings}
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
  users, members, meetings, perms, permDate, setPermDate, targetUid, setTargetUid,
  adminMsg, grantPermission, revokePermission, handleRoleChange, handleToggleUserActive, busy
}) => {
  const adminStats = {
    totalUsers: users.length,
    totalAdmins: users.filter((u) => u.role === 'admin').length,
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.isActive).length,
    totalMeetings: meetings.length,
    pendingPerms: perms.length,
  };

  return (
    <section className="admin-theme">
      <div className="admin-section-header-modern">
        <div className="admin-section-title-modern">
          🛡️ Admin Kontrol Merkezi
        </div>
        <button
          className="admin-action-btn primary"
          onClick={() => fs.signOutFS()}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          Çıkış Yap
        </button>
      </div>

      {/* Admin Mesajı */}
      {adminMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          {adminMsg}
        </div>
      )}

      {/* İSTATİSTİK KARTLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="admin-stat-modern">
          <span className="admin-stat-value">{adminStats.totalUsers}</span>
          <span className="admin-stat-label">Toplam Kullanıcı</span>
        </div>
        <div className="admin-stat-modern">
          <span className="admin-stat-value" style={{ color: '#10b981' }}>{adminStats.totalAdmins}</span>
          <span className="admin-stat-label">Admin Yetkisi</span>
        </div>
        <div className="admin-stat-modern">
          <span className="admin-stat-value" style={{ color: '#3b82f6' }}>{adminStats.totalMembers}</span>
          <span className="admin-stat-label">Üye Kaydı</span>
        </div>
        <div className="admin-stat-modern">
          <span className="admin-stat-value" style={{ color: '#ef4444' }}>{adminStats.totalMeetings}</span>
          <span className="admin-stat-label">Toplantı</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>

        {/* === A. KULLANICI ROLLERİ & DURUM === */}
        <div className="admin-card-modern">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--admin-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>👥</span>
              Kullanıcı Rolleri & Aktiflik
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', margin: '0.25rem 0 0 0' }}>
              Kullanıcı yetkilerini ve aktiflik durumlarını yönetebilirsiniz.
            </p>
          </div>
          <div className="admin-table-modern">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '2rem' }}>
                    Kullanıcı kaydı bulunamadı.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const mbr = members.find((m) => String(m.id) === String(u.id));
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: 'linear-gradient(135deg, var(--admin-accent), #e85d00)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '0.9rem', fontWeight: 700
                        }}>
                          {(u.name || 'U').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--admin-text)' }}>{u.name || 'İsimsiz'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{u.role === 'admin' ? 'Admin' : 'Kullanıcı'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', wordBreak: 'break-all' }}>{u.email}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: u.role === 'admin' ? 'var(--admin-accent)' : '#333',
                          color: u.role === 'admin' ? '#fff' : '#888',
                          border: u.role === 'admin' ? '1px solid var(--admin-accent)' : '1px solid #444',
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px'
                        }}
                      >
                        {u.role === 'admin' ? 'ADMIN' : 'USER'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: mbr?.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: mbr?.isActive ? '#10b981' : '#ef4444',
                          border: mbr?.isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px'
                        }}
                      >
                        {mbr?.isActive ? 'AKTİF' : 'PASİF'}
                      </span>
                    </td>
                    <td className="admin-action-btn" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {u.role !== 'admin' ? (
                        <button
                          className="admin-action-btn primary"
                          onClick={() => handleRoleChange(u.id, 'admin')}
                          disabled={busy}
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
                        >
                          Admin Yap
                        </button>
                      ) : (
                        <button
                          className="admin-action-btn danger"
                          onClick={() => handleRoleChange(u.id, 'user')}
                          disabled={busy}
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
                        >
                          User Yap
                        </button>
                      )}
                      {((member) =>
                        member && (
                          <button
                            className="admin-action-btn"
                            style={{
                              background: member.isActive ? 'transparent' : 'transparent',
                              color: member.isActive ? '#ef4444' : '#10b981',
                              border: `1px solid ${member.isActive ? '#ef4444' : '#10b981'}`,
                              fontSize: '0.78rem',
                              padding: '0.4rem 0.8rem'
                            }}
                            onClick={() => handleToggleUserActive(u.id, member.isActive)}
                            disabled={busy}
                          >
                            {member.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        )
                      )(mbr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </div>
        </div>

        {/* === B. GÜNLÜK LOG İZNİ === */}
        <div className="admin-card-modern">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--admin-accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📅</span>
              Günlük Log Tutma İzni
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', margin: '0.25rem 0 0 0' }}>
              Belirli bir kullanıcıya seçilen tarihte toplantı ve yoklama ekleme yetkisi verin.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--admin-border)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-text)', minWidth: '80px' }}>
                  Tarih
                </label>
                <input
                  type="date"
                  value={permDate}
                  onChange={(e) => setPermDate(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0d0d0d',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-text)', minWidth: '80px' }}>
                  Kullanıcı
                </label>
                <select
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0d0d0d',
                    border: '1px solid var(--admin-border)',
                    color: 'var(--admin-text)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">Seçiniz...</option>
                  {users.filter((u) => u.role !== 'admin').map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name || u.email)} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="admin-action-btn primary"
                onClick={grantPermission}
                disabled={busy || !targetUid}
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 600 }}
              >
                {busy ? 'İşlem Devam Ediyor...' : 'Log Tutma İzni Ver'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
              İzin Atanan Kişiler ({permDate})
            </h4>
            <div className="admin-table-modern">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {perms.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '2rem' }}>
                      Bu tarihte izinli üye yok.
                    </td>
                  </tr>
                )}
                {perms.map((p) => {
                  const matchedUser = users.find((u) => String(u.id) === String(p.targetUid));
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--admin-accent), #e85d00)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '0.8rem', fontWeight: 700
                          }}>
                            {(matchedUser?.name || 'U').slice(0, 1).toUpperCase()}
                          </span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text)' }}>
                            {matchedUser?.name || matchedUser?.email || p.targetUid}
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          className="admin-action-btn danger"
                          onClick={() => revokePermission(p.id)}
                          disabled={busy}
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
                        >
                          İptal Et
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default App;