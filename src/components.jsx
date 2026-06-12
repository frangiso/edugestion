import { useState, useEffect } from "react";
import {
  getAllStudents, getAllGrades,
  getCourseObservations, createCourseObservation, deleteCourseObservation,
} from "./db";

// ─── Helpers globales ─────────────────────────────────────────────
// avg con exactamente 2 decimales. Ej: 6.75 → "6.75", 7.00 → "7.00"
export const avg = (scores) => {
  if (!scores || scores.length === 0) return "–";
  const sum = scores.reduce((a, b) => a + b, 0);
  const result = sum / scores.length;
  // Elimina ceros finales innecesarios solo si son todos cero
  // 6.75 → "6.75" | 7.00 → "7" | 6.50 → "6.5"
  const fixed = parseFloat(result.toFixed(2));
  return String(fixed);
};

export const scoreColor = (s) => {
  if (s >= 8) return "#10b981";
  if (s >= 6) return "#f59e0b";
  return "#ef4444";
};

export const trimNames = ["1er Trimestre", "2do Trimestre", "3er Trimestre"];

// ─── TopBar ───────────────────────────────────────────────────────
export function TopBar({ profile, saving, logout, subtitle }) {
  return (
    <div style={{ background:"#1e3a5f", padding:"0 24px", height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 12px rgba(0,0,0,0.15)", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <span style={{ fontSize:"1.4rem" }}>🎓</span>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:700, fontSize:"1.05rem", lineHeight:1 }}>EduGestión</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.7rem", letterSpacing:"1px", textTransform:"uppercase" }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
        {saving && <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.75rem" }}>💾 Guardando...</span>}
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"white", fontSize:"0.85rem", fontWeight:600 }}>{profile?.name}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.7rem" }}>{profile?.email}</div>
        </div>
        <button onClick={logout} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"white", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"0.8rem" }}>Salir</button>
      </div>
    </div>
  );
}

