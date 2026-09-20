const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ============ DATA FOLDER ============
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ============ JSON DB HELPERS ============
function readData(name, fallback = []) {
  const file = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(file)) return fallback;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Read error:', name, e.message);
    return fallback;
  }
}

function writeData(name, data) {
  const file = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ============ PASSWORD HASHING ============
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============ INIT DEFAULT DATA ============
function initData() {
  if (!fs.existsSync(path.join(DATA_DIR, 'users.json'))) {
    const adminPass = hashPassword('admin123');
    const teacherPass = hashPassword('teacher123');
    writeData('users', [
      { id: 'u-admin', name: 'Administrator', username: 'admin', role: 'admin', class: null, ...adminPass, createdAt: new Date().toISOString() },
      { id: 'u-teacher', name: 'Karimova N.', username: 'teacher', role: 'teacher', class: null, ...teacherPass, createdAt: new Date().toISOString() },
    ]);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'subjects.json'))) {
    writeData('subjects', [
      { id: 's-1', name: 'Matematika', color: '#3b82f6' },
      { id: 's-2', name: 'Fizika', color: '#10b981' },
      { id: 's-3', name: 'Kimyo', color: '#f59e0b' },
      { id: 's-4', name: 'Biologiya', color: '#22c55e' },
      { id: 's-5', name: 'Ingliz tili', color: '#ef4444' },
      { id: 's-6', name: 'Ona tili', color: '#8b5cf6' },
      { id: 's-7', name: 'Tarix', color: '#a16207' },
      { id: 's-8', name: 'Geografiya', color: '#06b6d4' },
      { id: 's-9', name: 'Informatika', color: '#6366f1' },
      { id: 's-10', name: 'Jismoniy tarbiya', color: '#ec4899' },
    ]);
  }

  ['lessons', 'homework', 'notes', 'favorites', 'announcements', 'tokens'].forEach(f => {
    const file = path.join(DATA_DIR, f + '.json');
    if (!fs.existsSync(file)) writeData(f, f === 'tokens' ? {} : []);
  });

  // Boshlang'ich darslar
  if (readData('lessons').length === 0) {
    writeData('lessons', [
      { id: 'l-1', day: 'Dushanba', start: '08:00', end: '08:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
      { id: 'l-2', day: 'Dushanba', start: '09:00', end: '09:45', subject: 'Ingliz tili', teacher: 'Aliyev S.', class: '7-A', room: '105' },
      { id: 'l-3', day: 'Dushanba', start: '10:00', end: '10:45', subject: 'Fizika', teacher: 'Rahimov B.', class: '7-A', room: '301' },
      { id: 'l-4', day: 'Seshanba', start: '08:00', end: '08:45', subject: 'Kimyo', teacher: 'Yusupova D.', class: '7-A', room: '202' },
      { id: 'l-5', day: 'Seshanba', start: '09:00', end: '09:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
      { id: 'l-6', day: 'Chorshanba', start: '08:00', end: '08:45', subject: 'Biologiya', teacher: 'Nazarova G.', class: '7-A', room: '203' },
      { id: 'l-7', day: 'Chorshanba', start: '09:00', end: '09:45', subject: 'Informatika', teacher: 'Qodirov J.', class: '7-A', room: '401' },
      { id: 'l-8', day: 'Payshanba', start: '08:00', end: '08:45', subject: 'Geografiya', teacher: 'Islomov T.', class: '7-A', room: '107' },
      { id: 'l-9', day: 'Payshanba', start: '09:00', end: '09:45', subject: 'Fizika', teacher: 'Rahimov B.', class: '7-A', room: '301' },
      { id: 'l-10', day: 'Juma', start: '08:00', end: '08:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
      { id: 'l-11', day: 'Juma', start: '09:00', end: '09:45', subject: 'Jismoniy tarbiya', teacher: 'Azimov K.', class: '7-A', room: 'Sport zali' },
    ]);
  }
}
initData();

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

// ============ AUTH MIDDLEWARE ============
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token kerak' });

  const tokens = readData('tokens', {});
  const userId = tokens[token];
  if (!userId) return res.status(401).json({ error: 'Token yaroqsiz' });

  const users = readData('users', []);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

  req.user = user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    next();
  };
}

