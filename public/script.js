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
let selectedDay = null;
let notifSettings = {};

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
  if (!t) return;
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
  const map = { 0: 'Yakshanba', 1: 'Dushanba', 2: 'Seshanba', 3: 'Chorshanba', 4: 'Payshanba', 5: 'Juma', 6: 'Shanba' };
  return map[new Date().getDay()] || 'Dushanba';
}

// ============ ONBOARDING ============
let currentSlide = 0;

function initOnboarding() {
  const seen = localStorage.getItem('onboarding_seen');
  const onboarding = $('onboarding');
  const loginScreen = $('loginScreen');

  if (!seen) {
    onboarding.classList.remove('hidden');
    loginScreen.classList.add('hidden');
  } else {
    onboarding.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.onboarding-dots .dot');
  const nextBtn = $('onboardingNext');
  const skipBtn = $('onboardingSkip');

  function showSlide(n) {
    slides.forEach((s, i) => s.classList.toggle('active', i === n));
    dots.forEach((d, i) => d.classList.toggle('active', i === n));
    nextBtn.textContent = n === slides.length - 1 ? 'Boshlash 🚀' : 'Keyingisi →';
  }

  nextBtn.onclick = () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      showSlide(currentSlide);
    } else {
      finishOnboarding();
    }
  };

  skipBtn.onclick = finishOnboarding;
}

function finishOnboarding() {
  localStorage.setItem('onboarding_seen', '1');
  $('onboarding').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  currentSlide = 0;
  document.querySelectorAll('.onboarding-slide').forEach((s, i) => s.classList.toggle('active', i === 0));
  document.querySelectorAll('.onboarding-dots .dot').forEach((d, i) => d.classList.toggle('active', i === 0));
  $('onboardingNext').textContent = 'Keyingisi →';
}

// ============ AUTH ============
// Eslab qolish
const savedUsername = localStorage.getItem('saved_username');
if (savedUsername) {
  const loginInput = $('loginUsername');
  if (loginInput) loginInput.value = savedUsername;
  const remember = $('rememberMe');
  if (remember) remember.checked = true;
}

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

    // Eslab qolish
    if ($('rememberMe') && $('rememberMe').checked) {
      localStorage.setItem('saved_username', data.user.username);
    } else {
      localStorage.removeItem('saved_username');
    }

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

    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      if (btn.dataset.view === view) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    updateFabVisibility();

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
    $('bottomNavAdmin').classList.remove('hidden');
  }
  if (currentUser.role === 'admin') {
    document.querySelector('.tab[data-view="admin"]').classList.remove('hidden');
  }

  $('bottomNav')?.classList.remove('hidden');
  $('fabBtn')?.classList.remove('hidden');

  initBottomNav();
  initDaySelector();
  updateFabVisibility();

  await loadAll();
  await loadNotifSettings();
  initNotifications();
  startNotifTimer();
}

async function loadAll() {
  await Promise.all([loadSubjects(), loadLessons(), loadFavorites()]);
  renderSchedule();
  renderDayView();
}

async function loadSubjects() { try { subjects = await api('/subjects'); } catch {} }
async function loadLessons() { try { lessons = await api('/lessons'); } catch {} }
async function loadFavorites() { try { favorites = await api('/favorites'); } catch {} }

// ============ SCHEDULE ============
const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];

function getSubjectColor(subjectName) {
  const s = subjects.find(x => x.name === subjectName);
  return s ? s.color : '#6366f1';
}

