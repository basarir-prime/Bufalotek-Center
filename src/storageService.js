const STORAGE_KEYS = {
  members: 'bufalotek_members',
  meetings: 'bufalotek_meetings',
  attendance: 'bufalotek_attendance',
  greyList: 'bufalotek_greylist',
};

const getData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getMembers = () => getData(STORAGE_KEYS.members);

export const addMember = (member) => {
  const members = getMembers();
  const newMember = {
    id: Date.now(),
    name: member.name.trim(),
    email: member.email.trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  members.push(newMember);
  saveData(STORAGE_KEYS.members, members);
  return newMember;
};

export const updateMember = (id, updates) => {
  const members = getMembers();
  const index = members.findIndex((m) => m.id === id);
  if (index === -1) return null;
  members[index] = { ...members[index], ...updates };
  saveData(STORAGE_KEYS.members, members);
  return members[index];
};

export const deleteMember = (id) => {
  const members = getMembers().filter((m) => m.id !== id);
  saveData(STORAGE_KEYS.members, members);
  const attendance = getAttendance().filter((a) => a.memberId !== id);
  saveData(STORAGE_KEYS.attendance, attendance);
  const greyList = getGreyList().filter((g) => g.memberId !== id);
  saveData(STORAGE_KEYS.greyList, greyList);
};

export const getMeetings = () => getData(STORAGE_KEYS.meetings);

export const addMeeting = (meeting) => {
  const meetings = getMeetings();
  const newMeeting = {
    id: Date.now(),
    date: meeting.date,
    title: meeting.title.trim(),
    gundem: meeting.gundem.trim(),
    kararlar: meeting.kararlar.trim(),
    gorevler: meeting.gorevler.trim(),
    notes: meeting.notes ? meeting.notes.trim() : '',
    createdAt: new Date().toISOString(),
  };
  meetings.push(newMeeting);
  saveData(STORAGE_KEYS.meetings, meetings);
  return newMeeting;
};

export const updateMeeting = (id, updates) => {
  const meetings = getMeetings();
  const index = meetings.findIndex((m) => m.id === id);
  if (index === -1) return null;
  meetings[index] = { ...meetings[index], ...updates };
  saveData(STORAGE_KEYS.meetings, meetings);
  return meetings[index];
};

export const deleteMeeting = (id) => {
  const meetings = getMeetings().filter((m) => m.id !== id);
  saveData(STORAGE_KEYS.meetings, meetings);
  const attendance = getAttendance().filter((a) => a.meetingId !== id);
  saveData(STORAGE_KEYS.attendance, attendance);
};

export const getAttendance = () => getData(STORAGE_KEYS.attendance);

export const addAttendance = (meetingId, memberIds) => {
  const attendance = getAttendance();
  const newEntries = memberIds.map((memberId) => ({
    meetingId,
    memberId,
  }));
  const existing = new Set(
    attendance
      .filter((a) => a.meetingId === meetingId)
      .map((a) => `${a.meetingId}_${a.memberId}`)
  );
  const toAdd = newEntries.filter(
    (e) => !existing.has(`${e.meetingId}_${e.memberId}`)
  );
  attendance.push(...toAdd);
  saveData(STORAGE_KEYS.attendance, attendance);
  return toAdd;
};

export const removeAttendance = (meetingId, memberId) => {
  const attendance = getAttendance().filter(
    (a) => !(a.meetingId === meetingId && a.memberId === memberId)
  );
  saveData(STORAGE_KEYS.attendance, attendance);
};

export const getMeetingAttendees = (meetingId) => {
  const members = getMembers();
  const attendance = getAttendance();
  const attendeeIds = new Set(
    attendance.filter((a) => a.meetingId === meetingId).map((a) => a.memberId)
  );
  return members.filter((m) => attendeeIds.has(m.id));
};

export const getMemberMeetings = (memberId) => {
  const meetings = getMeetings();
  const attendance = getAttendance();
  const meetingIds = new Set(
    attendance.filter((a) => a.memberId === memberId).map((a) => a.meetingId)
  );
  return meetings.filter((m) => meetingIds.has(m.id));
};

export const getGreyList = () => getData(STORAGE_KEYS.greyList);

export const addToGreyList = (memberId, reason) => {
  const greyList = getGreyList();
  if (greyList.some((g) => g.memberId === memberId)) return null;
  const newEntry = {
    id: Date.now(),
    memberId,
    addedAt: new Date().toISOString(),
    reason: reason.trim(),
  };
  greyList.push(newEntry);
  saveData(STORAGE_KEYS.greyList, greyList);
  return newEntry;
};

export const removeFromGreyList = (memberId) => {
  const greyList = getGreyList().filter((g) => g.memberId !== memberId);
  saveData(STORAGE_KEYS.greyList, greyList);
};