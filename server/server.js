const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

// 👇 BU 3 QATORNI QO'SHING
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const {
  User, Lesson, Subject, Homework, Note, Favorite, Announcement, Token
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MONGO_URI = process.env.MONGO_URI;

// ============ MONGODB ULANISH ============
if (!MONGO_URI) {
  console.error('❌ MONGO_URI yo\'q! Environment variable qo\'shing.');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 60000,
  connectTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  family: 4
})

// ============ PASSWORD ============
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

// ============ INITIAL DATA ============
async function initData(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📦 Ma'lumotlarni tekshirish... (urinish ${i + 1}/${retries})`);

      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const adminPass = hashPassword('admin123');
        const teacherPass = hashPassword('teacher123');
        await User.create([
          { name: 'Administrator', username: 'admin', role: 'admin', class: null, ...adminPass },
          { name: 'Karimova N.', username: 'teacher', role: 'teacher', class: null, ...teacherPass },
        ]);
        console.log('👤 Admin va Teacher yaratildi');
      }

      const subjectCount = await Subject.countDocuments();
      if (subjectCount === 0) {
        await Subject.create([
          { name: 'Matematika', color: '#3b82f6' },
          { name: 'Fizika', color: '#10b981' },
          { name: 'Kimyo', color: '#f59e0b' },
          { name: 'Biologiya', color: '#22c55e' },
          { name: 'Ingliz tili', color: '#ef4444' },
          { name: 'Ona tili', color: '#8b5cf6' },
          { name: 'Tarix', color: '#a16207' },
          { name: 'Geografiya', color: '#06b6d4' },
          { name: 'Informatika', color: '#6366f1' },
          { name: 'Jismoniy tarbiya', color: '#ec4899' },
        ]);
        console.log('📚 Fanlar yaratildi');
      }

      const lessonCount = await Lesson.countDocuments();
      if (lessonCount === 0) {
        await Lesson.create([
          { day: 'Dushanba', start: '08:00', end: '08:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
          { day: 'Dushanba', start: '09:00', end: '09:45', subject: 'Ingliz tili', teacher: 'Aliyev S.', class: '7-A', room: '105' },
          { day: 'Dushanba', start: '10:00', end: '10:45', subject: 'Fizika', teacher: 'Rahimov B.', class: '7-A', room: '301' },
          { day: 'Seshanba', start: '08:00', end: '08:45', subject: 'Kimyo', teacher: 'Yusupova D.', class: '7-A', room: '202' },
          { day: 'Seshanba', start: '09:00', end: '09:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
          { day: 'Chorshanba', start: '08:00', end: '08:45', subject: 'Biologiya', teacher: 'Nazarova G.', class: '7-A', room: '203' },
          { day: 'Chorshanba', start: '09:00', end: '09:45', subject: 'Informatika', teacher: 'Qodirov J.', class: '7-A', room: '401' },
          { day: 'Payshanba', start: '08:00', end: '08:45', subject: 'Geografiya', teacher: 'Islomov T.', class: '7-A', room: '107' },
          { day: 'Payshanba', start: '09:00', end: '09:45', subject: 'Fizika', teacher: 'Rahimov B.', class: '7-A', room: '301' },
          { day: 'Juma', start: '08:00', end: '08:45', subject: 'Matematika', teacher: 'Karimova N.', class: '7-A', room: '204' },
          { day: 'Juma', start: '09:00', end: '09:45', subject: 'Jismoniy tarbiya', teacher: 'Azimov K.', class: '7-A', room: 'Sport zali' },
        ]);
        console.log('📅 Boshlang\'ich darslar yaratildi');
      }

      console.log('✅ initData muvaffaqiyatli tugadi!');
      return; // Muvaffaqiyatli — chiqamiz

    } catch (err) {
      console.error(`❌ initData xatosi (urinish ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        console.log('⏳ 15 soniya kutamiz va qayta urinamiz...');
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }
  console.error('❌ initData 3 marta urinib ham muvaffaqiyatsiz bo\'ldi');
}

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

// ============ AUTH ============
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Token kerak' });

    const tokenDoc = await Token.findOne({ token });
    if (!tokenDoc) return res.status(401).json({ error: 'Token yaroqsiz' });

    const user = await User.findById(tokenDoc.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  return {
    id: u._id, name: u.name, username: u.username,
    role: u.role, class: u.class, createdAt: u.createdAt
  };
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, password, role, class: cls } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Barcha maydonlar kerak' });
    if (password.length < 4) return res.status(400).json({ error: 'Parol kamida 4 belgi' });

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Bu username band' });

    const pass = hashPassword(password);
    const user = await User.create({
      name: name.trim(), username: username.trim().toLowerCase(),
      role: role || 'student', class: cls || null, ...pass
    });

    const token = generateToken();
    await Token.create({ token, userId: user._id.toString() });

    res.json({ token, user: safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username va parol kerak' });

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      return res.status(401).json({ error: 'Username yoki parol xato' });
    }

    const token = generateToken();
    await Token.create({ token, userId: user._id.toString() });

    res.json({ token, user: safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    await Token.deleteOne({ token: req.token });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', auth, (req, res) => res.json(safeUser(req.user)));

// ============ LESSONS ============
app.get('/api/lessons', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'student' && req.user.class) filter.class = req.user.class;
    const lessons = await Lesson.find(filter).sort({ createdAt: -1 });
    res.json(lessons.map(l => ({ ...l.toObject(), id: l._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lessons', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { day, start, end, subject, teacher, class: cls, room } = req.body;
    if (!day || !start || !end || !subject || !cls) return res.status(400).json({ error: 'Majburiy maydonlar' });
    if (start >= end) return res.status(400).json({ error: 'Vaqt noto\'g\'ri' });

    const lesson = await Lesson.create({
      day, start, end, subject,
      teacher: teacher || req.user.name,
      class: cls, room: room || '',
      createdBy: req.user._id.toString()
    });
    res.json({ ...lesson.toObject(), id: lesson._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/lessons/:id', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const updated = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Dars topilmadi' });
    res.json({ ...updated.toObject(), id: updated._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/lessons/:id', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const deleted = await Lesson.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Dars topilmadi' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ SUBJECTS ============
app.get('/api/subjects', auth, async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects.map(s => ({ ...s.toObject(), id: s._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subjects', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Fan nomi kerak' });
    const subject = await Subject.create({ name, color: color || '#6366f1' });
    res.json({ ...subject.toObject(), id: subject._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/subjects/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ HOMEWORK ============
app.get('/api/homework', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'student' && req.user.class) filter.class = req.user.class;
    const hw = await Homework.find(filter).sort({ createdAt: -1 });
    res.json(hw.map(h => ({ ...h.toObject(), id: h._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/homework', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { subject, class: cls, text, dueDate } = req.body;
    if (!subject || !cls || !text) return res.status(400).json({ error: 'Maydonlar kerak' });
    const hw = await Homework.create({
      subject, class: cls, text, dueDate: dueDate || null,
      author: req.user.name, createdBy: req.user._id.toString()
    });
    res.json({ ...hw.toObject(), id: hw._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/homework/:id', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    await Homework.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ NOTES ============
app.get('/api/notes', auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user._id.toString() }).sort({ createdAt: -1 });
    res.json(notes.map(n => ({ ...n.toObject(), id: n._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Matn kerak' });
    const note = await Note.create({ userId: req.user._id.toString(), text });
    res.json({ ...note.toObject(), id: note._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notes/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note || note.userId !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    await Note.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ FAVORITES ============
app.get('/api/favorites', auth, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.user._id.toString() });
    res.json(favs.map(f => ({ ...f.toObject(), id: f._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/favorites/toggle', auth, async (req, res) => {
  try {
    const { lessonId } = req.body;
    if (!lessonId) return res.status(400).json({ error: 'lessonId kerak' });
    const userId = req.user._id.toString();
    const existing = await Favorite.findOne({ userId, lessonId });
    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.json({ favorited: false });
    }
    await Favorite.create({ userId, lessonId });
    res.json({ favorited: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ ANNOUNCEMENTS ============
app.get('/api/announcements', auth, async (req, res) => {
  try {
    const list = await Announcement.find().sort({ createdAt: -1 });
    res.json(list.map(a => ({ ...a.toObject(), id: a._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/announcements', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { title, text } = req.body;
    if (!title || !text) return res.status(400).json({ error: 'Sarlavha va matn kerak' });
    const a = await Announcement.create({
      title, text, author: req.user.name, authorRole: req.user.role
    });
    res.json({ ...a.toObject(), id: a._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/announcements/:id', auth, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ ADMIN: USERS ============
app.get('/api/users', auth, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find();
    res.json(users.map(safeUser));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
async function startServer() {
  try {
    // 1. MongoDB'ga ulanish
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000 // 30 soniya kutish
    });
    console.log('✅ MongoDB Atlas\'ga ulandi');

    // 2. Muhim: MongoDB to'liq tayyor bo'lishi uchun 3 soniya kutamiz
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 3. Boshlang'ich ma'lumotlarni yozish
    await initData();

  } catch (err) {
    console.error('❌ Xatosi:', err.message);
    // Xato bo'lsa ham server ishga tushaveradi
  }

  // 4. Serverni ishga tushirish (har qanday holatda ham)
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
  });
}

startServer();