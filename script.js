// ============ MA'LUMOTLAR ============
let lessons = [
  // 7-A SINFI
  { id: 1, day: "Dushanba", start: "08:00", end: "08:45", subject: "Matematika", teacher: "Karimova N.", class: "7-A", room: "204" },
  { id: 2, day: "Dushanba", start: "09:00", end: "09:45", subject: "Ingliz tili", teacher: "Aliyev S.", class: "7-A", room: "105" },
  { id: 3, day: "Dushanba", start: "10:00", end: "10:45", subject: "Fizika", teacher: "Rahimov B.", class: "7-A", room: "301" },
  { id: 4, day: "Dushanba", start: "11:00", end: "11:45", subject: "Ona tili", teacher: "Saidova L.", class: "7-A", room: "101" },
  
  { id: 5, day: "Seshanba", start: "08:00", end: "08:45", subject: "Kimyo", teacher: "Yusupova D.", class: "7-A", room: "202" },
  { id: 6, day: "Seshanba", start: "09:00", end: "09:45", subject: "Matematika", teacher: "Karimova N.", class: "7-A", room: "204" },
  { id: 7, day: "Seshanba", start: "10:00", end: "10:45", subject: "Tarix", teacher: "Tosheva M.", class: "7-A", room: "108" },
  
  { id: 8, day: "Chorshanba", start: "08:00", end: "08:45", subject: "Biologiya", teacher: "Nazarova G.", class: "7-A", room: "203" },
  { id: 9, day: "Chorshanba", start: "09:00", end: "09:45", subject: "Ona tili", teacher: "Saidova L.", class: "7-A", room: "101" },
  { id: 10, day: "Chorshanba", start: "10:00", end: "10:45", subject: "Informatika", teacher: "Qodirov J.", class: "7-A", room: "401" },
  
  { id: 11, day: "Payshanba", start: "08:00", end: "08:45", subject: "Geografiya", teacher: "Islomov T.", class: "7-A", room: "107" },
  { id: 12, day: "Payshanba", start: "09:00", end: "09:45", subject: "Fizika", teacher: "Rahimov B.", class: "7-A", room: "301" },
  { id: 13, day: "Payshanba", start: "10:00", end: "10:45", subject: "Ingliz tili", teacher: "Aliyev S.", class: "7-A", room: "105" },
  
  { id: 14, day: "Juma", start: "08:00", end: "08:45", subject: "Matematika", teacher: "Karimova N.", class: "7-A", room: "204" },
  { id: 15, day: "Juma", start: "09:00", end: "09:45", subject: "Kimyo", teacher: "Yusupova D.", class: "7-A", room: "202" },
  { id: 16, day: "Juma", start: "10:00", end: "10:45", subject: "Jismoniy tarbiya", teacher: "Azimov K.", class: "7-A", room: "Sport zali" },

  // 8-A SINFI uchun namuna
  { id: 17, day: "Dushanba", start: "08:00", end: "08:45", subject: "Algebra", teacher: "Karimova N.", class: "8-A", room: "205" },
  { id: 18, day: "Dushanba", start: "09:00", end: "09:45", subject: "Fizika", teacher: "Rahimov B.", class: "8-A", room: "301" },
  { id: 19, day: "Seshanba", start: "08:00", end: "08:45", subject: "Ingliz tili", teacher: "Aliyev S.", class: "8-A", room: "105" },
  { id: 20, day: "Chorshanba", start: "08:00", end: "08:45", subject: "Kimyo", teacher: "Yusupova D.", class: "8-A", room: "202" },
];

// ============ KONSTANTALAR ============
const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

const timeSlots = [
  { start: "08:00", end: "08:45" },
  { start: "09:00", end: "09:45" },
  { start: "10:00", end: "10:45" },
  { start: "11:00", end: "11:45" },
  { start: "12:00", end: "12:45" },
  { start: "13:00", end: "13:45" },
];

// ============ FOYDALANUVCHI ============
let currentUser = {
  name: "",
  class: "",
};

// ============ LOGIN TIZIMI ============
document.getElementById("loginBtn").addEventListener("click", () => {
  const name = document.getElementById("loginName").value.trim();
  const cls = document.getElementById("loginClass").value;

  if (!name || !cls) {
    alert("⚠️ Iltimos, ismingizni kiriting va sinfingizni tanlang!");
    return;
  }

  currentUser = { name, class: cls };
  localStorage.setItem("maktabUser", JSON.stringify(currentUser));
  showApp();
});

