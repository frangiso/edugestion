import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
  limit, startAfter
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { db, auth } from "./firebase";

// ═══════════════════════════════════════════════════════════════════
// CACHÉ GLOBAL EN MEMORIA
// ═══════════════════════════════════════════════════════════════════
const cache = {
  teachers: null,
  parents: null,
  allStudents: null,
  grades: null,
  teacherGrades: {},
  studentGrades: {},       // { [studentId]: [...] }
  studentGradesBySubject: {}, // { [studentId_subject]: [...] }
  studentGradesByTrim: {},    // { [studentId_trim]: [...] }
  observations: {},
  studentNames: {},
  teacherGradesLastDoc: {},
  teacherGradesAllLoaded: {},
};

const PAGE_SIZE = 20;

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
  results = await Promise.all(results.map(async p => {
    if (p.childrenNames && p.childrenNames.length > 0) return p;
    const names = await resolveChildrenNames(p.childIds || [], p.email);
    if (names.length > 0) {
      await updateDoc(doc(db, "users", p.id), { childrenNames: names });
      p.childrenNames = names;
      const idx = cache.parents.findIndex(x => x.id === p.id);
      if (idx !== -1) cache.parents[idx] = { ...cache.parents[idx], childrenNames: names };
    }
    return { ...p, childrenNames: names };
  }));
  return results;
}

export async function resolveChildrenNames(childIds = [], tutorEmail = "") {
  const names = [];
  const missingIds = [];
  for (const id of childIds) {
    if (cache.studentNames[id]) names.push(cache.studentNames[id]);
    else missingIds.push(id);
  }
  for (const id of missingIds) {
    if (cache.allStudents) {
      const s = cache.allStudents.find(x => x.id === id);
      if (s) { cache.studentNames[id] = s.name; names.push(s.name); continue; }
    }
    const snap = await getDoc(doc(db, "students", id));
    if (snap.exists()) { const name = snap.data().name; cache.studentNames[id] = name; names.push(name); }
  }
  if (childIds.length === 0 && tutorEmail) {
    if (cache.allStudents) {
      cache.allStudents.filter(s => s.tutorEmail === tutorEmail).forEach(s => names.push(s.name));
    } else {
      const snap = await getDocs(query(collection(db, "students"), where("tutorEmail", "==", tutorEmail)));
      snap.docs.forEach(d => { const name = d.data().name; cache.studentNames[d.id] = name; names.push(name); });
    }
  }
  return names;
}

export async function createUser(email, password, profileData) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') throw new Error("Este email ya está registrado. Usá otro email.");
    throw e;
  }
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
  const all = await ensureStudentsLoaded();
  let results = all;
  if (name) results = results.filter(s => s.name.toLowerCase().includes(name.toLowerCase()));
  if (grade) results = results.filter(s => s.grade === grade);
  return results;
}

export async function getAllStudents() {
  return await ensureStudentsLoaded();
}

export async function getChildrenByIds(childIds = [], tutorEmail = "") {
  const all = await ensureStudentsLoaded();
  const results = [];
  for (const id of childIds) {
    const s = all.find(x => x.id === id);
    if (s) results.push(s);
  }
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

export async function updateStudent(id, data) {
  await updateDoc(doc(db, "students", id), data);
  if (cache.allStudents) cache.allStudents = cache.allStudents.map(s => s.id === id ? { ...s, ...data } : s);
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, "students", id));
  if (cache.allStudents) cache.allStudents = cache.allStudents.filter(s => s.id !== id);
  delete cache.studentNames[id];
  delete cache.studentGrades[id];
}

// ═══════════════════════════════════════════════════════════════════
// NOTAS - DIRECTOR lazy (busca por alumno y/o trimestre)
// ═══════════════════════════════════════════════════════════════════
export async function searchGrades({ studentId = "", trimester = 0 } = {}) {
  // Si tenemos todo en caché, filtrar en memoria
  if (cache.grades) {
    let results = cache.grades;
    if (studentId) results = results.filter(g => g.studentId === studentId);
    if (trimester) results = results.filter(g => g.trimester === trimester);
    return results;
  }
  // Si hay studentId, usar caché de alumno
  if (studentId && cache.studentGrades[studentId]) {
    let results = cache.studentGrades[studentId];
    if (trimester) results = results.filter(g => g.trimester === trimester);
    return results;
  }
  // Leer desde Firestore solo lo necesario
  let q;
  if (studentId && trimester) {
    q = query(collection(db, "grades"), where("studentId","==",studentId), where("trimester","==",trimester), orderBy("date","desc"));
  } else if (studentId) {
    q = query(collection(db, "grades"), where("studentId","==",studentId), orderBy("date","desc"));
  } else if (trimester) {
    q = query(collection(db, "grades"), where("trimester","==",trimester), orderBy("date","desc"));
  } else {
    // Sin filtros — solo las primeras 50
    q = query(collection(db, "grades"), orderBy("date","desc"), limit(50));
  }
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Guardar en caché de alumno si aplica
  if (studentId && !trimester) cache.studentGrades[studentId] = results;
  return results;
}

