import {
  db, auth,
} from './firebaseConfig';
import {
  collection, getDocs, doc, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  getIdTokenResult, onAuthStateChanged, updateProfile,
} from 'firebase/auth';

/* =========================================================
 * YETKI / LOG IZNI
 * ========================================================= */

// "21 Ekim 2024" gibi bir tarih ISO gün değerine çevrilir
export const buildPermissionId = (uid, dateISO) => `${uid}_${dateISO}`;

export const grantLogPermission = async (targetUid, dateISO, meetingId = null) => {
  const permId = buildPermissionId(targetUid, dateISO);
  await setDoc(doc(db, 'logPermissions', permId), {
    targetUid, date: dateISO, meetingId,
    grantedBy: auth.currentUser?.uid || null,
    grantedAt: serverTimestamp(),
  }, { merge: true });
};

export const revokeLogPermission = async (permId) => {
  await deleteDoc(doc(db, 'logPermissions', permId));
};

export const getLogPermissionsForDate = async (dateISO) => {
  const q = query(collection(db, 'logPermissions'), where('date', '==', dateISO));
  const s = await getDocs(q);
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeTodayPermissions = (dateISO, cb) => {
  const q = query(collection(db, 'logPermissions'), where('date', '==', dateISO));
  return onSnapshot(q, (s) => {
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

// Mevcut kullanıcı o gün için log tutma izni var mı?
export const canCurrentUserLogToday = async (dateISO) => {
  if (!auth.currentUser) return false;
  const permId = buildPermissionId(auth.currentUser.uid, dateISO);
  const d = await getDoc(doc(db, 'logPermissions', permId));
  return d.exists();
};

/* =========================================================
 * MEMBERS
 * ========================================================= */

export const getMembersFS = async () => {
  const s = await getDocs(collection(db, 'members'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addMemberFS = async (member, uid = null) => {
  const docId = uid ? String(uid) : undefined;
  const data = {
    name: member.name.trim(),
    email: member.email.trim().toLowerCase(),
    isActive: true,
    createdAt: serverTimestamp(),
  };
  if (docId) {
    await setDoc(doc(db, 'members', docId), data);
    return { id: docId, ...data };
  } else {
    const ref = await addDoc(collection(db, 'members'), data);
    return { id: ref.id, ...data };
  }
};

export const updateMemberFS = async (id, updates) => {
  await updateDoc(doc(db, 'members', String(id)), updates);
  return { id, ...updates };
};

export const deleteMemberFS = async (id) => {
  await deleteDoc(doc(db, 'members', String(id)));
  // üye silinince katılım kayıtlarını sil
  const att = query(collection(db, 'attendance'), where('memberId', '==', id));
  (await getDocs(att)).docs.forEach((d) => deleteDoc(d.ref));
  // gri listeden da sil
  try { await deleteDoc(doc(db, 'greyList', String(id))); } catch {}
};

/* =========================================================
 * MEETINGS (3 alan: gundem, kararlar, gorevler)
 * ========================================================= */

export const getMeetingsFS = async () => {
  const s = await getDocs(collection(db, 'meetings'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addMeetingFS = async (meeting) => {
  const data = {
    title: meeting.title.trim(),
    date: meeting.date,
    gundem: meeting.gundem.trim(),
    kararlar: meeting.kararlar.trim(),
    gorevler: meeting.gorevler.trim(),
    notes: `${meeting.gundem.trim()}\n\n${meeting.kararlar.trim()}\n\n${meeting.gorevler.trim()}`,
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'meetings'), data);
  return { id: ref.id, ...data };
};

export const updateMeetingFS = async (id, updates) => {
  const payload = { ...updates };
  if (updates.gundem && updates.kararlar && updates.gorevler) {
    payload.notes = `${updates.gundem}\n\n${updates.kararlar}\n\n${updates.gorevler}`;
  }
  await updateDoc(doc(db, 'meetings', String(id)), payload);
  return { id, ...payload };
};

export const deleteMeetingFS = async (id) => {
  await deleteDoc(doc(db, 'meetings', String(id)));
  const att = query(collection(db, 'attendance'), where('meetingId', '==', id));
  (await getDocs(att)).docs.forEach((d) => deleteDoc(d.ref));
};

/* =========================================================
 * ATTENDANCE
 * ========================================================= */

export const getAttendanceFS = async () => {
  const s = await getDocs(collection(db, 'attendance'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addAttendanceFS = async (meetingId, memberIds) => {
  const existing = (await getDocs(query(collection(db, 'attendance'), where('meetingId', '==', meetingId))))
    .docs.map((d) => d.data());
  const existingSet = new Set(existing.map((a) => a.memberId));
  const toAdd = memberIds.filter((id) => !existingSet.has(id));
  for (const memberId of toAdd) {
    await addDoc(collection(db, 'attendance'), { meetingId, memberId: Number(memberId) || memberId });
  }
  return toAdd;
};

export const removeAttendanceFS = async (meetingId, memberId) => {
  const q = query(
    collection(db, 'attendance'),
    where('meetingId', '==', meetingId),
    where('memberId', '==', Number(memberId) || memberId)
  );
  (await getDocs(q)).docs.forEach((d) => deleteDoc(d.ref));
};

export const getMeetingAttendeesFS = async (meetingId) => {
  const q = query(collection(db, 'attendance'), where('meetingId', '==', meetingId));
  const s = await getDocs(q);
  const memberIds = s.docs.map((d) => d.data().memberId);
  const membersSnap = await getDocs(collection(db, 'members'));
  return membersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => memberIds.includes(m.id) || memberIds.includes(Number(m.id)));
};

/* =========================================================
 * GREY LIST
 * ========================================================= */

export const getGreyListFS = async () => {
  const s = await getDocs(collection(db, 'greyList'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addToGreyListFS = async (memberId, reason) => {
  await setDoc(doc(db, 'greyList', String(memberId)), {
    memberId: Number(memberId) || memberId,
    reason: reason.trim(),
    addedAt: serverTimestamp(),
  }, { merge: true });
};

export const removeFromGreyListFS = async (memberId) => {
  await deleteDoc(doc(db, 'greyList', String(memberId)));
};

/* =========================================================
 * USERS (admin paneli için)
 * ========================================================= */

export const getUsersFS = async () => {
  const s = await getDocs(collection(db, 'users'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateUserRoleFS = async (uid, role) => {
  await setDoc(doc(db, 'users', String(uid)), { role, updatedAt: serverTimestamp() }, { merge: true });
};

/* =========================================================
 * AUTH
 * ========================================================= */

export const signUpFS = async (email, password, name) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    name: name.trim(),
    role: 'user',
    createdAt: serverTimestamp(),
  });
  // Kayıt olan herkes otomatik olarak members'a eklensin
  // (memberId olarak uid kullanılır, böylece her kullanıcı = bir member)
  const memberDoc = await getDoc(doc(db, 'members', cred.user.uid));
  if (!memberDoc.exists()) {
    await setDoc(doc(db, 'members', cred.user.uid), {
      name: name.trim(),
      email: email.toLowerCase(),
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }
  return cred.user;
};

export const signInFS = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const signOutFS = () => signOut(auth);

export const subscribeAuth = (cb) =>
  onAuthStateChanged(auth, cb);

export const getUserRole = async (user) => {
  if (!user) return null;
  const tokenResult = await getIdTokenResult(user, true);
  if (tokenResult.claims?.role) return tokenResult.claims.role;
  try {
    const d = await getDoc(doc(db, 'users', user.uid));
    if (d.exists() && d.data().role) return d.data().role;
  } catch {}
  return 'user';
};

/* =========================================================
 * BILDIRIM SISTEMI (localStorage tabanli)
 * ========================================================= */

const NOTIF_KEY = (uid) => `bufalotek_nf_${uid}`;

export const getNotifs = (uid) => {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY(uid)) || '[]'); }
  catch { return []; }
};

export const addNotif = (uid, message, type = 'info') => {
  const nf = getNotifs(uid);
  if (nf.some((n) => n.message === message && n.type === type)) return;
  nf.unshift({ id: Date.now(), message, type, created: new Date().toISOString(), read: false });
  localStorage.setItem(NOTIF_KEY(uid), JSON.stringify(nf));
};

export const pushNotifAllMembers = async (message, type = 'meeting') => {
  const [members, users] = await Promise.all([getMembersFS(), getUsersFS()]);
  const all = [...new Set([...members.map((m) => m.id), ...users.map((u) => u.id)])];
  all.forEach((uid) => addNotif(uid, message, type));
};

export const pushNotifToAdmins = async (message, type = 'warning') => {
  const users = await getUsersFS();
  const admins = users.filter((u) => u.role === 'admin');
  admins.forEach((admin) => addNotif(admin.id, message, type));
};

export const markNotifRead = (uid, notifId) => {
  const nf = getNotifs(uid);
  const idx = nf.findIndex((n) => n.id === notifId);
  if (idx !== -1) { nf[idx].read = true; localStorage.setItem(NOTIF_KEY(uid), JSON.stringify(nf)); }
};

export const clearNotifs = (uid) => {
  localStorage.setItem(NOTIF_KEY(uid), '[]');
};

/* =========================================================
 * DEPARTMANLAR
 * ========================================================= */

export const getDepartmentsFS = async () => {
  const s = await getDocs(collection(db, 'departments'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addDepartmentFS = async (name) => {
  const ref = await addDoc(collection(db, 'departments'), { name: name.trim(), createdAt: serverTimestamp() });
  return { id: ref.id, name: name.trim() };
};

export const deleteDepartmentFS = async (id) => {
  await deleteDoc(doc(db, 'departments', String(id)));
};

export const initDepartmentsFS = async () => {
  const defaults = [
    { id: 'proje', name: 'Proje Departmanı', color: '#3b82f6', icon: 'project', desc: 'Proje yönetimi, planlama ve takip işlemleri' },
    { id: 'donanim', name: 'Donanım Departmanı', color: '#ef4444', icon: 'hardware', desc: 'Donanım altyapısı, cihaz bakımı ve teknik destek' },
    { id: 'yazilim', name: 'Yazılım Departmanı', color: '#10b981', icon: 'code', desc: 'Yazılım geliştirme, kodlama ve sistem yazılımı' },
    { id: 'pr', name: 'PR Departmanı', color: '#8b5cf6', icon: 'megaphone', desc: 'Halkla ilişkiler, iletişim ve marka image çalışmaları' },
    { id: 'grafik', name: 'Grafik Tasarım Departmanı', color: '#ec4899', icon: 'palette', desc: 'Görsel tasarım, marka kimliği ve grafik işleri' },
  ];
  const existing = await getDepartmentsFS();
  for (const department of defaults) {
    if (!existing.some((item) => item.name === department.name)) {
      await setDoc(doc(db, 'departments', department.id), {
        ...department,
        presidentUid: null,
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
  }
  return getDepartmentsFS();
};

export const updateDepartmentPresidentFS = async (departmentId, presidentUid) => {
  await updateDoc(doc(db, 'departments', String(departmentId)), {
    presidentUid: presidentUid || null,
    updatedAt: serverTimestamp(),
  });
};

/* =========================================================
 * PROJELER
 * ========================================================= */

export const getProjectsFS = async () => {
  const s = await getDocs(collection(db, 'projects'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addProjectFS = async (name, departmentId = null) => {
  const data = { name: name.trim(), departmentId, createdAt: serverTimestamp() };
  const ref = await addDoc(collection(db, 'projects'), data);
  return { id: ref.id, ...data };
};

export const deleteProjectFS = async (id) => {
  await deleteDoc(doc(db, 'projects', String(id)));
};

/* =========================================================
 * HABERLER
 * ========================================================= */

export const getNewsFS = async () => {
  const snapshot = await getDocs(collection(db, 'news'));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const addNewsFS = async ({ title, body, departmentId = null, authorName }) => {
  const data = {
    title: title.trim(),
    body: body.trim(),
    departmentId,
    createdBy: auth.currentUser?.uid || null,
    authorName: authorName || auth.currentUser?.displayName || auth.currentUser?.email || 'Topluluk',
    createdAt: serverTimestamp(),
  };
  const reference = await addDoc(collection(db, 'news'), data);
  return { id: reference.id, ...data };
};

export const deleteNewsFS = async (id) => {
  await deleteDoc(doc(db, 'news', String(id)));
};

/* =========================================================
 * KULLANICI - DEPARTMAN (çoka-çok)
 * ========================================================= */

export const getUserDepartmentsFS = async () => {
  const s = await getDocs(collection(db, 'userDepartments'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addUserDepartmentFS = async (uid, departmentId) => {
  await setDoc(doc(db, 'userDepartments', `${uid}_${departmentId}`), { uid, departmentId, createdAt: serverTimestamp() });
};

export const removeUserDepartmentFS = async (uid, departmentId) => {
  await deleteDoc(doc(db, 'userDepartments', `${uid}_${departmentId}`));
};

/* =========================================================
 * KULLANICI - PROJE (çoka-çok)
 * ========================================================= */

export const getUserProjectsFS = async () => {
  const s = await getDocs(collection(db, 'userProjects'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addUserProjectFS = async (uid, projectId) => {
  await setDoc(doc(db, 'userProjects', `${uid}_${projectId}`), { uid, projectId, createdAt: serverTimestamp() });
};

export const removeUserProjectFS = async (uid, projectId) => {
  await deleteDoc(doc(db, 'userProjects', `${uid}_${projectId}`));
};

/* =========================================================
 * GÖREVLER (Kişiye özel to-do)
 * ========================================================= */

export const getTasksFS = async () => {
  const s = await getDocs(collection(db, 'tasks'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addTaskFS = async (task) => {
  const data = {
    userId: task.userId,
    title: task.title.trim(),
    description: task.description.trim(),
    dueDate: task.dueDate || '',
    priority: task.priority || 'medium',
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'tasks'), data);
  return { id: ref.id, ...data };
};

export const updateTaskFS = async (id, updates) => {
  await updateDoc(doc(db, 'tasks', String(id)), updates);
  return { id, ...updates };
};

export const deleteTaskFS = async (id) => {
  await deleteDoc(doc(db, 'tasks', String(id)));
};

export const getUserTasksFS = async (uid) => {
  const q = query(collection(db, 'tasks'), where('userId', '==', uid));
  const s = await getDocs(q);
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
};
