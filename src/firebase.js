// ─────────────────────────────────────────────────────────────────
//  PASO 1: Reemplazá estos valores con los de tu proyecto Firebase
//  (los encontrás en: Firebase Console → Tu proyecto → Configuración)
// ─────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAHx-regu9g_6H4Pj0Mi0AE9eQPc1mRgrI",
  authDomain: "gestionvisco-a0d7a.firebaseapp.com",
  projectId: "gestionvisco-a0d7a",
  storageBucket: "gestionvisco-a0d7a.firebasestorage.app",
  messagingSenderId: "396552599410",
  appId: "1:396552599410:web:1ddc2b011e50f0fcb34feb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
