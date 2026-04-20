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
  studentGrades: {},
  observations: {},
  studentNames: {},
  teacherGradesLastDoc: {},
  teacherGradesAllLoaded: {},
  // Próximas evaluaciones
  upcomingByTeacher: {},      // { [teacherId_vigentes]: [...] }
  upcomingPastByTeacher: {},  // { [teacherId_pasadas]: [...] } — solo si pide ver anteriores
  upcomingFiltered: {},       // { [key]: [...] } — para tutor, clave = "grade_subject"
};

const PAGE_SIZE = 20;
const today = () => new Date().toISOString().split("T")[0];

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

export async function getAllStudents() { return await ensureStudentsLoaded(); }

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
// NOTAS
// ═══════════════════════════════════════════════════════════════════
export async function searchGrades({ studentId = "", trimester = 0 } = {}) {
  if (cache.grades) {
    let r = cache.grades;
    if (studentId) r = r.filter(g => g.studentId === studentId);
    if (trimester) r = r.filter(g => g.trimester === trimester);
    return r;
  }
  if (studentId && cache.studentGrades[studentId]) {
    let r = cache.studentGrades[studentId];
    if (trimester) r = r.filter(g => g.trimester === trimester);
    return r;
  }
  let q;
  if (studentId && trimester) q = query(collection(db, "grades"), where("studentId","==",studentId), where("trimester","==",trimester), orderBy("date","desc"));
  else if (studentId) q = query(collection(db, "grades"), where("studentId","==",studentId), orderBy("date","desc"));
  else if (trimester) q = query(collection(db, "grades"), where("trimester","==",trimester), orderBy("date","desc"));
  else q = query(collection(db, "grades"), orderBy("date","desc"), limit(50));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (studentId && !trimester) cache.studentGrades[studentId] = results;
  return results;
}

export async function getGradesStats() {
  if (cache.grades) {
    return { total: cache.grades.length, byTrimester: [1,2,3].map(t => { const tg = cache.grades.filter(g=>g.trimester===t); return { t, count: tg.length, avg: tg.length>0?(tg.reduce((a,g)=>a+g.score,0)/tg.length).toFixed(1):"–" }; }) };
  }
  const snap = await getDocs(query(collection(db, "grades"), orderBy("date","desc"), limit(200)));
  const grades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { total: grades.length, byTrimester: [1,2,3].map(t => { const tg = grades.filter(g=>g.trimester===t); return { t, count: tg.length, avg: tg.length>0?(tg.reduce((a,g)=>a+g.score,0)/tg.length).toFixed(1):"–" }; }) };
}

export async function getGradesByTeacherPaged(teacherId) {
  if (cache.teacherGradesAllLoaded[teacherId] && cache.teacherGrades[teacherId]) return { grades: cache.teacherGrades[teacherId], hasMore: false };
  if (cache.grades) { const f = cache.grades.filter(g=>g.teacherId===teacherId); cache.teacherGrades[teacherId]=f; cache.teacherGradesAllLoaded[teacherId]=true; return { grades:f, hasMore:false }; }
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
  if (cache.grades) { const f = cache.grades.filter(g=>g.studentId===studentId); cache.studentGrades[studentId]=f; return f; }
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
  const ref = await addDoc(collection(db,"grades"), { ...data, createdAt: serverTimestamp() });
  const newGrade = { id:ref.id, ...data };
  if (cache.grades) cache.grades = [newGrade, ...cache.grades];
  if (data.teacherId) { if (!cache.teacherGrades[data.teacherId]) cache.teacherGrades[data.teacherId]=[]; cache.teacherGrades[data.teacherId]=[newGrade,...cache.teacherGrades[data.teacherId]]; }
  if (data.studentId) { if (!cache.studentGrades[data.studentId]) cache.studentGrades[data.studentId]=[]; cache.studentGrades[data.studentId]=[newGrade,...cache.studentGrades[data.studentId]]; }
  return ref.id;
}

