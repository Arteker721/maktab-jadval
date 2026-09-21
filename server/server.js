const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { pool, initSchema } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

process.on('unhandledRejection', (err) => {
  console.error('⚠️ unhandledRejection:', err && err.message ? err.message : err);
});

let dbReady = false;

// ============ YORDAMCHI ============
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
async function createToken(userId) {
  const token = generateToken();
  await pool.query('INSERT INTO tokens (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

// ============ JAVOB FORMATLARI ============
const mapUser = (r) => ({
  id: r.id, _id: r.id, name: r.name, username: r.username,
  role: r.role, class: r.class_name, createdAt: r.created_at,
});
const mapLesson = (r) => ({
  id: r.id, _id: r.id, day: r.day, start: r.start_time, end: r.end_time,
  subject: r.subject, teacher: r.teacher, class: r.class_name, room: r.room,
  createdBy: r.created_by, createdAt: r.created_at,
});
const mapSubject = (r) => ({ id: r.id, _id: r.id, name: r.name, color: r.color, createdAt: r.created_at });
const mapHomework = (r) => ({
  id: r.id, _id: r.id, subject: r.subject, class: r.class_name, text: r.body,
  dueDate: r.due_date, author: r.author, createdBy: r.created_by, createdAt: r.created_at,
});
const mapNote = (r) => ({ id: r.id, _id: r.id, userId: r.user_id, text: r.body, createdAt: r.created_at });
const mapFavorite = (r) => ({ id: r.id, _id: r.id, userId: r.user_id, lessonId: r.lesson_id, createdAt: r.created_at });
const mapAnnouncement = (r) => ({
  id: r.id, _id: r.id, title: r.title, text: r.body,
  author: r.author, authorRole: r.author_role, createdAt: r.created_at,
});

// ============ DEFAULT SETTINGS ============
const DEFAULT_SETTINGS = {
  notifications_enabled: 'true',
  notify_minutes_before: '60',
  notification_sound: 'bell',
  notification_message: 'Dars boshlanadi',
  notify_late: 'true',
};

async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const obj = { ...DEFAULT_SETTINGS };
  rows.forEach(r => { obj[r.key] = r.value; });
  return obj;
}

// ============ SEED ============
async function seedData() {
  const users = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (users.rows[0].n === 0) {
    const adminPass = hashPassword('Maktab2026!');
    const teacherPass = hashPassword('teacher123');
    await pool.query(
      `INSERT INTO users (name, username, role, class_name, salt, hash) VALUES
       ($1, 'admin', 'admin', NULL, $2, $3),
       ($4, 'teacher', 'teacher', NULL, $5, $6)`,
      ['Administrator', adminPass.salt, adminPass.hash, 'Karimova N.', teacherPass.salt, teacherPass.hash]
    );
    console.log('👤 Admin (Maktab2026!) va Teacher yaratildi');
  } else {
    // Eski admin123 paroli bo'lsa — yangilaymiz
    const admin = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (admin.rows.length) {
      const row = admin.rows[0];
      if (verifyPassword('admin123', row.salt, row.hash)) {
        const newPass = hashPassword('Maktab2026!');
        await pool.query(
          'UPDATE users SET salt = $1, hash = $2 WHERE username = $3',
          [newPass.salt, newPass.hash, 'admin']
        );
        console.log('🔐 Admin paroli yangilandi: Maktab2026!');
      }
    }
  }

  const subjects = await pool.query('SELECT COUNT(*)::int AS n FROM subjects');
  if (subjects.rows[0].n === 0) {
    const list = [
      ['Matematika', '#3b82f6'], ['Fizika', '#10b981'], ['Kimyo', '#f59e0b'],
      ['Biologiya', '#22c55e'], ['Ingliz tili', '#ef4444'], ['Ona tili', '#8b5cf6'],
      ['Tarix', '#a16207'], ['Geografiya', '#06b6d4'], ['Informatika', '#6366f1'],
      ['Jismoniy tarbiya', '#ec4899'],
    ];
    for (const [name, color] of list) {
      await pool.query('INSERT INTO subjects (name, color) VALUES ($1, $2)', [name, color]);
    }
    console.log('📚 Fanlar yaratildi');
  }
}

// ============ MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (req, res) => res.json({ ok: true, db: dbReady }));

app.use('/api', (req, res, next) => {
  if (!dbReady) return res.status(503).json({ error: 'Baza hali ulanmagan' });
  next();
});

// ============ AUTH ============
const auth = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token kerak' });
  const { rows } = await pool.query(
    'SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = $1',
    [token]
  );
  if (!rows.length) return res.status(401).json({ error: 'Token yaroqsiz' });
  req.user = rows[0];
  req.token = token;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Ruxsat yo'q" });
    next();
  };
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, username, password, role, class: cls } = req.body || {};
  if (!name || !username || !password) return res.status(400).json({ error: 'Barcha maydonlar kerak' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Parol kamida 4 belgi' });

  const uname = String(username).trim().toLowerCase();
  const exists = await pool.query('SELECT 1 FROM users WHERE username = $1', [uname]);
  if (exists.rowCount) return res.status(400).json({ error: 'Bu username band' });

  const safeRole = role === 'teacher' ? 'teacher' : 'student';
  const { salt, hash } = hashPassword(String(password));

  const { rows } = await pool.query(
    `INSERT INTO users (name, username, role, class_name, salt, hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [String(name).trim(), uname, safeRole, cls || null, salt, hash]
  );
  const token = await createToken(rows[0].id);
  res.json({ token, user: mapUser(rows[0]) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username va parol kerak' });

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [
    String(username).trim().toLowerCase(),
  ]);
  const user = rows[0];
  if (!user || !verifyPassword(String(password), user.salt, user.hash)) {
    return res.status(401).json({ error: 'Username yoki parol xato' });
  }
  const token = await createToken(user.id);
  res.json({ token, user: mapUser(user) });
}));

app.post('/api/auth/logout', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM tokens WHERE token = $1', [req.token]);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth, (req, res) => res.json(mapUser(req.user)));

// ============ SETTINGS ============
app.get('/api/settings', auth, wrap(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
}));

app.put('/api/settings', auth, requireRole('admin'), wrap(async (req, res) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  for (const key of allowed) {
    if (req.body && req.body[key] !== undefined) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
        [key, String(req.body[key])]
      );
    }
  }
  const settings = await getSettings();
  res.json(settings);
}));

// ============ LESSONS ============
app.get('/api/lessons', auth, wrap(async (req, res) => {
  let result;
  if (req.user.role === 'student' && req.user.class_name) {
    result = await pool.query('SELECT * FROM lessons WHERE class_name = $1 ORDER BY created_at DESC', [req.user.class_name]);
  } else {
    result = await pool.query('SELECT * FROM lessons ORDER BY created_at DESC');
  }
  res.json(result.rows.map(mapLesson));
}));

app.post('/api/lessons', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { day, start, end, subject, teacher, class: cls, room } = req.body || {};
  if (!day || !start || !end || !subject || !cls) return res.status(400).json({ error: 'Majburiy maydonlar' });
  if (start >= end) return res.status(400).json({ error: "Vaqt noto'g'ri" });

  const { rows } = await pool.query(
    `INSERT INTO lessons (day, start_time, end_time, subject, teacher, class_name, room, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [day, start, end, subject, teacher || req.user.name, cls, room || '', req.user.id]
  );
  res.json(mapLesson(rows[0]));
}));

