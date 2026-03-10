import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser as fbDeleteUser
} from "firebase/auth";
import { db, auth } from "./firebase";

// ─── Usuarios / Perfiles ──────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createUser(email, password, profileData) {
  // Crea el usuario en Auth
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Guarda el perfil en Firestore
  await setDoc(doc(db, "users", cred.user.uid), {
    ...profileData,
    email,
    createdAt: serverTimestamp()
  });
  return cred.user.uid;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function deleteUserProfile(uid) {
  await deleteDoc(doc(db, "users", uid));
}

// ─── Alumnos ──────────────────────────────────────────────────────
export async function getAllStudents() {
  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const snap = await getDocs(query(collection(db, "grades"), orderBy("date", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGradesByStudent(studentId) {
  const snap = await getDocs(query(
    collection(db, "grades"),
    where("studentId", "==", studentId),
    orderBy("date", "desc")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGradesByTeacher(teacherId) {
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
  return ref.id;
}

export async function deleteGrade(id) {
  await deleteDoc(doc(db, "grades", id));
}

// ─── Login ────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