// ─── Estilos globales ─────────────────────────────────────────────
export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800&family=Source+Sans+3:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  input, select, textarea { font-family: 'Source Sans 3', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #e2e8f0; }
  ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
  .card { background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.07); }
  .btn-primary { background: #1e3a5f; color: white; border: none; border-radius: 10px; padding: 10px 20px; cursor: pointer; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; font-weight: 600; transition: background 0.2s; }
  .btn-primary:hover { background: #2d5282; }
  .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.8rem; font-weight: 600; }
  .btn-danger:hover { background: #fecaca; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="date"], select, textarea {
    border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; width: 100%; font-size: 0.9rem; outline: none; transition: border 0.2s; background: #f8fafc;
  }
  input:focus, select:focus, textarea:focus { border-color: #1e3a5f; background: white; }
  label { font-size: 0.82rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .tab { padding: 8px 18px; border: none; background: none; cursor: pointer; font-family: 'Source Sans 3', sans-serif; font-size: 0.85rem; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
  .tab.active { color: #1e3a5f; border-bottom-color: #1e3a5f; }
  .tab:hover { color: #1e3a5f; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .fade { animation: fadeIn 0.3s ease; }
`;

// ─── TOP 6 — Mejores promedios 6° Año + Observaciones generales del curso ──
// Compartido entre AdminScreen (director) y TeacherScreen (docente)
const TOP6_GRADE = "6°";

export function Top6Tab({ user, profile }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [courseObs, setCourseObs] = useState([]);
  const [obsAvailable, setObsAvailable] = useState(true);
  const [obsText, setObsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [studentsRes, gradesRes, obsRes] = await Promise.allSettled([
      getAllStudents(),
      getAllGrades(),
      getCourseObservations(TOP6_GRADE),
    ]);
    const students = studentsRes.status === "fulfilled" ? studentsRes.value : [];
    const grades = gradesRes.status === "fulfilled" ? gradesRes.value : [];
    setObsAvailable(obsRes.status === "fulfilled");
    const obs = obsRes.status === "fulfilled" ? obsRes.value : [];
    const courseStudents = students.filter(s => s.grade === TOP6_GRADE);
    const computed = courseStudents.map(s => {
      const sGrades = grades.filter(g => g.studentId === s.id);
      const byTrim = [1,2,3].map(t => sGrades.filter(g => g.trimester === t).map(g => g.score));
      const all = sGrades.map(g => g.score);
      return {
        id: s.id,
        name: s.name,
        t: byTrim.map(scores => avg(scores)),
        final: avg(all),
        finalNum: all.length ? parseFloat(avg(all)) : null,
      };
    }).filter(r => r.finalNum !== null)
      .sort((a,b) => b.finalNum - a.finalNum)
      .slice(0,6);
    setRows(computed);
    setCourseObs(obs);
    setLoading(false);
  }

  async function submitObs() {
    if (!obsText.trim()) return;
    setSaving(true);
    const data = {
      grade: TOP6_GRADE,
      teacherId: user.uid,
      teacherName: profile.name || "",
      text: obsText.trim(),
      date: new Date().toISOString().split("T")[0],
    };
    try {
      const id = await createCourseObservation(data);
      setCourseObs(prev => [{ id, ...data }, ...prev]);
      setObsText("");
      setSuccess("✅ Observación guardada");
      setTimeout(() => setSuccess(""), 2500);
    } catch {
      setObsAvailable(false);
    }
    setSaving(false);
  }

  async function removeObs(id) {
    if (!confirm("¿Eliminar esta observación?")) return;
    try {
      await deleteCourseObservation(id, TOP6_GRADE);
      setCourseObs(prev => prev.filter(o => o.id !== id));
    } catch {
      setObsAvailable(false);
    }
  }

  if (loading) return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div>;

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>🏆 Mejores promedios — 6° Año</h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"24px" }}>
        Top 6 alumnos de 6° año según su promedio final (todas las materias), con el detalle por trimestre.
      </p>

      {rows.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8", marginBottom:"32px" }}>
          <div style={{ fontSize:"3rem" }}>📭</div>
          <p>Todavía no hay evaluaciones cargadas para 6° año.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow:"auto", marginBottom:"32px" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"560px" }}>
            <thead>
              <tr style={{ background:"#1e3a5f", color:"white" }}>
                <th style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, fontSize:"0.85rem" }}>#</th>
                <th style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, fontSize:"0.85rem" }}>Alumno</th>
                {trimNames.map((n,i) => (
                  <th key={i} style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>{n}</th>
                ))}
                <th style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>Promedio Final</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom:"1px solid #f1f5f9", background: idx%2===0?"white":"#f8fafc" }}>
                  <td style={{ padding:"12px 16px", fontWeight:800, color:"#94a3b8" }}>{idx+1}°</td>
                  <td style={{ padding:"12px 16px", fontWeight:600, color:"#1e293b" }}>{r.name}</td>
                  {r.t.map((v,i) => {
                    const vNum = parseFloat(v);
                    return (
                      <td key={i} style={{ padding:"12px 16px", textAlign:"center" }}>
                        <span style={{ fontWeight:700, color: v==="–"?"#cbd5e1":scoreColor(vNum) }}>{v}</span>
                      </td>
                    );
                  })}
                  <td style={{ padding:"12px 16px", textAlign:"center" }}>
                    <span style={{ fontWeight:800, fontSize:"1.1rem", color:scoreColor(r.finalNum), fontFamily:"'Playfair Display',serif" }}>{r.final}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>💬 Observaciones generales — 6° Año</h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"16px" }}>
        Observaciones dirigidas a todo el curso, visibles para el director y los profesores.
      </p>

      {!obsAvailable ? (
        <div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2.5rem" }}>🔒</div>
          <p>Esta función todavía no está habilitada. Hace falta actualizar los permisos (reglas de Firestore) del proyecto.</p>
        </div>
      ) : (
        <>
          {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", color:"#065f46", fontWeight:600 }}>{success}</div>}

          <div className="card" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
            <label>Nueva observación general</label>
            <textarea value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Ej: El curso mostró buena participación en el acto del 25 de mayo..." rows={3} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical", marginTop:"4px", marginBottom:"12px" }} />
            <button className="btn-primary" onClick={submitObs} disabled={saving || !obsText.trim()}>Guardar observación →</button>
          </div>

          {courseObs.length === 0 ? (
            <div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay observaciones generales registradas para este curso.</p></div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {courseObs.map(o => (
                <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                    <div style={{ fontWeight:700, color:"#7c3aed", fontSize:"0.9rem" }}>Prof. {o.teacherName}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                      <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{o.date}</span>
                      {(profile.role==="admin" || o.teacherId===user.uid) && <button className="btn-danger" onClick={()=>removeObs(o.id)}>Eliminar</button>}
                    </div>
                  </div>
                  <p style={{ margin:0, color:"#475569", fontSize:"0.9rem", lineHeight:1.5 }}>{o.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