const LESSON_FIELDS = {
  day: 'day', start: 'start_time', end: 'end_time', subject: 'subject',
  teacher: 'teacher', class: 'class_name', room: 'room',
};

app.put('/api/lessons/:id', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Dars topilmadi' });

  const sets = []; const vals = [];
  for (const [key, col] of Object.entries(LESSON_FIELDS)) {
    if (req.body && req.body[key] !== undefined) {
      vals.push(req.body[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "Maydon yo'q" });

  vals.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE lessons SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals
  );
  if (!rows.length) return res.status(404).json({ error: 'Dars topilmadi' });
  res.json(mapLesson(rows[0]));
}));

app.delete('/api/lessons/:id', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Dars topilmadi' });
  const r = await pool.query('DELETE FROM lessons WHERE id = $1', [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Dars topilmadi' });
  res.json({ ok: true });
}));

// ============ SUBJECTS ============
app.get('/api/subjects', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM subjects ORDER BY created_at');
  res.json(rows.map(mapSubject));
}));

app.post('/api/subjects', auth, requireRole('admin'), wrap(async (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Fan nomi kerak' });
  const { rows } = await pool.query(
    'INSERT INTO subjects (name, color) VALUES ($1, $2) RETURNING *',
    [name, color || '#6366f1']
  );
  res.json(mapSubject(rows[0]));
}));

