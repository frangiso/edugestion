import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
  limit, startAfter, writeBatch
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./firebase";

// ═══════════════════════════════════════════════════════════════════
// CACHÉ GLOBAL EN MEMORIA
// ═══════════════════════════════════════════════════════════════════
const cache = {
  teachers: null,
  parents: null,
  allStudents: null,
  teacherGrades: {},
  studentGrades: {},
  observations: {},
  studentNames: {},
  teacherGradesLastDoc: {},
  teacherGradesAllLoaded: {},
  upcomingByTeacher: {},
  upcomingPastByTeacher: {},
  upcomingFiltered: {},
  gradeTypes: {},
  // Actitudinales
  attitudesByTeacher: {},   // { [teacherId]: [...] }
  attitudesByStudent: {},   // { [studentId]: [...] }
};

const PAGE_SIZE = 20;
const today = () => new Date().toISOString().split("T")[0];

const DEFAULT_TYPES = ["Examen","Recuperatorio","Trabajo Práctico","Exposición","Proyecto","Parcial","Cuestionario","Otro"];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
async function ensureStudentsLoaded() {
  if (cache.allStudents) return cache.allStudents;
  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  cache.allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.allStudents.forEach(s => { cache.studentNames[s.id] = s.name; });
  return cache.allStudents;
}

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE EVALUACIÓN PERSONALIZADOS
// ═══════════════════════════════════════════════════════════════════
export async function getGradeTypes(teacherId) {
  if (cache.gradeTypes[teacherId]) return cache.gradeTypes[teacherId];
  const snap = await getDoc(doc(db, "users", teacherId));
  const custom = snap.exists() ? (snap.data().gradeTypes || []) : [];
  const merged = [...DEFAULT_TYPES];
  custom.forEach(t => { if (!merged.includes(t)) merged.push(t); });
  cache.gradeTypes[teacherId] = merged;
  return merged;
}

export async function addGradeType(teacherId, newType) {
  const trimmed = newType.trim();
  if (!trimmed) return;
  const current = await getGradeTypes(teacherId);
  if (current.includes(trimmed)) return;
  const updated = [...current, trimmed];
  const customOnly = updated.filter(t => !DEFAULT_TYPES.includes(t));
  await updateDoc(doc(db, "users", teacherId), { gradeTypes: customOnly });
  cache.gradeTypes[teacherId] = updated;
  cache.teachers = null;
  return updated;
}

// ═══════════════════════════════════════════════════════════════════
// USUARIOS / PERFILES
// ═══════════════════════════════════════════════════════════════════
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllTeachers() {
  if (cache.teachers) return cache.teachers;
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
  cache.teachers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cache.teachers;
}

export async function searchParents(searchText = "") {
  if (!cache.parents) {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "parent")));
    cache.parents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  let results = cache.parents;
  if (searchText) {
    const q = searchText.toLowerCase();
    results = results.filter(p => p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }
  return results;
}

export async function createUser(email, password, profileData) {
  let cred;
  try { cred = await createUserWithEmailAndPassword(auth, email, password); }
  catch(e) { if (e.code === 'auth/email-already-in-use') throw new Error("Este email ya está registrado."); throw e; }
  await setDoc(doc(db, "users", cred.user.uid), { ...profileData, email, createdAt: serverTimestamp() });
  if (profileData.role === "parent" && cache.parents) cache.parents = [...cache.parents, { id: cred.user.uid, ...profileData, email }];
  if (profileData.role === "teacher") cache.teachers = null;
  return cred.user.uid;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
  cache.teachers = null; cache.parents = null;
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
  cache.teachers = null;
  if (cache.parents) cache.parents = cache.parents.filter(p => p.id !== uid);
}

// ═══════════════════════════════════════════════════════════════════
// ALUMNOS
// ═══════════════════════════════════════════════════════════════════
export async function searchStudents({ name = "", grade = "" } = {}) {
  if (grade && !name) return await getStudentsByGrade(grade);
  const all = await ensureStudentsLoaded();
  let results = all;
  if (name) results = results.filter(s => s.name.toLowerCase().includes(name.toLowerCase()));
  if (grade) results = results.filter(s => s.grade === grade);
  return results;
}

