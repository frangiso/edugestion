import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { getUserProfile } from "./db";
import LoginScreen from "./screens/LoginScreen";
import AdminScreen from "./screens/AdminScreen";
import TeacherScreen from "./screens/TeacherScreen";
import ParentScreen from "./screens/ParentScreen";

function Splash() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#1e3a5f" }}>
      <div style={{ textAlign:"center", color:"white" }}>
        <div style={{ fontSize:"3rem", marginBottom:"12px" }}>🎓</div>
        <p style={{ fontFamily:"Georgia, serif", fontSize:"1.4rem", opacity:0.8 }}>Cargando sistema...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const prof = await getUserProfile(firebaseUser.uid);
        setUser(firebaseUser);
        setProfile(prof);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  function handleLogout() {
    auth.signOut();
  }

  if (loading) return <Splash />;
  if (!user || !profile) return <LoginScreen />;
  if (profile.role === "admin") return <AdminScreen user={user} profile={profile} logout={handleLogout} />;
  if (profile.role === "teacher") return <TeacherScreen user={user} profile={profile} logout={handleLogout} />;
  if (profile.role === "parent") return <ParentScreen user={user} profile={profile} logout={handleLogout} />;
  return <div>Rol no reconocido</div>;
}
