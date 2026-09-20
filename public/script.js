// ============ API ============
const API = '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let lessons = [];
let subjects = [];
let homework = [];
let notes = [];
let announcements = [];
let users = [];
let favorites = [];

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xatolik');
  return data;
}

// ============ HELPERS ============
function $(id) { return document.getElementById(id); }
function toast(msg, type = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.style.background = type === 'error' ? '#ef4444' : '#1e293b';
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function getTodayName() {
  const map = { 1: 'Dushanba', 2: 'Seshanba', 3: 'Chorshanba', 4: 'Payshanba', 5: 'Juma', 6: 'Shanba' };
  return map[new Date().getDay()] || null;
}

// ============ AUTH ============
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('loginUsername').value,
        password: $('loginPassword').value
      })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showApp();
    toast('✅ Xush kelibsiz, ' + currentUser.name);
  } catch (e) { toast('❌ ' + e.message, 'error'); }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: $('regName').value,
        username: $('regUsername').value,
        password: $('regPassword').value,
        role: $('regRole').value,
        class: $('regClass').value || null
      })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showApp();
    toast('✅ Ro\'yxatdan o\'tdingiz!');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
});

document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.tab === 'login') {
      $('loginForm').classList.remove('hidden');
      $('registerForm').classList.add('hidden');
    } else {
      $('loginForm').classList.add('hidden');
      $('registerForm').classList.remove('hidden');
    }
  });
});

$('logoutBtn').addEventListener('click', async () => {
  if (!confirm('Chiqishni xohlaysizmi?')) return;
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  location.reload();
});

// ============ TABS ============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const view = tab.dataset.view;
    $('view-' + view).classList.remove('hidden');
    if (view === 'homework') loadHomework();
    if (view === 'notes') loadNotes();
    if (view === 'announcements') loadAnnouncements();
    if (view === 'admin') loadAdmin();
  });
});

// ============ DARK MODE ============
if (localStorage.getItem('dark') === '1') document.body.classList.add('dark');
$('darkModeBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark') ? '1' : '0');
});

