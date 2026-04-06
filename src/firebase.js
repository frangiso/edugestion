import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyChqvtTVsS4PfW6rE9Nu0OrBRtnESsXX_4",
  authDomain: "edugestion-f42ac.firebaseapp.com",
  projectId: "edugestion-f42ac",
  storageBucket: "edugestion-f42ac.firebasestorage.app",
  messagingSenderId: "598165332218",
  appId: "1:598165332218:web:d8bdd6ea838eef87296943"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