export async function deleteGrade(id) {
  await deleteDoc(doc(db,"grades",id));
  if (cache.grades) cache.grades = cache.grades.filter(g=>g.id!==id);
  Object.keys(cache.teacherGrades).forEach(k=>{ cache.teacherGrades[k]=cache.teacherGrades[k].filter(g=>g.id!==id); });
  Object.keys(cache.studentGrades).forEach(k=>{ cache.studentGrades[k]=cache.studentGrades[k].filter(g=>g.id!==id); });
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
// PRÓXIMAS EVALUACIONES
// Colección: upcoming
// Campos: teacherId, teacherName, subject, grade, title, type,
//         dateStart, dateEnd, trimester, description, createdAt
// ═══════════════════════════════════════════════════════════════════

// PROFESOR — solo vigentes (dateEnd >= hoy). Pasadas solo si las pide.
export async function getUpcomingByTeacher(teacherId) {
  const key = `${teacherId}_vigentes`;
  if (cache.upcomingByTeacher[key]) return cache.upcomingByTeacher[key];
  const snap = await getDocs(query(
    collection(db, "upcoming"),
    where("teacherId", "==", teacherId),
    where("dateEnd", ">=", today()),
    orderBy("dateEnd", "asc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.upcomingByTeacher[key] = results;
  return results;
}

// PROFESOR — pasadas, solo cuando hace clic en "Ver anteriores"
export async function getUpcomingPastByTeacher(teacherId) {
  const key = `${teacherId}_pasadas`;
  if (cache.upcomingPastByTeacher[key]) return cache.upcomingPastByTeacher[key];
  const snap = await getDocs(query(
    collection(db, "upcoming"),
    where("teacherId", "==", teacherId),
    where("dateEnd", "<", today()),
    orderBy("dateEnd", "desc"),
    limit(20)  // máximo 20 pasadas — suficiente
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.upcomingPastByTeacher[key] = results;
  return results;
}

// TUTOR — busca por año del hijo y opcionalmente materia. Solo vigentes.
// Clave de caché = grade + subject para no releer si busca lo mismo
export async function getUpcomingFiltered({ grade = "", subject = "" } = {}) {
  const cacheKey = `${grade}_${subject}`;
  if (cache.upcomingFiltered[cacheKey]) return cache.upcomingFiltered[cacheKey];

  const conditions = [where("dateEnd", ">=", today())];
  // Firestore no permite múltiples campos con inequality en la misma query,
  // así que filtramos grade en memoria si hace falta
  if (subject) conditions.push(where("subject", "==", subject));

  const snap = await getDocs(query(
    collection(db, "upcoming"),
    ...conditions,
    orderBy("dateEnd", "asc")
  ));
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtrar por año en memoria (no se puede combinar con dateEnd >= en Firestore sin índice compuesto)
  if (grade) results = results.filter(u => !u.grade || u.grade === "" || u.grade === grade);

  cache.upcomingFiltered[cacheKey] = results;
  return results;
}

export async function createUpcoming(data) {
  const ref = await addDoc(collection(db, "upcoming"), { ...data, createdAt: serverTimestamp() });
  const newItem = { id: ref.id, ...data };
  // Agregar a caché de vigentes del profesor
  const key = `${data.teacherId}_vigentes`;
  if (cache.upcomingByTeacher[key]) {
    cache.upcomingByTeacher[key] = [...cache.upcomingByTeacher[key], newItem].sort((a,b)=>a.dateEnd.localeCompare(b.dateEnd));
  }
  // Invalidar caché de tutores — ya que hay nueva evaluación
  cache.upcomingFiltered = {};
  return ref.id;
}

export async function deleteUpcoming(id, teacherId) {
  await deleteDoc(doc(db, "upcoming", id));
  const vk = `${teacherId}_vigentes`, pk = `${teacherId}_pasadas`;
  if (cache.upcomingByTeacher[vk]) cache.upcomingByTeacher[vk] = cache.upcomingByTeacher[vk].filter(u=>u.id!==id);
  if (cache.upcomingPastByTeacher[pk]) cache.upcomingPastByTeacher[pk] = cache.upcomingPastByTeacher[pk].filter(u=>u.id!==id);
  cache.upcomingFiltered = {};
}

export async function updateUpcoming(id, teacherId, data) {
  await updateDoc(doc(db, "upcoming", id), data);
  const vk = `${teacherId}_vigentes`, pk = `${teacherId}_pasadas`;
  if (cache.upcomingByTeacher[vk]) cache.upcomingByTeacher[vk] = cache.upcomingByTeacher[vk].map(u=>u.id===id?{...u,...data}:u);
  if (cache.upcomingPastByTeacher[pk]) cache.upcomingPastByTeacher[pk] = cache.upcomingPastByTeacher[pk].map(u=>u.id===id?{...u,...data}:u);
  cache.upcomingFiltered = {};
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