// ============ APP LOAD ============
async function showApp() {
  $('loginScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('userInfo').textContent = `👤 ${currentUser.name} • ${currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'teacher' ? 'O\'qituvchi' : 'O\'quvchi'}${currentUser.class ? ' • ' + currentUser.class : ''}`;

  if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
    $('addLessonBtn').classList.remove('hidden');
    $('addHwBtn').classList.remove('hidden');
    $('addAnnBtn').classList.remove('hidden');
  }
  if (currentUser.role === 'admin') {
    document.querySelector('[data-view="admin"]').classList.remove('hidden');
  } else {
    document.querySelector('[data-view="admin"]').classList.add('hidden');
  }

  await loadAll();
}

async function loadAll() {
  await Promise.all([loadSubjects(), loadLessons(), loadFavorites()]);
  renderSchedule();
}

async function loadSubjects() {
  try { subjects = await api('/subjects'); } catch {}
}
async function loadLessons() {
  try { lessons = await api('/lessons'); } catch {}
}
async function loadFavorites() {
  try { favorites = await api('/favorites'); } catch {}
}

// ============ RENDER SCHEDULE ============
const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];

function getSubjectColor(subjectName) {
  const s = subjects.find(x => x.name === subjectName);
  return s ? s.color : '#6366f1';
}

function renderSchedule() {
  const tbody = $('scheduleBody');
  tbody.innerHTML = '';
  const search = $('searchInput').value.toLowerCase().trim();
  const dayFilter = $('dayFilter').value;
  const today = getTodayName();
  const now = new Date();
  const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  timeSlots.forEach(slot => {
    const row = document.createElement('tr');
    const timeCell = document.createElement('td');
    timeCell.className = 'time-cell';
    timeCell.textContent = slot;
    row.appendChild(timeCell);

    days.forEach(day => {
      const cell = document.createElement('td');
      if (dayFilter !== 'all' && dayFilter !== day) { row.appendChild(cell); return; }

      const found = lessons.filter(l =>
        l.day === day && l.start === slot &&
        (search === '' || l.subject.toLowerCase().includes(search) || (l.teacher || '').toLowerCase().includes(search))
      );

      found.forEach(lesson => {
        const isCurrent = day === today && lesson.start <= curTime && lesson.end >= curTime;
        const color = getSubjectColor(lesson.subject);
        const isFav = favorites.some(f => f.lessonId === lesson.id);
        const div = document.createElement('div');
        div.className = 'lesson-cell';
        div.style.borderLeftColor = color;
        div.innerHTML = `
          <span class="lesson-subject">${isCurrent ? '🔴 ' : ''}${isFav ? '⭐ ' : ''}${escapeHtml(lesson.subject)}</span>
          <span class="lesson-info">👨‍🏫 ${escapeHtml(lesson.teacher || '')}</span>
          <span class="lesson-info">🚪 ${escapeHtml(lesson.room || '')}</span>
          <div class="lesson-actions">
            <button class="edit-btn" data-id="${lesson.id}">✏️</button>
            <button class="delete-btn" data-id="${lesson.id}">🗑️</button>
          </div>
        `;
        div.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openLessonModal(lesson); });
        div.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); deleteLesson(lesson.id); });
        cell.appendChild(div);
      });

      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
}

$('searchInput').addEventListener('input', renderSchedule);
$('dayFilter').addEventListener('change', renderSchedule);

// ============ LESSON MODAL ============
function openModal(title, formHtml, onSubmit) {
  $('modalTitle').textContent = title;
  $('modalForm').innerHTML = formHtml;
  $('modal').classList.remove('hidden');
  $('modalForm').onsubmit = async (e) => { e.preventDefault(); await onSubmit(); };
}
function closeModal() { $('modal').classList.add('hidden'); }
$('closeModal').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

$('addLessonBtn').addEventListener('click', () => openLessonModal());

function openLessonModal(lesson = null) {
  const editing = !!lesson;
  const html = `
    <input type="hidden" id="mId" value="${lesson?.id || ''}">
    <div class="form-row">
      <label>Kun</label>
      <select id="mDay" required>
        ${days.map(d => `<option ${lesson?.day === d ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-row two">
      <div><label>Boshlanish</label><input type="time" id="mStart" value="${lesson?.start || '08:00'}" required></div>
      <div><label>Tugash</label><input type="time" id="mEnd" value="${lesson?.end || '08:45'}" required></div>
    </div>
    <div class="form-row"><label>Fan</label><input id="mSubject" value="${escapeHtml(lesson?.subject || '')}" required></div>
    <div class="form-row"><label>O'qituvchi</label><input id="mTeacher" value="${escapeHtml(lesson?.teacher || '')}" required></div>
    <div class="form-row two">
      <div><label>Sinf</label><input id="mClass" value="${escapeHtml(lesson?.class || '')}" required></div>
      <div><label>Xona</label><input id="mRoom" value="${escapeHtml(lesson?.room || '')}"></div>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('closeModal').click()">Bekor</button>
      <button type="submit" class="btn-primary">${editing ? 'Saqlash' : 'Qo\'shish'}</button>
    </div>
  `;
  openModal(editing ? '✏️ Tahrirlash' : '➕ Dars qo\'shish', html, async () => {
    const data = {
      day: $('mDay').value, start: $('mStart').value, end: $('mEnd').value,
      subject: $('mSubject').value, teacher: $('mTeacher').value,
      class: $('mClass').value, room: $('mRoom').value
    };
    try {
      if (editing) await api('/lessons/' + lesson.id, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/lessons', { method: 'POST', body: JSON.stringify(data) });
      await loadLessons();
      renderSchedule();
      closeModal();
      toast('✅ Saqlandi');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
}

async function deleteLesson(id) {
  if (!confirm('O\'chirmoqchimisiz?')) return;
  try {
    await api('/lessons/' + id, { method: 'DELETE' });
    await loadLessons();
    renderSchedule();
    toast('🗑️ O\'chirildi');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}

// ============ HOMEWORK ============
async function loadHomework() {
  try {
    homework = await api('/homework');
    const list = $('homeworkList');
    if (homework.length === 0) { list.innerHTML = '<p style="color:var(--text-light);">Vazifalar yo\'q</p>'; return; }
    list.innerHTML = homework.map(h => `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(h.subject)} — ${escapeHtml(h.class)}</h4>
          <p>${escapeHtml(h.text)}</p>
          <small>👨‍🏫 ${escapeHtml(h.author)} • ${new Date(h.createdAt).toLocaleDateString()}</small>
        </div>
        ${currentUser.role !== 'student' ? `<button class="delete-btn" onclick="delHw('${h.id}')">🗑️</button>` : ''}
      </div>
    `).join('');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}
window.delHw = async (id) => {
  if (!confirm('O\'chirmoqchimisiz?')) return;
  try { await api('/homework/' + id, { method: 'DELETE' }); loadHomework(); toast('🗑️ O\'chirildi'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
$('addHwBtn').addEventListener('click', () => {
  const html = `
    <div class="form-row"><label>Fan</label><input id="hwSubject" required></div>
    <div class="form-row"><label>Sinf</label><input id="hwClass" required></div>
    <div class="form-row"><label>Vazifa matni</label><input id="hwText" required></div>
    <div class="form-row"><label>Muddat (ixtiyoriy)</label><input type="date" id="hwDue"></div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('closeModal').click()">Bekor</button>
      <button type="submit" class="btn-primary">Qo'shish</button>
    </div>
  `;
  openModal('📝 Uy vazifasi qo\'shish', html, async () => {
    try {
      await api('/homework', { method: 'POST', body: JSON.stringify({
        subject: $('hwSubject').value, class: $('hwClass').value,
        text: $('hwText').value, dueDate: $('hwDue').value
      })});
      closeModal(); loadHomework(); toast('✅ Qo\'shildi');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
});

// ============ NOTES ============
async function loadNotes() {
  try {
    notes = await api('/notes');
    const list = $('notesList');
    if (notes.length === 0) { list.innerHTML = '<p style="color:var(--text-light);">Izohlar yo\'q</p>'; return; }
    list.innerHTML = notes.map(n => `
      <div class="list-item">
        <div><p>${escapeHtml(n.text)}</p><small>${new Date(n.createdAt).toLocaleString()}</small></div>
        <button class="delete-btn" onclick="delNote('${n.id}')">🗑️</button>
      </div>
    `).join('');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}
window.delNote = async (id) => {
  try { await api('/notes/' + id, { method: 'DELETE' }); loadNotes(); toast('🗑️ O\'chirildi'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
$('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/notes', { method: 'POST', body: JSON.stringify({ text: $('noteInput').value }) });
    $('noteInput').value = '';
    loadNotes(); toast('✅ Qo\'shildi');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
});

// ============ ANNOUNCEMENTS ============
async function loadAnnouncements() {
  try {
    announcements = await api('/announcements');
    const list = $('announcementsList');
    if (announcements.length === 0) { list.innerHTML = '<p style="color:var(--text-light);">E\'lonlar yo\'q</p>'; return; }
    list.innerHTML = announcements.map(a => `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.text)}</p>
          <small>👤 ${escapeHtml(a.author)} • ${new Date(a.createdAt).toLocaleString()}</small>
        </div>
        ${currentUser.role !== 'student' ? `<button class="delete-btn" onclick="delAnn('${a.id}')">🗑️</button>` : ''}
      </div>
    `).join('');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}
window.delAnn = async (id) => {
  if (!confirm('O\'chirmoqchimisiz?')) return;
  try { await api('/announcements/' + id, { method: 'DELETE' }); loadAnnouncements(); toast('🗑️ O\'chirildi'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
$('addAnnBtn').addEventListener('click', () => {
  const html = `
    <div class="form-row"><label>Sarlavha</label><input id="annTitle" required></div>
    <div class="form-row"><label>Matn</label><input id="annText" required></div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('closeModal').click()">Bekor</button>
      <button type="submit" class="btn-primary">E'lon qilish</button>
    </div>
  `;
  openModal('📢 E\'lon qo\'shish', html, async () => {
    try {
      await api('/announcements', { method: 'POST', body: JSON.stringify({
        title: $('annTitle').value, text: $('annText').value
      })});
      closeModal(); loadAnnouncements(); toast('✅ E\'lon qo\'shildi');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
});

// ============ ADMIN ============
async function loadAdmin() {
  try {
    users = await api('/users');
    $('usersList').innerHTML = users.map(u => `
      <div class="list-item">
        <div>
          <b>${escapeHtml(u.name)}</b> <small>(${u.role}${u.class ? ', ' + u.class : ''})</small>
        </div>
        ${u.id !== currentUser.id ? `<button class="delete-btn" onclick="delUser('${u.id}')">🗑️</button>` : ''}
      </div>
    `).join('');

    $('subjectsList').innerHTML = subjects.map(s => `
      <div class="list-item">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:16px;height:16px;border-radius:4px;background:${s.color};display:inline-block;"></span>
          <b>${escapeHtml(s.name)}</b>
        </div>
        <button class="delete-btn" onclick="delSubject('${s.id}')">🗑️</button>
      </div>
    `).join('');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}
window.delUser = async (id) => {
  if (!confirm('Foydalanuvchini o\'chirmoqchimisiz?')) return;
  try { await api('/users/' + id, { method: 'DELETE' }); loadAdmin(); toast('🗑️ O\'chirildi'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
window.delSubject = async (id) => {
  if (!confirm('Fanni o\'chirmoqchimisiz?')) return;
  try { await api('/subjects/' + id, { method: 'DELETE' }); await loadSubjects(); loadAdmin(); toast('🗑️ O\'chirildi'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};

$('addSubjectBtn').addEventListener('click', () => {
  const html = `
    <div class="form-row"><label>Fan nomi</label><input id="subName" required></div>
    <div class="form-row"><label>Rang</label><input type="color" id="subColor" value="#6366f1"></div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('closeModal').click()">Bekor</button>
      <button type="submit" class="btn-primary">Qo'shish</button>
    </div>
  `;
  openModal('📚 Fan qo\'shish', html, async () => {
    try {
      await api('/subjects', { method: 'POST', body: JSON.stringify({
        name: $('subName').value, color: $('subColor').value
      })});
      await loadSubjects(); closeModal(); loadAdmin(); toast('✅ Qo\'shildi');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
});

$('exportBtn').addEventListener('click', async () => {
  try {
    const data = await api('/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'maktab-jadval-export.json';
    a.click(); URL.revokeObjectURL(url);
    toast('📥 Eksport qilindi');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
});

$('importBtn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api('/import', { method: 'POST', body: JSON.stringify(data) });
      await loadAll(); loadAdmin(); toast('✅ Import qilindi');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  };
  input.click();
});

// ============ INIT ============
(async function init() {
  if (token) {
    try {
      currentUser = await api('/auth/me');
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('token');
    }
  }
})();// ============ PWA: SERVICE WORKER ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('✅ Service Worker ro\'yxatdan o\'tdi:', reg.scope);
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker xatosi:', err);
      });
  });
}

// ============ PWA: O'RNATISH TUGMASI ============
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // O'rnatish tugmasini ko'rsatamiz
  showInstallButton();
});

function showInstallButton() {
  // Agar allaqachon tugma bo'lsa — qaytaramiz
  if (document.getElementById('pwaInstallBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'pwaInstallBtn';
  btn.innerHTML = '📲 Ilovani o\'rnatish';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 14px 22px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
    font-family: 'Inter', sans-serif;
    animation: slideIn 0.5s ease;
  `;
  
  btn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Foydalanuvchi tanlovi:', outcome);
    deferredPrompt = null;
    btn.remove();
  };
  
  document.body.appendChild(btn);
}

// Animatsiya
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

// O'rnatilgandan keyin
window.addEventListener('appinstalled', () => {
  console.log('✅ Ilova o\'rnatildi!');
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.remove();
  toast('📲 Ilova muvaffaqiyatli o\'rnatildi!');
});