function renderSchedule() {
  const tbody = $('scheduleBody');
  if (!tbody) return;
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
            <button class="edit-btn">✏️</button>
            <button class="delete-btn">🗑️</button>
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

// ============ KUNLIK ============
function renderDayView() {
  const container = $('dayLessons');
  const headerDate = $('dayHeaderDate');
  const headerCount = $('dayHeaderCount');
  if (!container) return;

  const today = getTodayName();
  const day = selectedDay || today;

  if (headerDate) headerDate.textContent = day === today ? `Bugun — ${day}` : day;

  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.day === day);
  });

  const dayLessons = lessons
    .filter(l => l.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (headerCount) headerCount.textContent = dayLessons.length === 0 ? "Dars yo'q" : `${dayLessons.length} ta dars`;

  if (dayLessons.length === 0) {
    container.innerHTML = `
      <div class="day-empty">
        <div class="day-empty-icon">🏖️</div>
        <div class="day-empty-text">Bu kunda darslar yo'q</div>
        <div style="font-size:0.8rem; margin-top:8px; opacity:0.7;">Dam oling! 😊</div>
      </div>
    `;
    return;
  }

  const now = new Date();
  const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isToday = day === today;

  container.innerHTML = dayLessons.map((lesson, i) => {
    const color = getSubjectColor(lesson.subject);
    const isCurrent = isToday && lesson.start <= curTime && lesson.end >= curTime;
    const isFav = favorites.some(f => f.lessonId === lesson.id);

    return `
      <div class="day-lesson-card ${isCurrent ? 'current' : ''}"
           style="border-left-color: ${color}; animation-delay: ${i * 0.05}s">
        <div class="day-lesson-num">${i + 1}</div>
        <div class="day-lesson-body">
          <div class="day-lesson-subject">${isCurrent ? '🔴 ' : ''}${isFav ? '⭐ ' : ''}${escapeHtml(lesson.subject)}</div>
          <div class="day-lesson-time">⏰ ${lesson.start} — ${lesson.end}</div>
          <div class="day-lesson-meta">
            <span>👨‍🏫 ${escapeHtml(lesson.teacher || '—')}</span>
            <span>🚪 ${escapeHtml(lesson.room || '—')}</span>
          </div>
        </div>
        ${currentUser && currentUser.role !== 'student' ? `
          <div class="day-lesson-actions">
            <button class="edit-btn" data-edit="${lesson.id}">✏️</button>
            <button class="delete-btn" data-del="${lesson.id}">🗑️</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const lesson = lessons.find(l => l.id === btn.dataset.edit);
      if (lesson) openLessonModal(lesson);
    };
  });
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); deleteLesson(btn.dataset.del); };
  });
}

function initDaySelector() {
  const selector = $('daySelector');
  if (!selector) return;
  selectedDay = getTodayName();
  selector.querySelectorAll('.day-tab').forEach(tab => {
    tab.onclick = () => { selectedDay = tab.dataset.day; renderDayView(); };
  });
  renderDayView();
}

$('searchInput').addEventListener('input', renderSchedule);
$('dayFilter').addEventListener('change', renderSchedule);