app.delete('/api/subjects/:id', auth, requireRole('admin'), wrap(async (req, res) => {
  if (isUuid(req.params.id)) await pool.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============ HOMEWORK ============
app.get('/api/homework', auth, wrap(async (req, res) => {
  let result;
  if (req.user.role === 'student' && req.user.class_name) {
    result = await pool.query('SELECT * FROM homework WHERE class_name = $1 ORDER BY created_at DESC', [req.user.class_name]);
  } else {
    result = await pool.query('SELECT * FROM homework ORDER BY created_at DESC');
  }
  res.json(result.rows.map(mapHomework));
}));

app.post('/api/homework', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { subject, class: cls, text, dueDate } = req.body || {};
  if (!subject || !cls || !text) return res.status(400).json({ error: 'Maydonlar kerak' });
  const { rows } = await pool.query(
    `INSERT INTO homework (subject, class_name, body, due_date, author, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [subject, cls, text, dueDate || null, req.user.name, req.user.id]
  );
  res.json(mapHomework(rows[0]));
}));

app.delete('/api/homework/:id', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  if (isUuid(req.params.id)) await pool.query('DELETE FROM homework WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============ NOTES ============
app.get('/api/notes', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json(rows.map(mapNote));
}));

app.post('/api/notes', auth, wrap(async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Matn kerak' });
  const { rows } = await pool.query('INSERT INTO notes (user_id, body) VALUES ($1, $2) RETURNING *', [req.user.id, text]);
  res.json(mapNote(rows[0]));
}));

app.delete('/api/notes/:id', auth, wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(403).json({ error: "Ruxsat yo'q" });
  const r = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!r.rowCount) return res.status(403).json({ error: "Ruxsat yo'q" });
  res.json({ ok: true });
}));

// ============ FAVORITES ============
app.get('/api/favorites', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM favorites WHERE user_id = $1', [req.user.id]);
  res.json(rows.map(mapFavorite));
}));

app.post('/api/favorites/toggle', auth, wrap(async (req, res) => {
  const { lessonId } = req.body || {};
  if (!lessonId) return res.status(400).json({ error: 'lessonId kerak' });
  if (!isUuid(lessonId)) return res.status(404).json({ error: 'Dars topilmadi' });
  const del = await pool.query('DELETE FROM favorites WHERE user_id = $1 AND lesson_id = $2', [req.user.id, lessonId]);
  if (del.rowCount) return res.json({ favorited: false });
  try {
    await pool.query('INSERT INTO favorites (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, lessonId]);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Dars topilmadi' });
    throw err;
  }
  res.json({ favorited: true });
}));

// ============ ANNOUNCEMENTS ============
app.get('/api/announcements', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
  res.json(rows.map(mapAnnouncement));
}));

app.post('/api/announcements', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { title, text } = req.body || {};
  if (!title || !text) return res.status(400).json({ error: 'Sarlavha va matn kerak' });
  const { rows } = await pool.query(
    'INSERT INTO announcements (title, body, author, author_role) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, text, req.user.name, req.user.role]
  );
  res.json(mapAnnouncement(rows[0]));
}));

app.delete('/api/announcements/:id', auth, requireRole('admin', 'teacher'), wrap(async (req, res) => {
  if (isUuid(req.params.id)) await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============ ADMIN: USERS ============
app.get('/api/users', auth, requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at');
  res.json(rows.map(mapUser));
}));

app.delete('/api/users/:id', auth, requireRole('admin'), wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
  if (isUuid(req.params.id)) await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ============ 404 va SPA ============
app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server xatosi' });
});

// ============ START ============
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ✅ SERVER ISHGA TUSHDI               ║');
  console.log(`║   🌐 Port: ${PORT}`.padEnd(41) + '║');
  console.log('╚════════════════════════════════════════╝');
});

(async () => {
  const attempts = 5;
  for (let i = 1; i <= attempts; i++) {
    try {
      await initSchema();
      await seedData();
      dbReady = true;
      console.log('✅ Neon (PostgreSQL) ga ulandi');
      return;
    } catch (err) {
      console.error(`❌ Baza xatosi (${i}/${attempts}):`, err.message);
      if (i < attempts) await sleep(5000);
    }
  }
  console.error("❌ Bazaga ulanib bo'lmadi.");
})();