export async function getAllStudents() { return await ensureStudentsLoaded(); }

export async function getStudentsByGrade(grade) {
  const snap = await getDocs(query(collection(db, "students"), where("grade", "==", grade), orderBy("name")));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (cache.allStudents) {
    results.forEach(s => {
      const idx = cache.allStudents.findIndex(x => x.id === s.id);
      if (idx !== -1) cache.allStudents[idx] = s;
      else cache.allStudents.push(s);
    });
    cache.allStudents.sort((a,b) => a.name.localeCompare(b.name));
  }
  return results;
}

export async function getChildrenByIds(childIds = [], tutorEmail = "") {
  const all = await ensureStudentsLoaded();
  const results = [];
  for (const id of childIds) { const s = all.find(x => x.id === id); if (s) results.push(s); }
  if (tutorEmail) {
    all.filter(s => s.tutorEmail === tutorEmail).forEach(s => {
      if (!results.find(r => r.id === s.id)) results.push(s);
    });
  }
  return results;
}

export async function createStudent(data) {
  const ref = await addDoc(collection(db, "students"), { ...data, createdAt: serverTimestamp() });
  const newStudent = { id: ref.id, ...data };
  if (cache.allStudents) {
    cache.allStudents = [...cache.allStudents, newStudent].sort((a,b) => a.name.localeCompare(b.name));
    cache.studentNames[ref.id] = data.name;
  }
  return ref.id;
}

// Edición completa: nombre, año, tutorEmail
export async function updateStudent(id, data) {
  await updateDoc(doc(db, "students", id), data);
  if (cache.allStudents) {
    cache.allStudents = cache.allStudents.map(s => s.id === id ? { ...s, ...data } : s);
    if (data.name) cache.studentNames[id] = data.name;
  }
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, "students", id));
  if (cache.allStudents) cache.allStudents = cache.allStudents.filter(s => s.id !== id);
  delete cache.studentNames[id];
  delete cache.studentGrades[id];
  delete cache.attitudesByStudent[id];
}

