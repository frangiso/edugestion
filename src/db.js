import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { db, auth } from "./firebase";

// ═══════════════════════════════════════════════════════════════════
// CACHÉ GLOBAL EN MEMORIA
// Toda la sesión reutiliza estos datos — 0 lecturas repetidas
// ═══════════════════════════════════════════════════════════════════
const cache = {
  // Usuarios
  teachers: null,                 // todos los profesores
  parents: null,                  // todos los tutores (se carga lazy)

  // Alumnos
  allStudents: null,              // todos los alumnos (se carga una vez)

  // Notas
  grades: null,                   // todas las notas (director)
  teacherGrades: {},              // { [teacherId]: [...] }
  studentGrades: {},              // { [studentId]: [...] }

  // Observaciones
  observations: {},               // { [teacher_id / student_id]: [...] }

  // Nombres de alumnos por ID (para tutores)
  studentNames: {},
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════════

// Asegura que todos los alumnos estén en caché — 1 lectura total por sesión
async function ensureStudentsLoaded() {
  if (cache.allStudents) return cache.allStudents;
  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  cache.allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Llenar caché de nombres también
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

// Tutores: carga lazy con caché completo
// Primera búsqueda lee Firestore, las siguientes filtran en memoria
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
  // Resolver nombres de hijos en memoria si ya tenemos los alumnos cargados
  results = await Promise.all(results.map(async p => {
    if (p.childrenNames && p.childrenNames.length > 0) return p;
    const names = await resolveChildrenNames(p.childIds || [], p.email);
    if (names.length > 0) {
      // Actualizar en Firestore y en caché
      await updateDoc(doc(db, "users", p.id), { childrenNames: names });
      p.childrenNames = names;
      // Actualizar en caché también
      const idx = cache.parents.findIndex(x => x.id === p.id);
      if (idx !== -1) cache.parents[idx] = { ...cache.parents[idx], childrenNames: names };
    }
    return { ...p, childrenNames: names };
  }));
  return results;
}

export async function resolveChildrenNames(childIds = [], tutorEmail = "") {
  const names = [];
  // Primero intentar desde caché de nombres (0 lecturas)
  const missingIds = [];
  for (const id of childIds) {
    if (cache.studentNames[id]) {
      names.push(cache.studentNames[id]);
    } else {
      missingIds.push(id);
    }
  }
  // Solo leer los que no están en caché
  for (const id of missingIds) {
    // Intentar desde allStudents si está cargado
    if (cache.allStudents) {
      const s = cache.allStudents.find(x => x.id === id);
      if (s) { cache.studentNames[id] = s.name; names.push(s.name); continue; }
    }
    const snap = await getDoc(doc(db, "students", id));
    if (snap.exists()) {
      const name = snap.data().name;
      cache.studentNames[id] = name;
      names.push(name);
    }
  }
  // Por email del tutor — solo si no hay childIds
  if (childIds.length === 0 && tutorEmail) {
    if (cache.allStudents) {
      // Filtrar en memoria — 0 lecturas
      cache.allStudents.filter(s => s.tutorEmail === tutorEmail).forEach(s => names.push(s.name));
    } else {
      const snap = await getDocs(query(collection(db, "students"), where("tutorEmail", "==", tutorEmail)));
      snap.docs.forEach(d => {
        const name = d.data().name;
        cache.studentNames[d.id] = name;
        names.push(name);
      });
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
  // Actualizar cachés sin releer
  cache.teachers = null; // invalidar solo si es profesor
  if (profileData.role === "parent" && cache.parents) {
    cache.parents = [...cache.parents, { id: cred.user.uid, ...profileData, email }];
  }
  if (profileData.role === "teacher") cache.teachers = null;
  return cred.user.uid;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
  cache.teachers = null;
  cache.parents = null;
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
  cache.teachers = null;
  if (cache.parents) cache.parents = cache.parents.filter(p => p.id !== uid);
}

// ═══════════════════════════════════════════════════════════════════
// ALUMNOS
// ═══════════════════════════════════════════════════════════════════

// Búsqueda siempre en memoria después de la primera carga — 0 lecturas repetidas
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

// Para el tutor — busca hijos en caché si está disponible
export async function getChildrenByIds(childIds = [], tutorEmail = "") {
  const all = await ensureStudentsLoaded(); // carga una vez y cachea
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
  // Agregar al caché sin releer
  if (cache.allStudents) {
    cache.allStudents = [...cache.allStudents, newStudent].sort((a,b) => a.name.localeCompare(b.name));
    cache.studentNames[ref.id] = data.name;
  }
  return ref.id;
}

export async function updateStudent(id, data) {
  await updateDoc(doc(db, "students", id), data);
  // Actualizar en caché sin releer
  if (cache.allStudents) {
    cache.allStudents = cache.allStudents.map(s => s.id === id ? { ...s, ...data } : s);
  }
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, "students", id));
  if (cache.allStudents) cache.allStudents = cache.allStudents.filter(s => s.id !== id);
  delete cache.studentNames[id];
  delete cache.studentGrades[id];
}

// ═══════════════════════════════════════════════════════════════════
// NOTAS / EVALUACIONES
// ═══════════════════════════════════════════════════════════════════

export async function getAllGrades() {
  if (cache.grades) return cache.grades;
  const snap = await getDocs(query(collection(db, "grades"), orderBy("date", "desc")));
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.grades = all;
  // Llenar cachés derivados automáticamente
  cache.teacherGrades = {};
  cache.studentGrades = {};
  all.forEach(g => {
    if (g.teacherId) {
      if (!cache.teacherGrades[g.teacherId]) cache.teacherGrades[g.teacherId] = [];
      cache.teacherGrades[g.teacherId].push(g);
    }
    if (g.studentId) {
      if (!cache.studentGrades[g.studentId]) cache.studentGrades[g.studentId] = [];
      cache.studentGrades[g.studentId].push(g);
    }
  });
  return all;
}

export async function getGradesByTeacher(teacherId) {
  if (cache.teacherGrades[teacherId]) return cache.teacherGrades[teacherId];
  if (cache.grades) {
    const filtered = cache.grades.filter(g => g.teacherId === teacherId);
    cache.teacherGrades[teacherId] = filtered;
    return filtered;
  }
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("teacherId", "==", teacherId),
    orderBy("date", "desc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.teacherGrades[teacherId] = results;
  // Llenar caché de alumnos con estos datos también
  results.forEach(g => {
    if (g.studentId) {
      if (!cache.studentGrades[g.studentId]) cache.studentGrades[g.studentId] = [];
      if (!cache.studentGrades[g.studentId].find(x => x.id === g.id)) {
        cache.studentGrades[g.studentId].push(g);
      }
    }
  });
  return results;
}

export async function getGradesByStudent(studentId) {
  // 0 lecturas si ya está en caché
  if (cache.studentGrades[studentId]) return cache.studentGrades[studentId];
  if (cache.grades) {
    const filtered = cache.grades.filter(g => g.studentId === studentId);
    cache.studentGrades[studentId] = filtered;
    return filtered;
  }
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("studentId", "==", studentId),
    orderBy("date", "desc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.studentGrades[studentId] = results;
  return results;
}

export async function createGrade(data) {
  const ref = await addDoc(collection(db, "grades"), { ...data, createdAt: serverTimestamp() });
  const newGrade = { id: ref.id, ...data };
  // Actualizar todos los cachés sin releer Firestore
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
  // Limpiar de todos los cachés sin releer
  if (cache.grades) cache.grades = cache.grades.filter(g => g.id !== id);
  Object.keys(cache.teacherGrades).forEach(k => {
    cache.teacherGrades[k] = cache.teacherGrades[k].filter(g => g.id !== id);
  });
  Object.keys(cache.studentGrades).forEach(k => {
    cache.studentGrades[k] = cache.studentGrades[k].filter(g => g.id !== id);
  });
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES
// ═══════════════════════════════════════════════════════════════════

export async function getObservationsByTeacher(teacherId) {
  const key = `teacher_${teacherId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(
    collection(db, "observations"),
    where("teacherId", "==", teacherId),
    orderBy("date", "desc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.observations[key] = results;
  // Llenar caché de alumnos también
  results.forEach(o => {
    if (o.studentId) {
      const skey = `student_${o.studentId}`;
      if (!cache.observations[skey]) cache.observations[skey] = [];
      if (!cache.observations[skey].find(x => x.id === o.id)) {
        cache.observations[skey].push(o);
      }
    }
  });
  return results;
}

export async function getObservationsByStudent(studentId) {
  const key = `student_${studentId}`;
  if (cache.observations[key]) return cache.observations[key];
  const snap = await getDocs(query(
    collection(db, "observations"),
    where("studentId", "==", studentId),
    orderBy("date", "desc")
  ));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cache.observations[key] = results;
  return results;
}

export async function searchObservations({ studentId = "", teacherName = "" } = {}) {
  // Si filtra por alumno y ya está en caché, 0 lecturas
  if (studentId && cache.observations[`student_${studentId}`]) {
    let results = cache.observations[`student_${studentId}`];
    if (teacherName) {
      const t = teacherName.toLowerCase();
      results = results.filter(o => (o.teacherName||"").toLowerCase().includes(t));
    }
    return results;
  }
  let q;
  if (studentId) {
    q = query(collection(db, "observations"), where("studentId", "==", studentId), orderBy("date", "desc"));
  } else {
    q = query(collection(db, "observations"), orderBy("date", "desc"));
  }
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (teacherName) {
    const t = teacherName.toLowerCase();
    results = results.filter(o => (o.teacherName||"").toLowerCase().includes(t));
  }
  return results;
}

export async function createObservation(data) {
  const ref = await addDoc(collection(db, "observations"), { ...data, createdAt: serverTimestamp() });
  const newObs = { id: ref.id, ...data };
  // Actualizar cachés sin releer
  const tkey = `teacher_${data.teacherId}`;
  const skey = `student_${data.studentId}`;
  if (cache.observations[tkey]) cache.observations[tkey] = [newObs, ...cache.observations[tkey]];
  if (cache.observations[skey]) cache.observations[skey] = [newObs, ...cache.observations[skey]];
  return ref.id;
}

export async function deleteObservation(id) {
  await deleteDoc(doc(db, "observations", id));
  Object.keys(cache.observations).forEach(k => {
    cache.observations[k] = cache.observations[k].filter(o => o.id !== id);
  });
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
