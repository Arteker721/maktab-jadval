const mongoose = require('mongoose');

// ============ USER ============
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  class: { type: String, default: null },
  salt: { type: String, required: true },
  hash: { type: String, required: true },
}, { timestamps: true });

// ============ LESSON ============
const lessonSchema = new mongoose.Schema({
  day: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  subject: { type: String, required: true },
  teacher: { type: String, default: '' },
  class: { type: String, required: true },
  room: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

// ============ SUBJECT ============
const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#6366f1' },
}, { timestamps: true });

// ============ HOMEWORK ============
const homeworkSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  class: { type: String, required: true },
  text: { type: String, required: true },
  dueDate: { type: String, default: null },
  author: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

// ============ NOTE ============
const noteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  text: { type: String, required: true },
}, { timestamps: true });

// ============ FAVORITE ============
const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  lessonId: { type: String, required: true },
}, { timestamps: true });

// ============ ANNOUNCEMENT ============
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, default: '' },
  authorRole: { type: String, default: '' },
}, { timestamps: true });

// ============ TOKEN ============
const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  Lesson: mongoose.model('Lesson', lessonSchema),
  Subject: mongoose.model('Subject', subjectSchema),
  Homework: mongoose.model('Homework', homeworkSchema),
  Note: mongoose.model('Note', noteSchema),
  Favorite: mongoose.model('Favorite', favoriteSchema),
  Announcement: mongoose.model('Announcement', announcementSchema),
  Token: mongoose.model('Token', tokenSchema),
};