// ═══════════════════════════════════════════════════════════════════
// NOTAS
// ═══════════════════════════════════════════════════════════════════
// Trae TODAS las notas sin límite — pagina de a 500 hasta agotar
// Se usa en el panel del director y en el export Excel
let allGradesCache = null;
export async function getAllGrades() {
  if (allGradesCache) return allGradesCache;
  const results = [];
  let lastDoc = null;
  while (true) {
    const q = lastDoc
      ? query(collection(db, "grades"), orderBy("date", "desc"), startAfter(lastDoc), limit(500))
      : query(collection(db, "grades"), orderBy("date", "desc"), limit(500));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
    if (snap.docs.length < 500) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  allGradesCache = results;
  return results;
}

// Trae TODAS las notas de un profe sin paginación (para "Ver alumno")
export async function getAllGradesByTeacher(teacherId) {
  const cacheKey = `all_${teacherId}`;
  if (cache.teacherGrades[cacheKey]) return cache.teacherGrades[cacheKey];
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("teacherId", "==", teacherId),
    orderBy("date", "desc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.teacherGrades[cacheKey] = results;
  return results;
}

export async function searchGrades({ studentId = "", trimester = 0 } = {}) {
  if (studentId && cache.studentGrades[studentId]) {
    let r = cache.studentGrades[studentId];
    if (trimester) r = r.filter(g => g.trimester === trimester);
    return r;
  }
  let q;
  if (studentId && trimester) q = query(collection(db,"grades"), where("studentId","==",studentId), where("trimester","==",trimester), orderBy("date","desc"));
  else if (studentId) q = query(collection(db,"grades"), where("studentId","==",studentId), orderBy("date","desc"));
  else if (trimester) q = query(collection(db,"grades"), where("trimester","==",trimester), orderBy("date","desc"));
  else q = query(collection(db,"grades"), orderBy("date","desc"), limit(50));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (studentId && !trimester) cache.studentGrades[studentId] = results;
  return results;
}

export async function getGradesStats() {
  const snap = await getDocs(query(collection(db,"grades"), orderBy("date","desc"), limit(200)));
  const grades = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  return { total: grades.length, byTrimester: [1,2,3].map(t => { const tg = grades.filter(g=>g.trimester===t); return { t, count:tg.length, avg: tg.length>0?(tg.reduce((a,g)=>a+g.score,0)/tg.length).toFixed(1):"–" }; }) };
}

export async function getGradesByTeacherPaged(teacherId) {
  if (cache.teacherGradesAllLoaded[teacherId] && cache.teacherGrades[teacherId]) return { grades: cache.teacherGrades[teacherId], hasMore: false };
  const q = query(collection(db,"grades"), where("teacherId","==",teacherId), orderBy("date","desc"), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.teacherGrades[teacherId] = results;
  cache.teacherGradesLastDoc[teacherId] = snap.docs[snap.docs.length-1];
  const hasMore = snap.docs.length === PAGE_SIZE;
  if (!hasMore) cache.teacherGradesAllLoaded[teacherId] = true;
  results.forEach(g => { if (g.studentId) { if (!cache.studentGrades[g.studentId]) cache.studentGrades[g.studentId]=[]; if (!cache.studentGrades[g.studentId].find(x=>x.id===g.id)) cache.studentGrades[g.studentId].push(g); } });
  return { grades: results, hasMore };
}

export async function getMoreGradesByTeacher(teacherId) {
  if (cache.teacherGradesAllLoaded[teacherId]) return { grades: cache.teacherGrades[teacherId], hasMore: false };
  const lastDoc = cache.teacherGradesLastDoc[teacherId];
  if (!lastDoc) return { grades: cache.teacherGrades[teacherId]||[], hasMore: false };
  const q = query(collection(db,"grades"), where("teacherId","==",teacherId), orderBy("date","desc"), startAfter(lastDoc), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const newResults = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.teacherGrades[teacherId] = [...(cache.teacherGrades[teacherId]||[]), ...newResults];
  cache.teacherGradesLastDoc[teacherId] = snap.docs[snap.docs.length-1];
  const hasMore = snap.docs.length === PAGE_SIZE;
  if (!hasMore) cache.teacherGradesAllLoaded[teacherId] = true;
  return { grades: cache.teacherGrades[teacherId], hasMore };
}

export async function getGradesByStudent(studentId) {
  if (cache.studentGrades[studentId]) return cache.studentGrades[studentId];
  const snap = await getDocs(query(collection(db,"grades"), where("studentId","==",studentId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.studentGrades[studentId] = results;
  return results;
}

export async function getGradesByStudentFiltered(studentId, { subject="", trimester=0 }={}) {
  if (cache.studentGrades[studentId]) {
    let r = cache.studentGrades[studentId];
    if (subject) r = r.filter(g=>g.subject===subject);
    if (trimester) r = r.filter(g=>g.trimester===trimester);
    return r;
  }
  const conditions = [where("studentId","==",studentId)];
  if (trimester) conditions.push(where("trimester","==",trimester));
  const snap = await getDocs(query(collection(db,"grades"), ...conditions, orderBy("date","desc")));
  let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (subject) results = results.filter(g=>g.subject===subject);
  if (!subject && !trimester) cache.studentGrades[studentId] = results;
  return results;
}

export async function createGrade(data) {
  allGradesCache = null;
  const ref = await addDoc(collection(db,"grades"), { ...data, createdAt: serverTimestamp() });
  const newGrade = { id:ref.id, ...data };
  if (data.teacherId) { if (!cache.teacherGrades[data.teacherId]) cache.teacherGrades[data.teacherId]=[]; cache.teacherGrades[data.teacherId]=[newGrade,...cache.teacherGrades[data.teacherId]]; }
  if (data.studentId) { if (!cache.studentGrades[data.studentId]) cache.studentGrades[data.studentId]=[]; cache.studentGrades[data.studentId]=[newGrade,...cache.studentGrades[data.studentId]]; }
  return ref.id;
}

export async function createGradesBatch(gradesData) {
  const BATCH_LIMIT = 499;
  const chunks = [];
  for (let i = 0; i < gradesData.length; i += BATCH_LIMIT) chunks.push(gradesData.slice(i, i + BATCH_LIMIT));
  const allNew = [];
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    const newDocs = chunk.map(data => { const ref = doc(collection(db,"grades")); batch.set(ref, { ...data, createdAt: serverTimestamp() }); return { id: ref.id, ...data }; });
    await batch.commit();
    allNew.push(...newDocs);
  }
  allNew.forEach(ng => {
    if (ng.teacherId) { if (!cache.teacherGrades[ng.teacherId]) cache.teacherGrades[ng.teacherId]=[]; cache.teacherGrades[ng.teacherId]=[ng,...cache.teacherGrades[ng.teacherId]]; }
    if (ng.studentId) { if (!cache.studentGrades[ng.studentId]) cache.studentGrades[ng.studentId]=[]; cache.studentGrades[ng.studentId]=[ng,...cache.studentGrades[ng.studentId]]; }
  });
  return allNew;
}

export async function deleteGrade(id) {
  await deleteDoc(doc(db,"grades",id));
  allGradesCache = null;
  Object.keys(cache.teacherGrades).forEach(k=>{ cache.teacherGrades[k]=cache.teacherGrades[k].filter(g=>g.id!==id); });
  Object.keys(cache.studentGrades).forEach(k=>{ cache.studentGrades[k]=cache.studentGrades[k].filter(g=>g.id!==id); });
}

// ═══════════════════════════════════════════════════════════════════
// ACTITUDINALES
// Colección: attitudes
// Campos: teacherId, teacherName, studentId, studentName, studentGrade,
//         subject, trimester, value (PD|DB|DM|DA), date, note
// Un único documento por alumno+materia+trimestre (upsert)
// ═══════════════════════════════════════════════════════════════════
export const ATTITUDE_VALUES = ["PD", "DB", "DM", "DA"];
export const ATTITUDE_LABELS = {
  PD: "Poco Desempeño",
  DB: "Desempeño Básico",
  DM: "Desempeño Medio",
  DA: "Desempeño Alto",
};
export const ATTITUDE_COLORS = {
  PD: "#ef4444",
  DB: "#f59e0b",
  DM: "#3b82f6",
  DA: "#10b981",
};

export async function getAttitudesByTeacher(teacherId) {
  if (cache.attitudesByTeacher[teacherId]) return cache.attitudesByTeacher[teacherId];
  const snap = await getDocs(query(collection(db,"attitudes"), where("teacherId","==",teacherId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.attitudesByTeacher[teacherId] = results;
  results.forEach(a => {
    if (a.studentId) {
      if (!cache.attitudesByStudent[a.studentId]) cache.attitudesByStudent[a.studentId]=[];
      if (!cache.attitudesByStudent[a.studentId].find(x=>x.id===a.id)) cache.attitudesByStudent[a.studentId].push(a);
    }
  });
  return results;
}

export async function getAttitudesByStudent(studentId) {
  if (cache.attitudesByStudent[studentId]) return cache.attitudesByStudent[studentId];
  const snap = await getDocs(query(collection(db,"attitudes"), where("studentId","==",studentId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.attitudesByStudent[studentId] = results;
  return results;
}

// Guarda o actualiza una actitudinal (upsert por teacherId+studentId+subject+trimester)
export async function saveAttitude(data) {
  // Buscar si ya existe
  const existing = await getDocs(query(
    collection(db,"attitudes"),
    where("teacherId","==",data.teacherId),
    where("studentId","==",data.studentId),
    where("subject","==",data.subject),
    where("trimester","==",data.trimester)
  ));
  let id;
  if (!existing.empty) {
    id = existing.docs[0].id;
    await updateDoc(doc(db,"attitudes",id), { ...data, updatedAt: serverTimestamp() });
  } else {
    const ref = await addDoc(collection(db,"attitudes"), { ...data, createdAt: serverTimestamp() });
    id = ref.id;
  }
  const saved = { id, ...data };
  // Actualizar caché
  if (cache.attitudesByTeacher[data.teacherId]) {
    const idx = cache.attitudesByTeacher[data.teacherId].findIndex(a => a.id === id);
    if (idx !== -1) cache.attitudesByTeacher[data.teacherId][idx] = saved;
    else cache.attitudesByTeacher[data.teacherId] = [saved, ...cache.attitudesByTeacher[data.teacherId]];
  }
  if (cache.attitudesByStudent[data.studentId]) {
    const idx = cache.attitudesByStudent[data.studentId].findIndex(a => a.id === id);
    if (idx !== -1) cache.attitudesByStudent[data.studentId][idx] = saved;
    else cache.attitudesByStudent[data.studentId] = [saved, ...cache.attitudesByStudent[data.studentId]];
  }
  return id;
}

// Guardar muchas actitudinales de golpe (carga masiva por curso)
export async function saveAttitudesBatch(attitudesData) {
  const results = await Promise.all(attitudesData.map(a => saveAttitude(a)));
  return results;
}

export async function deleteAttitude(id, teacherId, studentId) {
  await deleteDoc(doc(db,"attitudes",id));
  if (cache.attitudesByTeacher[teacherId]) cache.attitudesByTeacher[teacherId] = cache.attitudesByTeacher[teacherId].filter(a=>a.id!==id);
  if (cache.attitudesByStudent[studentId]) cache.attitudesByStudent[studentId] = cache.attitudesByStudent[studentId].filter(a=>a.id!==id);
  allAttitudesCache = null;
}

// Trae TODAS las actitudinales (para el export del director)
let allAttitudesCache = null;
export async function getAllAttitudes() {
  if (allAttitudesCache) return allAttitudesCache;
  const snap = await getDocs(query(collection(db,"attitudes"), orderBy("studentId")));
  allAttitudesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return allAttitudesCache;
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES
// ═══════════════════════════════════════════════════════════════════
export async function getObservationsByTeacher(teacherId) {
  const key = `teacher_${teacherId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(collection(db,"observations"), where("teacherId","==",teacherId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.observations[key] = results;
  results.forEach(o => { if (o.studentId) { const sk=`student_${o.studentId}`; if (!cache.observations[sk]) cache.observations[sk]=[]; if (!cache.observations[sk].find(x=>x.id===o.id)) cache.observations[sk].push(o); } });
  return results;
}

export async function getObservationsByStudent(studentId) {
  const key = `student_${studentId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(collection(db,"observations"), where("studentId","==",studentId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.observations[key] = results;
  return results;
}

export async function searchObservations({ studentId="", teacherName="" }={}) {
  if (studentId && cache.observations[`student_${studentId}`]) {
    let r = cache.observations[`student_${studentId}`];
    if (teacherName) r = r.filter(o=>(o.teacherName||"").toLowerCase().includes(teacherName.toLowerCase()));
    return r;
  }
  const q = studentId
    ? query(collection(db,"observations"), where("studentId","==",studentId), orderBy("date","desc"))
    : query(collection(db,"observations"), orderBy("date","desc"));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (teacherName) results = results.filter(o=>(o.teacherName||"").toLowerCase().includes(teacherName.toLowerCase()));
  return results;
}

export async function createObservation(data) {
  const ref = await addDoc(collection(db,"observations"), { ...data, createdAt: serverTimestamp() });
  const newObs = { id:ref.id, ...data };
  const tk=`teacher_${data.teacherId}`, sk=`student_${data.studentId}`;
  if (cache.observations[tk]) cache.observations[tk]=[newObs,...cache.observations[tk]];
  if (cache.observations[sk]) cache.observations[sk]=[newObs,...cache.observations[sk]];
  return ref.id;
}

export async function deleteObservation(id) {
  await deleteDoc(doc(db,"observations",id));
  Object.keys(cache.observations).forEach(k=>{ cache.observations[k]=cache.observations[k].filter(o=>o.id!==id); });
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES GENERALES DEL CURSO
// Colección: courseObservations
// Campos: grade, teacherId, teacherName, text, date
// ═══════════════════════════════════════════════════════════════════
export async function getCourseObservations(grade) {
  const key = `course_${grade}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(collection(db,"courseObservations"), where("grade","==",grade)));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => b.date.localeCompare(a.date));
  cache.observations[key] = results;
  return results;
}

export async function createCourseObservation(data) {
  const ref = await addDoc(collection(db,"courseObservations"), { ...data, createdAt: serverTimestamp() });
  const newObs = { id:ref.id, ...data };
  const key = `course_${data.grade}`;
  if (cache.observations[key]) cache.observations[key] = [newObs, ...cache.observations[key]];
  return ref.id;
}

export async function deleteCourseObservation(id, grade) {
  await deleteDoc(doc(db,"courseObservations",id));
  const key = `course_${grade}`;
  if (cache.observations[key]) cache.observations[key] = cache.observations[key].filter(o=>o.id!==id);
}

// ═══════════════════════════════════════════════════════════════════
// PRÓXIMAS EVALUACIONES
// ═══════════════════════════════════════════════════════════════════
export async function getUpcomingByTeacher(teacherId) {
  const key = `${teacherId}_vigentes`;
  if (cache.upcomingByTeacher[key]) return cache.upcomingByTeacher[key];
  const snap = await getDocs(query(collection(db,"upcoming"), where("teacherId","==",teacherId), where("dateEnd",">=",today()), orderBy("dateEnd","asc")));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.upcomingByTeacher[key] = results;
  return results;
}

export async function getUpcomingPastByTeacher(teacherId) {
  const key = `${teacherId}_pasadas`;
  if (cache.upcomingPastByTeacher[key]) return cache.upcomingPastByTeacher[key];
  const snap = await getDocs(query(collection(db,"upcoming"), where("teacherId","==",teacherId), where("dateEnd","<",today()), orderBy("dateEnd","desc"), limit(20)));
  const results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  cache.upcomingPastByTeacher[key] = results;
  return results;
}

export async function getUpcomingFiltered({ grade="", subject="" }={}) {
  const cacheKey = `${grade}_${subject}`;
  if (cache.upcomingFiltered[cacheKey]) return cache.upcomingFiltered[cacheKey];
  const conditions = [where("dateEnd",">=",today())];
  if (subject) conditions.push(where("subject","==",subject));
  const snap = await getDocs(query(collection(db,"upcoming"), ...conditions, orderBy("dateEnd","asc")));
  let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (grade) results = results.filter(u => !u.grade || u.grade==="" || u.grade===grade);
  cache.upcomingFiltered[cacheKey] = results;
  return results;
}

export async function createUpcoming(data) {
  const ref = await addDoc(collection(db,"upcoming"), { ...data, createdAt: serverTimestamp() });
  const newItem = { id:ref.id, ...data };
  const key = `${data.teacherId}_vigentes`;
  if (cache.upcomingByTeacher[key]) cache.upcomingByTeacher[key] = [...cache.upcomingByTeacher[key], newItem].sort((a,b)=>a.dateEnd.localeCompare(b.dateEnd));
  cache.upcomingFiltered = {};
  return ref.id;
}

export async function deleteUpcoming(id, teacherId) {
  await deleteDoc(doc(db,"upcoming",id));
  const vk=`${teacherId}_vigentes`, pk=`${teacherId}_pasadas`;
  if (cache.upcomingByTeacher[vk]) cache.upcomingByTeacher[vk]=cache.upcomingByTeacher[vk].filter(u=>u.id!==id);
  if (cache.upcomingPastByTeacher[pk]) cache.upcomingPastByTeacher[pk]=cache.upcomingPastByTeacher[pk].filter(u=>u.id!==id);
  cache.upcomingFiltered = {};
}

export async function updateUpcoming(id, teacherId, data) {
  await updateDoc(doc(db,"upcoming",id), data);
  const vk=`${teacherId}_vigentes`, pk=`${teacherId}_pasadas`;
  if (cache.upcomingByTeacher[vk]) cache.upcomingByTeacher[vk]=cache.upcomingByTeacher[vk].map(u=>u.id===id?{...u,...data}:u);
  if (cache.upcomingPastByTeacher[pk]) cache.upcomingPastByTeacher[pk]=cache.upcomingPastByTeacher[pk].map(u=>u.id===id?{...u,...data}:u);
  cache.upcomingFiltered = {};
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