function safeUser(u) {
  const { hash, salt, ...rest } = u;
  return rest;
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', (req, res) => {
  const { name, username, password, role, class: cls } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi kerak' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Parol kamida 4 belgi' });
  }

  const users = readData('users', []);
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Bu username band' });
  }

  const pass = hashPassword(password);
  const user = {
    id: 'u-' + Date.now(),
    name: name.trim(),
    username: username.trim().toLowerCase(),
    role: role || 'student',
    class: cls || null,
    ...pass,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeData('users', users);

  const token = generateToken();
  const tokens = readData('tokens', {});
  tokens[token] = user.id;
  writeData('tokens', tokens);

  res.json({ token, user: safeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username va parol kerak' });
  }

  const users = readData('users', []);
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({ error: 'Username yoki parol xato' });
  }

  const token = generateToken();
  const tokens = readData('tokens', {});
  tokens[token] = user.id;
  writeData('tokens', tokens);

  res.json({ token, user: safeUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const tokens = readData('tokens', {});
  delete tokens[req.token];
  writeData('tokens', tokens);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json(safeUser(req.user));
});

// ============ LESSONS ============
app.get('/api/lessons', auth, (req, res) => {
  let lessons = readData('lessons', []);
  if (req.user.role === 'student' && req.user.class) {
    lessons = lessons.filter(l => l.class === req.user.class);
  }
  res.json(lessons);
});

app.post('/api/lessons', auth, requireRole('admin', 'teacher'), (req, res) => {
  const { day, start, end, subject, teacher, class: cls, room } = req.body;
  if (!day || !start || !end || !subject || !cls) {
    return res.status(400).json({ error: 'Majburiy maydonlar to\'ldirilmagan' });
  }
  if (start >= end) {
    return res.status(400).json({ error: 'Tugash vaqti boshlanishdan keyin bo\'lishi kerak' });
  }

  const lessons = readData('lessons', []);
  const lesson = {
    id: 'l-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    day, start, end, subject,
    teacher: teacher || req.user.name,
    class: cls,
    room: room || '',
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };
  lessons.push(lesson);
  writeData('lessons', lessons);
  res.json(lesson);
});

app.put('/api/lessons/:id', auth, requireRole('admin', 'teacher'), (req, res) => {
  const lessons = readData('lessons', []);
  const idx = lessons.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Dars topilmadi' });

  const updated = { ...lessons[idx], ...req.body, id: req.params.id };
  if (updated.start >= updated.end) {
    return res.status(400).json({ error: 'Vaqt noto\'g\'ri' });
  }
  lessons[idx] = updated;
  writeData('lessons', lessons);
  res.json(updated);
});

app.delete('/api/lessons/:id', auth, requireRole('admin', 'teacher'), (req, res) => {
  const lessons = readData('lessons', []);
  const filtered = lessons.filter(l => l.id !== req.params.id);
  if (filtered.length === lessons.length) {
    return res.status(404).json({ error: 'Dars topilmadi' });
  }
  writeData('lessons', filtered);
  res.json({ ok: true });
});

// ============ SUBJECTS ============
app.get('/api/subjects', auth, (req, res) => {
  res.json(readData('subjects', []));
});

app.post('/api/subjects', auth, requireRole('admin'), (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Fan nomi kerak' });
  const subjects = readData('subjects', []);
  const subject = { id: 's-' + Date.now(), name, color: color || '#6366f1' };
  subjects.push(subject);
  writeData('subjects', subjects);
  res.json(subject);
});

app.delete('/api/subjects/:id', auth, requireRole('admin'), (req, res) => {
  let subjects = readData('subjects', []);
  subjects = subjects.filter(s => s.id !== req.params.id);
  writeData('subjects', subjects);
  res.json({ ok: true });
});

// ============ HOMEWORK ============
app.get('/api/homework', auth, (req, res) => {
  let hw = readData('homework', []);
  if (req.user.role === 'student' && req.user.class) {
    hw = hw.filter(h => h.class === req.user.class);
  }
  res.json(hw);
});

app.post('/api/homework', auth, requireRole('admin', 'teacher'), (req, res) => {
  const { subject, class: cls, text, dueDate } = req.body;
  if (!subject || !cls || !text) {
    return res.status(400).json({ error: 'Fan, sinf va vazifa matni kerak' });
  }
  const hw = readData('homework', []);
  const item = {
    id: 'h-' + Date.now(),
    subject, class: cls, text, dueDate: dueDate || null,
    createdBy: req.user.id,
    author: req.user.name,
    createdAt: new Date().toISOString()
  };
  hw.push(item);
  writeData('homework', hw);
  res.json(item);
});

app.delete('/api/homework/:id', auth, requireRole('admin', 'teacher'), (req, res) => {
  let hw = readData('homework', []);
  hw = hw.filter(h => h.id !== req.params.id);
  writeData('homework', hw);
  res.json({ ok: true });
});

// ============ NOTES ============
app.get('/api/notes', auth, (req, res) => {
  const notes = readData('notes', []).filter(n => n.userId === req.user.id);
  res.json(notes);
});

app.post('/api/notes', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Matn kerak' });
  const notes = readData('notes', []);
  const note = {
    id: 'n-' + Date.now(),
    userId: req.user.id,
    text,
    createdAt: new Date().toISOString()
  };
  notes.push(note);
  writeData('notes', notes);
  res.json(note);
});