// Para resumen del director (solo stats, sin cargar todas las notas)
export async function getGradesStats() {
  // Si ya tenemos todas en caché, calcular de ahí
  if (cache.grades) {
    return {
      total: cache.grades.length,
      byTrimester: [1,2,3].map(t => ({
        t,
        count: cache.grades.filter(g=>g.trimester===t).length,
        avg: cache.grades.filter(g=>g.trimester===t).length > 0
          ? (cache.grades.filter(g=>g.trimester===t).reduce((a,g)=>a+g.score,0) / cache.grades.filter(g=>g.trimester===t).length).toFixed(1)
          : "–"
      }))
    };
  }
  // Leer solo las últimas 200 para el resumen — muestra representativa
  const snap = await getDocs(query(collection(db, "grades"), orderBy("date","desc"), limit(200)));
  const grades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    total: grades.length,
    byTrimester: [1,2,3].map(t => {
      const tg = grades.filter(g=>g.trimester===t);
      return { t, count: tg.length, avg: tg.length>0 ? (tg.reduce((a,g)=>a+g.score,0)/tg.length).toFixed(1) : "–" };
    })
  };
}

// ═══════════════════════════════════════════════════════════════════
// NOTAS - PROFESOR (paginadas)
// ═══════════════════════════════════════════════════════════════════
export async function getGradesByTeacherPaged(teacherId) {
  if (cache.teacherGradesAllLoaded[teacherId] && cache.teacherGrades[teacherId]) {
    return { grades: cache.teacherGrades[teacherId], hasMore: false };
  }
  if (cache.grades) {
    const filtered = cache.grades.filter(g => g.teacherId === teacherId);
    cache.teacherGrades[teacherId] = filtered;
    cache.teacherGradesAllLoaded[teacherId] = true;
    return { grades: filtered, hasMore: false };
  }
  const q = query(collection(db, "grades"), where("teacherId","==",teacherId), orderBy("date","desc"), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.teacherGrades[teacherId] = results;
  cache.teacherGradesLastDoc[teacherId] = snap.docs[snap.docs.length - 1];
  const hasMore = snap.docs.length === PAGE_SIZE;
  if (!hasMore) cache.teacherGradesAllLoaded[teacherId] = true;
  results.forEach(g => {
    if (g.studentId) {
      if (!cache.studentGrades[g.studentId]) cache.studentGrades[g.studentId] = [];
      if (!cache.studentGrades[g.studentId].find(x=>x.id===g.id)) cache.studentGrades[g.studentId].push(g);
    }
  });
  return { grades: results, hasMore };
}

export async function getMoreGradesByTeacher(teacherId) {
  if (cache.teacherGradesAllLoaded[teacherId]) return { grades: cache.teacherGrades[teacherId], hasMore: false };
  const lastDoc = cache.teacherGradesLastDoc[teacherId];
  if (!lastDoc) return { grades: cache.teacherGrades[teacherId] || [], hasMore: false };
  const q = query(collection(db, "grades"), where("teacherId","==",teacherId), orderBy("date","desc"), startAfter(lastDoc), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  const newResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.teacherGrades[teacherId] = [...(cache.teacherGrades[teacherId]||[]), ...newResults];
  cache.teacherGradesLastDoc[teacherId] = snap.docs[snap.docs.length - 1];
  const hasMore = snap.docs.length === PAGE_SIZE;
  if (!hasMore) cache.teacherGradesAllLoaded[teacherId] = true;
  newResults.forEach(g => {
    if (g.studentId) {
      if (!cache.studentGrades[g.studentId]) cache.studentGrades[g.studentId] = [];
      if (!cache.studentGrades[g.studentId].find(x=>x.id===g.id)) cache.studentGrades[g.studentId].push(g);
    }
  });
  return { grades: cache.teacherGrades[teacherId], hasMore };
}

// ═══════════════════════════════════════════════════════════════════
// NOTAS - TUTOR/ALUMNO (por materia y/o trimestre)
// ═══════════════════════════════════════════════════════════════════
export async function getGradesByStudent(studentId) {
  if (cache.studentGrades[studentId]) return cache.studentGrades[studentId];
  if (cache.grades) {
    const filtered = cache.grades.filter(g => g.studentId === studentId);
    cache.studentGrades[studentId] = filtered;
    return filtered;
  }
  const snap = await getDocs(query(collection(db, "grades"), where("studentId","==",studentId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.studentGrades[studentId] = results;
  return results;
}

// Notas de un alumno filtradas por materia y/o trimestre — para el tutor
export async function getGradesByStudentFiltered(studentId, { subject = "", trimester = 0 } = {}) {
  // Si ya tenemos todas las notas del alumno en caché, filtrar en memoria
  if (cache.studentGrades[studentId]) {
    let results = cache.studentGrades[studentId];
    if (subject) results = results.filter(g => g.subject === subject);
    if (trimester) results = results.filter(g => g.trimester === trimester);
    return results;
  }
  // Si hay filtros, leer solo lo que se necesita
  const conditions = [where("studentId","==",studentId)];
  if (trimester) conditions.push(where("trimester","==",trimester));
  const q = query(collection(db, "grades"), ...conditions, orderBy("date","desc"));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (subject) results = results.filter(g => g.subject === subject);
  // Si no hay filtros, cachear todo para este alumno
  if (!subject && !trimester) cache.studentGrades[studentId] = results;
  return results;
}

export async function createGrade(data) {
  const ref = await addDoc(collection(db, "grades"), { ...data, createdAt: serverTimestamp() });
  const newGrade = { id: ref.id, ...data };
  if (cache.grades) cache.grades = [newGrade, ...cache.grades];
  if (data.teacherId) {
    if (!cache.teacherGrades[data.teacherId]) cache.teacherGrades[data.teacherId] = [];
    cache.teacherGrades[data.teacherId] = [newGrade, ...cache.teacherGrades[data.teacherId]];
  }
  if (data.studentId) {
    if (!cache.studentGrades[data.studentId]) cache.studentGrades[data.studentId] = [];
    cache.studentGrades[data.studentId] = [newGrade, ...cache.studentGrades[data.studentId]];
  }
  return ref.id;
}

export async function deleteGrade(id) {
  await deleteDoc(doc(db, "grades", id));
  if (cache.grades) cache.grades = cache.grades.filter(g => g.id !== id);
  Object.keys(cache.teacherGrades).forEach(k => { cache.teacherGrades[k] = cache.teacherGrades[k].filter(g => g.id !== id); });
  Object.keys(cache.studentGrades).forEach(k => { cache.studentGrades[k] = cache.studentGrades[k].filter(g => g.id !== id); });
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES
// ═══════════════════════════════════════════════════════════════════
export async function getObservationsByTeacher(teacherId) {
  const key = `teacher_${teacherId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(collection(db, "observations"), where("teacherId","==",teacherId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.observations[key] = results;
  results.forEach(o => {
    if (o.studentId) {
      const skey = `student_${o.studentId}`;
      if (!cache.observations[skey]) cache.observations[skey] = [];
      if (!cache.observations[skey].find(x=>x.id===o.id)) cache.observations[skey].push(o);
    }
  });
  return results;
}

export async function getObservationsByStudent(studentId) {
  const key = `student_${studentId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(collection(db, "observations"), where("studentId","==",studentId), orderBy("date","desc")));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.observations[key] = results;
  return results;
}

export async function searchObservations({ studentId = "", teacherName = "" } = {}) {
  if (studentId && cache.observations[`student_${studentId}`]) {
    let results = cache.observations[`student_${studentId}`];
    if (teacherName) results = results.filter(o => (o.teacherName||"").toLowerCase().includes(teacherName.toLowerCase()));
    return results;
  }
  const q = studentId
    ? query(collection(db, "observations"), where("studentId","==",studentId), orderBy("date","desc"))
    : query(collection(db, "observations"), orderBy("date","desc"));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (teacherName) results = results.filter(o => (o.teacherName||"").toLowerCase().includes(teacherName.toLowerCase()));
  return results;
}

export async function createObservation(data) {
  const ref = await addDoc(collection(db, "observations"), { ...data, createdAt: serverTimestamp() });
  const newObs = { id: ref.id, ...data };
  const tkey = `teacher_${data.teacherId}`;
  const skey = `student_${data.studentId}`;
  if (cache.observations[tkey]) cache.observations[tkey] = [newObs, ...cache.observations[tkey]];
  if (cache.observations[skey]) cache.observations[skey] = [newObs, ...cache.observations[skey]];
  return ref.id;
}

export async function deleteObservation(id) {
  await deleteDoc(doc(db, "observations", id));
  Object.keys(cache.observations).forEach(k => { cache.observations[k] = cache.observations[k].filter(o => o.id !== id); });
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
