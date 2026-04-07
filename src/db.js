import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { db, auth } from "./firebase";

// ─── Caché en memoria ─────────────────────────────────────────────
const cache = {
  users: null,
  grades: null,
};

// ─── Usuarios / Perfiles ──────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  if (cache.users) return cache.users;
  const snap = await getDocs(collection(db, "users"));
  cache.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cache.users;
}

export async function createUser(email, password, profileData) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      throw new Error("Este email ya está registrado. Usá otro email para este usuario.");
    } else {
      throw e;
    }
  }
  await setDoc(doc(db, "users", cred.user.uid), {
    ...profileData,
    email,
    createdAt: serverTimestamp()
  });
  cache.users = null;
  return cred.user.uid;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
  cache.users = null;
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
  cache.users = null;
}

// ─── Alumnos (lazy - solo se cargan al buscar) ────────────────────
export async function searchStudents({ name = "", grade = "" } = {}) {
  if (grade && !name) {
    const snap = await getDocs(query(
      collection(db, "students"),
      where("grade", "==", grade),
      orderBy("name")
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (name) results = results.filter(s => s.name.toLowerCase().includes(name.toLowerCase()));
  if (grade) results = results.filter(s => s.grade === grade);
  return results;
}

export async function getAllStudents() {
  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Carga solo los hijos del tutor por sus IDs — ahorra lecturas
export async function getChildrenByIds(childIds = [], tutorEmail = "") {
  const results = [];
  // Por IDs vinculados
  for (const id of childIds) {
    const snap = await getDoc(doc(db, "students", id));
    if (snap.exists()) results.push({ id: snap.id, ...snap.data() });
  }
  // Por email del tutor (si no está en childIds)
  if (tutorEmail) {
    const snap = await getDocs(query(
      collection(db, "students"),
      where("tutorEmail", "==", tutorEmail)
    ));
    snap.docs.forEach(d => {
      if (!results.find(r => r.id === d.id)) {
        results.push({ id: d.id, ...d.data() });
      }
    });
  }
  return results;
}

export async function createStudent(data) {
  const ref = await addDoc(collection(db, "students"), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateStudent(id, data) {
  await updateDoc(doc(db, "students", id), data);
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, "students", id));
}

// ─── Notas / Evaluaciones ─────────────────────────────────────────
export async function getAllGrades() {
  if (cache.grades) return cache.grades;
  const snap = await getDocs(query(collection(db, "grades"), orderBy("date", "desc")));
  cache.grades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cache.grades;
}

export async function getGradesByStudent(studentId) {
  if (cache.grades) return cache.grades.filter(g => g.studentId === studentId);
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("studentId", "==", studentId),
    orderBy("date", "desc")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGradesByTeacher(teacherId) {
  if (cache.grades) return cache.grades.filter(g => g.teacherId === teacherId);
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("teacherId", "==", teacherId),
    orderBy("date", "desc")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createGrade(data) {
  const ref = await addDoc(collection(db, "grades"), {
    ...data,
    createdAt: serverTimestamp()
  });
  cache.grades = null;
  return ref.id;
}

export async function deleteGrade(id) {
  await deleteDoc(doc(db, "grades", id));
  cache.grades = null;
}

// ─── Login ────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