app.delete('/api/notes/:id', auth, (req, res) => {
  const notes = readData('notes', []);
  const note = notes.find(n => n.id === req.params.id);
  if (!note || note.userId !== req.user.id) {
    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  }
  writeData('notes', notes.filter(n => n.id !== req.params.id));
  res.json({ ok: true });
});

// ============ FAVORITES ============
app.get('/api/favorites', auth, (req, res) => {
  const fav = readData('favorites', []).filter(f => f.userId === req.user.id);
  res.json(fav);
});

app.post('/api/favorites/toggle', auth, (req, res) => {
  const { lessonId } = req.body;
  if (!lessonId) return res.status(400).json({ error: 'lessonId kerak' });
  let fav = readData('favorites', []);
  const idx = fav.findIndex(f => f.userId === req.user.id && f.lessonId === lessonId);
  if (idx !== -1) {
    fav.splice(idx, 1);
    writeData('favorites', fav);
    return res.json({ favorited: false });
  }
  fav.push({ id: 'f-' + Date.now(), userId: req.user.id, lessonId });
  writeData('favorites', fav);
  res.json({ favorited: true });
});

// ============ ANNOUNCEMENTS ============
app.get('/api/announcements', auth, (req, res) => {
  res.json(readData('announcements', []));
});

app.post('/api/announcements', auth, requireRole('admin', 'teacher'), (req, res) => {
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: 'Sarlavha va matn kerak' });
  const a = readData('announcements', []);
  const item = {
    id: 'a-' + Date.now(),
    title, text,
    author: req.user.name,
    authorRole: req.user.role,
    createdAt: new Date().toISOString()
  };
  a.push(item);
  writeData('announcements', a);
  res.json(item);
});

app.delete('/api/announcements/:id', auth, requireRole('admin', 'teacher'), (req, res) => {
  let a = readData('announcements', []);
  a = a.filter(x => x.id !== req.params.id);
  writeData('announcements', a);
  res.json({ ok: true });
});

// ============ ADMIN: USERS ============
app.get('/api/users', auth, requireRole('admin'), (req, res) => {
  const users = readData('users', []).map(safeUser);
  res.json(users);
});

app.delete('/api/users/:id', auth, requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
  }
  let users = readData('users', []);
  users = users.filter(u => u.id !== req.params.id);
  writeData('users', users);
  res.json({ ok: true });
});

// ============ IMPORT / EXPORT ============
app.get('/api/export', auth, requireRole('admin', 'teacher'), (req, res) => {
  res.json({
    lessons: readData('lessons', []),
    subjects: readData('subjects', []),
    homework: readData('homework', []),
    announcements: readData('announcements', []),
    exportedAt: new Date().toISOString()
  });
});

app.post('/api/import', auth, requireRole('admin'), (req, res) => {
  const { lessons, subjects, homework } = req.body || {};
  if (lessons && Array.isArray(lessons)) writeData('lessons', lessons);
  if (subjects && Array.isArray(subjects)) writeData('subjects', subjects);
  if (homework && Array.isArray(homework)) writeData('homework', homework);
  res.json({ ok: true });
});

// ============ SPA FALLBACK ============
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server xatosi' });
});

// ============ START ============
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ✅ SERVER ISHGA TUSHDI               ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║   🌐 http://localhost:${PORT}             ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log('║   👤 Admin:   admin / admin123         ║');
  console.log('║   👨‍🏫 Teacher: teacher / teacher123     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});