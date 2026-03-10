import { useState } from "react";
import { loginUser } from "../db";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !pass) return;
    setLoading(true);
    setErr("");
    try {
      await loginUser(email, pass);
    } catch (e) {
      setErr("Email o contraseña incorrectos");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(160deg,#1e3a5f 0%,#2d5282 50%,#1a365d 100%)", padding:"20px", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800&family=Source+Sans+3:wght@400;600&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ width:"100%", maxWidth:"420px" }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ width:"72px", height:"72px", background:"rgba(255,255,255,0.15)", borderRadius:"20px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.2rem", margin:"0 auto 16px", border:"1px solid rgba(255,255,255,0.2)" }}>🎓</div>
          <h1 style={{ fontFamily:"'Playfair Display', serif", color:"white", fontSize:"2rem", margin:0, fontWeight:800 }}>EduGestión</h1>
          <p style={{ color:"rgba(255,255,255,0.6)", margin:"4px 0 0", fontSize:"0.85rem", letterSpacing:"2px", textTransform:"uppercase" }}>Sistema de Gestión Escolar</p>
        </div>

        <div style={{ background:"white", borderRadius:"16px", padding:"32px", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div>
              <label style={{ fontSize:"0.82rem", fontWeight:600, color:"#475569", display:"block", marginBottom:"4px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Correo electrónico</label>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="usuario@escuela.edu"
                style={{ border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", width:"100%", fontSize:"0.9rem", outline:"none", background:"#f8fafc" }}
              />
            </div>
            <div>
              <label style={{ fontSize:"0.82rem", fontWeight:600, color:"#475569", display:"block", marginBottom:"4px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Contraseña</label>
              <input
                type="password" value={pass} onChange={e=>setPass(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="••••••••"
                style={{ border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", width:"100%", fontSize:"0.9rem", outline:"none", background:"#f8fafc" }}
              />
            </div>
            {err && <p style={{ color:"#dc2626", fontSize:"0.85rem", margin:0, padding:"8px 12px", background:"#fee2e2", borderRadius:"8px" }}>⚠ {err}</p>}
            <button
              onClick={handleSubmit} disabled={loading}
              style={{ background:"#1e3a5f", color:"white", border:"none", borderRadius:"10px", padding:"12px", fontSize:"1rem", cursor:"pointer", fontWeight:600, opacity:loading?0.7:1 }}
            >
              {loading ? "Ingresando..." : "Ingresar →"}
            </button>
          </div>
        </div>
        <p style={{ color:"rgba(255,255,255,0.4)", textAlign:"center", fontSize:"0.75rem", marginTop:"16px" }}>Sistema de gestión académica · Año 2025</p>
      </div>
    </div>
  );
}