function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("userInfo").textContent = `👤 ${currentUser.name} • 🏫 ${currentUser.class}`;
  
  updateStats();
  renderTable();
  renderDayView();
}

function logout() {
  if (confirm("Chiqishni xohlaysizmi?")) {
    localStorage.removeItem("maktabUser");
    location.reload();
  }
}

document.getElementById("logoutBtn").addEventListener("click", logout);

// ============ STATISTIKA ============
function getTodayName() {
  const today = new Date().getDay(); // 0=Yakshanba, 1=Dushanba...
  const map = { 1: "Dushanba", 2: "Seshanba", 3: "Chorshanba", 4: "Payshanba", 5: "Juma", 6: "Shanba" };
  return map[today] || null;
}

function updateStats() {
  const today = getTodayName();
  document.getElementById("currentDay").textContent = today || "Dam olish";

  const todayLessons = lessons.filter(l => l.day === today && l.class === currentUser.class);
  document.getElementById("todayCount").textContent = todayLessons.length;

  // Keyingi darsni topish
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  
  const next = todayLessons
    .filter(l => l.start > currentTime)
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  if (next) {
    document.getElementById("nextLesson").textContent = `${next.subject} ${next.start}`;
  } else if (todayLessons.length > 0) {
    document.getElementById("nextLesson").textContent = "Darslar tugadi";
  } else {
    document.getElementById("nextLesson").textContent = "Dars yo'q";
  }
}

// ============ JADVALNI CHIZISH ============
function renderTable() {
  const tbody = document.getElementById("scheduleBody");
  tbody.innerHTML = "";

  const searchValue = document.getElementById("searchInput").value.toLowerCase().trim();
  const dayFilter = document.getElementById("dayFilter").value;

  const today = getTodayName();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  timeSlots.forEach(slot => {
    const row = document.createElement("tr");

    // Vaqt ustuni
    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    timeCell.textContent = `${slot.start}\n${slot.end}`;
    timeCell.style.whiteSpace = "pre-line";
    row.appendChild(timeCell);

    // Har bir kun
    days.forEach(day => {
      const cell = document.createElement("td");

      if (dayFilter !== "all" && dayFilter !== day) {
        row.appendChild(cell);
        return;
      }

      const dayLessons = lessons.filter(l =>
        l.day === day &&
        l.start === slot.start &&
        l.class === currentUser.class &&
        (searchValue === "" ||
          l.subject.toLowerCase().includes(searchValue) ||
          l.teacher.toLowerCase().includes(searchValue))
      );

      dayLessons.forEach(lesson => {
        const isCurrent = (day === today && lesson.start <= currentTime && lesson.end >= currentTime);

        const div = document.createElement("div");
        div.className = "lesson-cell" + (isCurrent ? " current" : "");
        div.innerHTML = `
          <span class="lesson-subject">${isCurrent ? "🔴 " : ""}${lesson.subject}</span>
          <span class="lesson-info">👨‍🏫 ${lesson.teacher}</span>
          <span class="lesson-info">🚪 Xona: ${lesson.room}</span>
          <div class="lesson-actions">
            <button class="edit-btn">✏️ Tahrir</button>
            <button class="delete-btn">🗑️ O'chir</button>
          </div>
        `;

        div.querySelector(".edit-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          openEditModal(lesson.id);
        });

        div.querySelector(".delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteLesson(lesson.id);
        });

        cell.appendChild(div);
      });

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
}

// ============ KUNLIK KO'RINISH ============
function renderDayView() {
  const today = getTodayName();
  const list = document.getElementById("dayViewList");
  const title = document.getElementById("dayViewTitle");

  if (!today) {
    title.textContent = "🏖️ Bugun dam olish kuni!";
    list.innerHTML = "<p style='color:#64748b; text-align:center; padding:20px;'>Darslar yo'q</p>";
    return;
  }

  title.textContent = `📅 ${today} — darslaringiz`;

  const todayLessons = lessons
    .filter(l => l.day === today && l.class === currentUser.class)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (todayLessons.length === 0) {
    list.innerHTML = "<p style='color:#64748b; text-align:center; padding:20px;'>Bugun darslar yo'q</p>";
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  list.innerHTML = "";

  todayLessons.forEach(lesson => {
    const isCurrent = lesson.start <= currentTime && lesson.end >= currentTime;

    const div = document.createElement("div");
    div.className = "day-lesson" + (isCurrent ? " current" : "");
    div.innerHTML = `
      <div class="day-time">${lesson.start} - ${lesson.end}</div>
      <div class="day-details">
        <div class="day-subject">${isCurrent ? "🔴 " : ""}${lesson.subject}</div>
        <div class="day-meta">👨‍🏫 ${lesson.teacher} • 🚪 Xona: ${lesson.room}</div>
      </div>
    `;
    list.appendChild(div);
  });
}

// ============ TABLARNI ALMASHTIRISH ============
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const view = tab.dataset.view;
    if (view === "week") {
      document.getElementById("weekView").classList.remove("hidden");
      document.getElementById("dayView").classList.add("hidden");
    } else {
      document.getElementById("weekView").classList.add("hidden");
      document.getElementById("dayView").classList.remove("hidden");
      renderDayView();
    }
  });
});