// ============ MODAL ============
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
      renderDayView();
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
    renderDayView();
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
  try { await api('/homework/' + id, { method: 'DELETE' }); loadHomework(); toast('🗑️'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
$('addHwBtn').addEventListener('click', () => {
  const html = `
    <div class="form-row"><label>Fan</label><input id="hwSubject" required></div>
    <div class="form-row"><label>Sinf</label><input id="hwClass" required></div>
    <div class="form-row"><label>Vazifa matni</label><input id="hwText" required></div>
    <div class="form-row"><label>Muddat</label><input type="date" id="hwDue"></div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="document.getElementById('closeModal').click()">Bekor</button>
      <button type="submit" class="btn-primary">Qo'shish</button>
    </div>
  `;
  openModal('📝 Uy vazifasi', html, async () => {
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
  try { await api('/notes/' + id, { method: 'DELETE' }); loadNotes(); toast('🗑️'); }
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
  try { await api('/announcements/' + id, { method: 'DELETE' }); loadAnnouncements(); toast('🗑️'); }
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
      closeModal(); loadAnnouncements(); toast('✅');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
});

// ============ ADMIN ============
async function loadAdmin() {
  try {
    users = await api('/users');
    $('usersList').innerHTML = users.map(u => `
      <div class="list-item">
        <div><b>${escapeHtml(u.name)}</b> <small>(${u.role}${u.class ? ', ' + u.class : ''})</small></div>
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

    // Eslatma sozlamalari
    await loadNotifSettings();
  } catch (e) { toast('❌ ' + e.message, 'error'); }
}
window.delUser = async (id) => {
  if (!confirm('O\'chirmoqchimisiz?')) return;
  try { await api('/users/' + id, { method: 'DELETE' }); loadAdmin(); toast('🗑️'); }
  catch (e) { toast('❌ ' + e.message, 'error'); }
};
window.delSubject = async (id) => {
  if (!confirm('O\'chirmoqchimisiz?')) return;
  try { await api('/subjects/' + id, { method: 'DELETE' }); await loadSubjects(); loadAdmin(); renderSchedule(); renderDayView(); toast('🗑️'); }
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
      await loadSubjects(); closeModal(); loadAdmin(); renderSchedule(); renderDayView(); toast('✅');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
  });
});

// ============ NOTIFICATION SETTINGS ============
async function loadNotifSettings() {
  try {
    notifSettings = await api('/settings');
    if ($('notifEnabled')) {
      $('notifEnabled').checked = notifSettings.notifications_enabled === 'true';
      $('notifMinutes').value = notifSettings.notify_minutes_before || 60;
      $('notifSound').value = notifSettings.notification_sound || 'bell';
      $('notifMessage').value = notifSettings.notification_message || 'Dars boshlanadi';
      $('notifyLate').checked = notifSettings.notify_late === 'true';
    }
  } catch (e) { console.warn('Sozlamalar yuklanmadi:', e.message); }
}

$('saveNotifSettings')?.addEventListener('click', async () => {
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        notifications_enabled: $('notifEnabled').checked ? 'true' : 'false',
        notify_minutes_before: $('notifMinutes').value,
        notification_sound: $('notifSound').value,
        notification_message: $('notifMessage').value,
        notify_late: $('notifyLate').checked ? 'true' : 'false',
      })
    });
    await loadNotifSettings();
    toast('✅ Sozlamalar saqlandi');
  } catch (e) { toast('❌ ' + e.message, 'error'); }
});

$('testNotifBtn')?.addEventListener('click', async () => {
  await playSound($('notifSound').value);
  showBrowserNotification('🔔 Test', 'Bu test xabari. Hammasi ishlayapti!');
});

// ============ NOTIFICATIONS ============
async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
}

function showBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [200, 100, 200],
    });
  } catch (e) {}
}

// Ovoz chiqarish (Web Audio API)
async function playSound(type = 'bell') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = (freq, duration, delay = 0, waveType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = waveType;
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    if (type === 'bell') {
      playTone(800, 0.8, 0, 'sine');
      playTone(1200, 0.6, 0.2, 'sine');
    } else if (type === 'chime') {
      playTone(600, 0.4, 0, 'triangle');
      playTone(800, 0.4, 0.3, 'triangle');
      playTone(1000, 0.6, 0.6, 'triangle');
    } else if (type === 'alert') {
      playTone(1000, 0.2, 0, 'square');
      playTone(1000, 0.2, 0.3, 'square');
      playTone(1000, 0.2, 0.6, 'square');
    } else if (type === 'beep') {
      playTone(440, 0.15, 0, 'sine');
      playTone(440, 0.15, 0.2, 'sine');
    }
  } catch (e) { console.warn('Ovoz xatosi:', e); }
}

// Har daqiqada tekshiramiz
function checkNotifications() {
  if (!currentUser) return;
  if (notifSettings.notifications_enabled !== 'true') return;

  const now = new Date();
  const today = getTodayName();
  const nowMs = now.getTime();
  const minutesBefore = parseInt(notifSettings.notify_minutes_before || '60', 10);
  const notifyLate = notifSettings.notify_late === 'true';
  const message = notifSettings.notification_message || 'Dars boshlanadi';

  // Bugungi darslarni tekshiramiz
  const todayLessons = lessons.filter(l => l.day === today);

  todayLessons.forEach(lesson => {
    // Dars boshlanish vaqtini hisoblaymiz
    const [h, m] = lesson.start.split(':').map(Number);
    const lessonDate = new Date();
    lessonDate.setHours(h, m, 0, 0);
    const lessonMs = lessonDate.getTime();

    const diffMs = lessonMs - nowMs;
    const diffMin = diffMs / 60000;

    // Kalit — kun + dars ID (har kuni yangi)
    const today_str = now.toISOString().slice(0, 10);
    const key = `notified_${today_str}_${lesson.id}_${lesson.start}`;
    if (localStorage.getItem(key)) return;

    // Shart: dars N daqiqadan keyin boshlanadi YOKI yaqinda boshlandi (kechiktirilgan holat)
    const shouldNotify = 
      (diffMin <= minutesBefore && diffMin > 0) ||
      (notifyLate && diffMin <= 0 && diffMin >= -1);

    if (shouldNotify) {
      const timeInfo = diffMin > 0 
        ? `${Math.round(diffMin)} daqiqadan keyin` 
        : 'hozir boshlanadi';
      
      showBrowserNotification(
        `🔔 ${lesson.subject}`,
        `${message} — ${lesson.start} (${timeInfo}) • ${lesson.room || ''} xona`
      );
      
      playSound(notifSettings.notification_sound || 'bell');
      localStorage.setItem(key, '1');
    }
  });

  // Eski kalitlarni tozalash (bir haftadan eski)
  cleanupOldNotifKeys();
}

function cleanupOldNotifKeys() {
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('notified_')) {
      const dateStr = key.split('_')[1];
      if (dateStr) {
        const keyDate = new Date(dateStr).getTime();
        if (now - keyDate > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(key);
          i--;
        }
      }
    }
  }
}

let notifTimer = null;
function startNotifTimer() {
  if (notifTimer) return;
  // Har 30 sekundda tekshiramiz
  notifTimer = setInterval(checkNotifications, 30000);
  // Birinchi tekshirish darhol
  setTimeout(checkNotifications, 3000);
}

// Notif tugmasini bosganda ruxsat so'rash
$('notifBtn')?.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    toast('❌ Brauzer xabarnomani qo\'llab-quvvatlamaydi', 'error');
    return;
  }
  if (Notification.permission === 'granted') {
    toast('✅ Xabarnomalar yoqilgan');
    showBrowserNotification('🔔 Test', 'Xabarnomalar ishlayapti!');
    playSound(notifSettings.notification_sound || 'bell');
  } else if (Notification.permission === 'denied') {
    toast('❌ Xabarnomalar bloklangan. Brauzer sozlamalaridan yoqing', 'error');
  } else {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast('✅ Xabarnomalar yoqildi!');
      showBrowserNotification('🔔 Tayyor', 'Endi eslatmalarni olasiz');
    } else {
      toast('❌ Ruxsat berilmadi', 'error');
    }
  }
});

// ============ BOTTOM NAV ============
function initBottomNav() {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.onclick = () => {
      const view = btn.dataset.view;
      const topTab = document.querySelector(`.tab[data-view="${view}"]`);
      if (topTab) topTab.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  const fab = $('fabBtn');
  if (fab) {
    fab.onclick = () => {
      const activeView = document.querySelector('.view:not(.hidden)');
      if (!activeView) return;
      const viewId = activeView.id;
      if (viewId === 'view-schedule') openLessonModal();
      else if (viewId === 'view-homework') $('addHwBtn')?.click();
      else if (viewId === 'view-announcements') $('addAnnBtn')?.click();
    };
  }
}

function updateFabVisibility() {
  const fab = $('fabBtn');
  if (!fab) return;
  if (!currentUser || currentUser.role === 'student') { fab.classList.add('hidden'); return; }
  const activeView = document.querySelector('.view:not(.hidden)');
  if (!activeView) { fab.classList.add('hidden'); return; }
  const viewId = activeView.id;
  if (['view-schedule', 'view-homework', 'view-announcements'].includes(viewId)) {
    fab.classList.remove('hidden');
  } else {
    fab.classList.add('hidden');
  }
}

// ============ PWA ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  if (document.getElementById('pwaInstallBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'pwaInstallBtn';
  btn.innerHTML = '📲 Ilovani o\'rnatish';
  btn.style.cssText = `position: fixed; bottom: 90px; right: 20px; padding: 14px 22px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 14px; font-size: 0.95rem; font-weight: 700; cursor: pointer; z-index: 9999; box-shadow: 0 10px 30px rgba(99,102,241,0.4); font-family: 'Inter', sans-serif;`;
  btn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.remove();
  };
  document.body.appendChild(btn);
}

// ============ INIT ============
(async function init() {
  initOnboarding();
  
  if (token) {
    try {
      currentUser = await api('/auth/me');
      $('onboarding').classList.add('hidden');
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('token');
    }
  }
})();