// ============ MODAL ============
const modal = document.getElementById("modal");
const form = document.getElementById("lessonForm");

function openModal() {
  document.getElementById("modalTitle").textContent = "➕ Yangi dars qo'shish";
  document.getElementById("editId").value = "";
  form.reset();
  modal.classList.remove("hidden");
}

function openEditModal(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return;

  document.getElementById("modalTitle").textContent = "✏️ Darsni tahrirlash";
  document.getElementById("editId").value = lesson.id;
  document.getElementById("newDay").value = lesson.day;
  document.getElementById("newTimeStart").value = lesson.start;
  document.getElementById("newTimeEnd").value = lesson.end;
  document.getElementById("newSubject").value = lesson.subject;
  document.getElementById("newTeacher").value = lesson.teacher;
  document.getElementById("newClass").value = lesson.class;
  document.getElementById("newRoom").value = lesson.room;

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

document.getElementById("addBtn").addEventListener("click", openModal);
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ============ FORMA TOPSHIRISH ============
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const editId = document.getElementById("editId").value;

  const data = {
    day: document.getElementById("newDay").value,
    start: document.getElementById("newTimeStart").value,
    end: document.getElementById("newTimeEnd").value,
    subject: document.getElementById("newSubject").value.trim(),
    teacher: document.getElementById("newTeacher").value.trim(),
    class: document.getElementById("newClass").value.trim(),
    room: document.getElementById("newRoom").value.trim(),
  };

  if (data.start >= data.end) {
    alert("⚠️ Tugash vaqti boshlanishdan keyin bo'lishi kerak!");
    return;
  }

  if (editId) {
    const idx = lessons.findIndex(l => l.id === Number(editId));
    if (idx !== -1) lessons[idx] = { ...lessons[idx], ...data };
  } else {
    lessons.push({ id: Date.now(), ...data });
  }

  saveToStorage();
  renderTable();
  renderDayView();
  updateStats();
  closeModal();
});

// ============ O'CHIRISH ============
function deleteLesson(id) {
  if (confirm("🗑️ Bu darsni o'chirmoqchimisiz?")) {
    lessons = lessons.filter(l => l.id !== id);
    saveToStorage();
    renderTable();
    renderDayView();
    updateStats();
  }
}

// ============ SAQLASH / YUKLASH ============
function saveToStorage() {
  localStorage.setItem("maktabLessons", JSON.stringify(lessons));
}

function loadFromStorage() {
  const saved = localStorage.getItem("maktabLessons");
  if (saved) {
    try { lessons = JSON.parse(saved); } catch (e) {}
  }
  const user = localStorage.getItem("maktabUser");
  if (user) {
    try {
      currentUser = JSON.parse(user);
      showApp();
    } catch (e) {}
  }
}

// ============ FILTRLAR ============
document.getElementById("searchInput").addEventListener("input", renderTable);
document.getElementById("dayFilter").addEventListener("change", renderTable);

// ============ AVTOMATIK YANGILASH (har 30 sek) ============
setInterval(() => {
  updateStats();
  renderTable();
  renderDayView();
}, 30000);

// ============ ISHGA TUSHIRISH ============
loadFromStorage();