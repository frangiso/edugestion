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

// ─── TOP 6 — Mejores promedios 6° Año ──────────────────────────────
// Compartido entre AdminScreen (director) y TeacherScreen (docente)
const TOP6_GRADE = "6°";
const ALL_GRADES = ["1°","2°","3°","4°","5°","6°"];

export function Top6Tab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => { loadRanking(); }, []);

  async function loadRanking() {
    setLoading(true);
    const [students, grades] = await Promise.all([getAllStudents(), getAllGrades()]);
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
    setLoading(false);
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
    </div>
  );
}

// ─── Análisis de riesgo académico ────────────────────────────────
export function analyzeStudentRisk(student, grades) {
  if (!grades.length) return null;
  const subjects = [...new Set(grades.map(g => g.subject))].sort();
  const subjectAnalysis = subjects.map(subject => {
    const sg = grades.filter(g => g.subject === subject);
    const t = [1,2,3].map(trim => {
      const scores = sg.filter(g => g.trimester === trim).map(g => g.score);
      return scores.length ? parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)) : null;
    });
    const allScores = sg.map(g => g.score);
    const subAvg = allScores.length ? parseFloat((allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(2)) : null;
    const drops = [];
    [[0,1],[1,2]].forEach(([a,b]) => {
      if (t[a]!==null && t[b]!==null) {
        const drop = parseFloat((t[a]-t[b]).toFixed(2));
        if (drop > 0.5) drops.push({ from:a+1, to:b+1, drop });
      }
    });
    // Tendencia por evaluación individual (regresión lineal sobre notas ordenadas por fecha)
    const sorted = [...sg].sort((a,b) => (a.date||"").localeCompare(b.date||""));
    let evalSlope = null;
    let evalDrop = null;
    if (sorted.length >= 3) {
      const n = sorted.length;
      const ys = sorted.map(g => g.score);
      const xMean = (n - 1) / 2;
      const yMean = ys.reduce((a,b)=>a+b,0) / n;
      const num = ys.reduce((sum, y, i) => sum + (i - xMean) * (y - yMean), 0);
      const den = ys.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0);
      evalSlope = den > 0 ? parseFloat((num / den).toFixed(3)) : null;
    }
    if (sorted.length >= 4) {
      const half = Math.floor(sorted.length / 2);
      const f = sorted.slice(0, half).map(g => g.score);
      const s = sorted.slice(half).map(g => g.score);
      evalDrop = parseFloat(((f.reduce((a,b)=>a+b,0)/f.length) - (s.reduce((a,b)=>a+b,0)/s.length)).toFixed(2));
    }
    const evalDeclining = (evalSlope !== null && evalSlope < -0.5) || (evalDrop !== null && evalDrop >= 1.5);
    return { subject, t, avg:subAvg, failing:subAvg!==null&&subAvg<6, declining:drops.length>0, drops, bigDrop:drops.some(d=>d.drop>=2), evalSlope, evalDrop, evalDeclining };
  });
  const allScores = grades.map(g => g.score);
  const globalAvg = allScores.length ? parseFloat((allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(2)) : null;
  const failingSubjects       = subjectAnalysis.filter(s => s.failing);
  const decliningSubjects     = subjectAnalysis.filter(s => s.declining);
  const bigDropSubjects       = subjectAnalysis.filter(s => s.bigDrop);
  const evalDecliningSubjects = subjectAnalysis.filter(s => s.evalDeclining);
  let level = "ok";
  if (
    (globalAvg!==null&&globalAvg<5) ||
    failingSubjects.length>=3 ||
    (bigDropSubjects.length>0&&failingSubjects.length>0) ||
    (evalDecliningSubjects.length>0&&failingSubjects.length>0)
  ) level = "critical";
  else if (
    (globalAvg!==null&&globalAvg<6) ||
    failingSubjects.length>=1 ||
    decliningSubjects.length>=2 ||
    bigDropSubjects.length>0 ||
    evalDecliningSubjects.length>=2 ||
    (evalDecliningSubjects.length>=1&&decliningSubjects.length>=1)
  ) level = "warning";
  const parts = [];
  if (level==="critical") parts.push("Requiere atención urgente.");
  else if (level==="warning") parts.push("Requiere seguimiento.");
  if (failingSubjects.length>0) parts.push(`Reprobando: ${failingSubjects.map(s=>s.subject).join(", ")}.`);
  if (bigDropSubjects.length>0) {
    const msgs = bigDropSubjects.flatMap(s=>s.drops.filter(d=>d.drop>=2).map(d=>`${s.subject} (T${d.from}→T${d.to}: −${d.drop})`));
    parts.push(`Caída brusca entre trimestres en ${msgs.join(", ")}.`);
  } else if (decliningSubjects.length>0&&failingSubjects.length===0) {
    parts.push(`Bajando entre trimestres: ${decliningSubjects.map(s=>s.subject).slice(0,3).join(", ")}.`);
  }
  if (evalDecliningSubjects.length>0) {
    parts.push(`Notas en descenso en evaluaciones de: ${evalDecliningSubjects.map(s=>s.subject).slice(0,3).join(", ")}.`);
  }
  return { student, globalAvg, subjectAnalysis, failingSubjects, decliningSubjects, bigDropSubjects, evalDecliningSubjects, level, summary:parts.join(" ")||"Rendimiento dentro de lo esperado." };
}

const RISK_CFG = {
  critical: { label:"🔴 Urgente",     color:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
  warning:  { label:"🟡 Seguimiento", color:"#d97706", bg:"#fffbeb", border:"#fcd34d" },
  ok:       { label:"🟢 OK",           color:"#059669", bg:"#f0fdf4", border:"#6ee7b7" },
};

export function RiskAlertsPanel({ analyses, loading }) {
  const [gradeFilter, setGradeFilter] = useState("");
  const [expanded, setExpanded] = useState({});
  const [showOk, setShowOk] = useState(false);

  if (loading) return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Analizando datos...</div>;

  const visible = analyses.filter(a => !gradeFilter || a.student.grade===gradeFilter);
  const critical = visible.filter(a=>a.level==="critical");
  const warning  = visible.filter(a=>a.level==="warning");
  const okList   = visible.filter(a=>a.level==="ok");
  const atRisk   = [...critical,...warning];

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>🤖 Detección de riesgo académico</h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"20px" }}>
        Alumnos con bajo rendimiento, materias reprobadas o tendencia descendente detectados automáticamente.
      </p>

      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"24px", alignItems:"center" }}>
        <div style={{ minWidth:"160px" }}>
          <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}>
            <option value="">Todos los cursos</option>
            {["1°","2°","3°","4°","5°","6°"].map(g=><option key={g} value={g}>{g} Año</option>)}
          </select>
        </div>
        {[
          { bg:"#fef2f2", color:"#dc2626", border:"#fca5a5", label:`🔴 ${critical.length} urgente${critical.length!==1?"s":""}` },
          { bg:"#fffbeb", color:"#d97706", border:"#fcd34d", label:`🟡 ${warning.length} en seguimiento` },
          { bg:"#f0fdf4", color:"#059669", border:"#6ee7b7", label:`🟢 ${okList.length} sin alerta` },
        ].map(p=>(
          <span key={p.label} style={{ background:p.bg, color:p.color, border:`1px solid ${p.border}`, borderRadius:"20px", padding:"4px 12px", fontSize:"0.8rem", fontWeight:700 }}>{p.label}</span>
        ))}
      </div>

      {atRisk.length===0 && (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem" }}>🎉</div>
          <p>No hay alumnos con alertas{gradeFilter?` en ${gradeFilter} Año`:""}. {analyses.length===0?"Cargá evaluaciones para ver el análisis.":""}</p>
        </div>
      )}

      {atRisk.map(a => {
        const cfg = RISK_CFG[a.level];
        const isOpen = expanded[a.student.id];
        return (
          <div key={a.student.id} className="card" style={{ marginBottom:"12px", border:`1.5px solid ${cfg.border}`, overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", background:cfg.bg, display:"flex", justifyContent:"space-between", alignItems:"flex-start", cursor:"pointer" }} onClick={()=>setExpanded(p=>({...p,[a.student.id]:!p[a.student.id]}))}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px", flexWrap:"wrap" }}>
                  <span style={{ fontWeight:700, fontSize:"1rem", color:"#1e293b" }}>{a.student.name}</span>
                  {a.student.grade&&<span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{a.student.grade} Año</span>}
                  <span style={{ fontWeight:700, color:cfg.color, fontSize:"0.82rem" }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize:"0.88rem", color:"#475569", lineHeight:1.4 }}>{a.summary}</div>
              </div>
              <div style={{ textAlign:"right", marginLeft:"16px", flexShrink:0 }}>
                {a.globalAvg!==null&&<div style={{ fontWeight:800, fontSize:"1.3rem", color:scoreColor(a.globalAvg), fontFamily:"'Playfair Display',serif" }}>{a.globalAvg}</div>}
                <div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>prom. general</div>
                <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"4px" }}>{isOpen?"▲ ocultar":"▼ detalle"}</div>
              </div>
            </div>

            {isOpen&&(
              <div style={{ padding:"16px 20px", overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"520px", fontSize:"0.84rem" }}>
                  <thead>
                    <tr style={{ background:"#f8fafc" }}>
                      <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, color:"#475569" }}>Materia</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#475569" }}>T1</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#475569" }}>T2</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#475569" }}>T3</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#475569" }}>Prom.</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:600, color:"#475569" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.subjectAnalysis.slice().sort((x,y)=>(x.avg??10)-(y.avg??10)).map(s=>(
                      <tr key={s.subject} style={{ borderTop:"1px solid #f1f5f9", background:s.failing?"#fff5f5":s.declining||s.evalDeclining?"#fffbeb":"white" }}>
                        <td style={{ padding:"8px 12px", fontWeight:s.failing||s.declining||s.evalDeclining?700:400, color:"#1e293b" }}>{s.subject}</td>
                        {s.t.map((v,i)=>(
                          <td key={i} style={{ padding:"8px 12px", textAlign:"center" }}>
                            {v!==null?<span style={{ fontWeight:600, color:scoreColor(v) }}>{v}</span>:<span style={{ color:"#cbd5e1" }}>–</span>}
                          </td>
                        ))}
                        <td style={{ padding:"8px 12px", textAlign:"center" }}>
                          {s.avg!==null?<span style={{ fontWeight:800, color:scoreColor(s.avg) }}>{s.avg}</span>:<span style={{ color:"#cbd5e1" }}>–</span>}
                        </td>
                        <td style={{ padding:"8px 12px", textAlign:"center", fontSize:"0.78rem", fontWeight:700 }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:"2px", alignItems:"center" }}>
                            {s.failing&&<span style={{ color:"#dc2626" }}>Reprobando</span>}
                            {s.bigDrop&&<span style={{ color:"#d97706" }}>⬇ Caída trimestral</span>}
                            {!s.bigDrop&&s.declining&&<span style={{ color:"#f59e0b" }}>↘ Baja trimestral</span>}
                            {s.evalDeclining&&<span style={{ color:"#9333ea" }}>📉 Descenso en notas</span>}
                            {!s.failing&&!s.bigDrop&&!s.declining&&!s.evalDeclining&&<span style={{ color:"#10b981" }}>✓ OK</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {okList.length>0&&(
        <>
          <button onClick={()=>setShowOk(p=>!p)} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:"8px", padding:"8px 16px", cursor:"pointer", color:"#64748b", fontSize:"0.85rem", marginTop:"8px" }}>
            {showOk?"Ocultar alumnos sin alerta":`Ver ${okList.length} alumno${okList.length!==1?"s":""} sin alerta`}
          </button>
          {showOk&&okList.map(a=>(
            <div key={a.student.id} className="card" style={{ marginBottom:"8px", marginTop:"8px", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #d1fae5" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontWeight:600, color:"#1e293b" }}>{a.student.name}</span>
                {a.student.grade&&<span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{a.student.grade} Año</span>}
              </div>
              {a.globalAvg!==null&&<span style={{ fontWeight:800, color:scoreColor(a.globalAvg), fontFamily:"'Playfair Display',serif" }}>{a.globalAvg}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Observaciones generales por curso ─────────────────────────────
// Compartido entre AdminScreen (director) y TeacherScreen (docente)
export function CourseObservationsTab({ user, profile }) {
  const [obsGrade, setObsGrade] = useState(ALL_GRADES[0]);
  const [obsLoading, setObsLoading] = useState(true);
  const [courseObs, setCourseObs] = useState([]);
  const [obsAvailable, setObsAvailable] = useState(true);
  const [obsText, setObsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => { loadObs(obsGrade); }, [obsGrade]);

  async function loadObs(grade) {
    setObsLoading(true);
    try {
      const obs = await getCourseObservations(grade);
      setCourseObs(obs);
      setObsAvailable(true);
    } catch {
      setCourseObs([]);
      setObsAvailable(false);
    }
    setObsLoading(false);
  }

  async function submitObs() {
    if (!obsText.trim()) return;
    setSaving(true);
    const data = {
      grade: obsGrade,
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
      await deleteCourseObservation(id, obsGrade);
      setCourseObs(prev => prev.filter(o => o.id !== id));
    } catch {
      setObsAvailable(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>💬 Observaciones generales por curso</h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"16px" }}>
        Observaciones dirigidas a todo un curso, visibles para el director y los profesores.
      </p>

      <div style={{ maxWidth:"220px", marginBottom:"20px" }}>
        <label>Curso</label>
        <select value={obsGrade} onChange={e=>setObsGrade(e.target.value)}>
          {ALL_GRADES.map(g => <option key={g} value={g}>{g} Año</option>)}
        </select>
      </div>

      {obsLoading ? (
        <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>Cargando observaciones...</div>
      ) : !obsAvailable ? (
        <div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2.5rem" }}>🔒</div>
          <p>Esta función todavía no está habilitada. Hace falta actualizar los permisos (reglas de Firestore) del proyecto.</p>
        </div>
      ) : (
        <>
          {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", color:"#065f46", fontWeight:600 }}>{success}</div>}

          <div className="card" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
            <label>Nueva observación para {obsGrade} Año</label>
            <textarea value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Ej: El curso mostró buena participación en el acto del 25 de mayo..." rows={3} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical", marginTop:"4px", marginBottom:"12px" }} />
            <button className="btn-primary" onClick={submitObs} disabled={saving || !obsText.trim()}>Guardar observación →</button>
          </div>

          {courseObs.length === 0 ? (
            <div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay observaciones generales registradas para {obsGrade} Año.</p></div>
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

// ─── Estado por materia: llevan la materia / en riesgo ───────────
// Usado en TeacherScreen y AdminScreen
const SUBJECT_GRADES_LIST = ["1°","2°","3°","4°","5°","6°"];

export function SubjectStatusTab({ grades, subjects, defaultSubject }) {
  const allSubjects = (() => {
    if (subjects && subjects.length > 0) return subjects;
    return [...new Set(grades.map(g => g.subject).filter(Boolean))].sort();
  })();

  const [selectedSubject, setSelectedSubject] = useState(defaultSubject || allSubjects[0] || "");
  const [gradeFilter, setGradeFilter] = useState("");

  const subjectGrades = selectedSubject
    ? grades.filter(g => g.subject === selectedSubject)
    : grades;

  const students = (() => {
    const map = {};
    subjectGrades.forEach(g => {
      if (!map[g.studentId]) {
        map[g.studentId] = { id: g.studentId, name: g.studentName || "–", grade: g.studentGrade || "", entries: [] };
      }
      map[g.studentId].entries.push(g);
    });

    return Object.values(map)
      .filter(s => !gradeFilter || s.grade === gradeFilter)
      .map(s => {
        const t = [1,2,3].map(trim => {
          const scores = s.entries.filter(g => g.trimester === trim).map(g => g.score);
          return scores.length ? parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)) : null;
        });
        const validT = t.filter(v => v !== null);
        const average = validT.length
          ? parseFloat((validT.reduce((a,b)=>a+b,0)/validT.length).toFixed(2))
          : null;
        const remainingTrims = t.filter(v => v === null).length;
        let neededAvg = null;
        let canRecover = false;
        if (average !== null && average < 7 && remainingTrims > 0) {
          const sumDone = validT.reduce((a,b)=>a+b,0);
          neededAvg = parseFloat(((21 - sumDone) / remainingTrims).toFixed(1));
          canRecover = neededAvg <= 10;
        }
        return { ...s, t, average, neededAvg, canRecover, count: s.entries.length };
      })
      .filter(s => s.average !== null)
      .sort((a,b) => a.average - b.average);
  })();

  const failing = students.filter(s => s.average < 7);
  const atRisk  = students.filter(s => s.average >= 7 && s.average < 7.5);

  function StudentCard({ s, borderColor }) {
    return (
      <div className="card" style={{ padding:"14px 16px", borderLeft:`4px solid ${borderColor}`, marginBottom:"8px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
          <div>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.95rem" }}>{s.name}</div>
            {s.grade && <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginTop:"2px", display:"inline-block" }}>{s.grade}</span>}
          </div>
          <div style={{ textAlign:"right", marginLeft:"10px", flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:"1.25rem", color:s.average<7?"#ef4444":"#f59e0b", fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{s.average}</div>
            <div style={{ fontSize:"0.68rem", color:"#94a3b8" }}>{s.count} eval.</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:"5px" }}>
          {s.t.map((v,i) => (
            <div key={i} style={{ flex:1, textAlign:"center", padding:"4px 4px", borderRadius:"6px",
              background:v===null?"#f8fafc":v<7?"#fee2e2":"#d1fae5",
              border:`1px solid ${v===null?"#e2e8f0":v<7?"#fca5a5":"#6ee7b7"}` }}>
              <div style={{ fontSize:"0.6rem", color:"#94a3b8" }}>T{i+1}</div>
              <div style={{ fontWeight:700, fontSize:"0.82rem", color:v===null?"#cbd5e1":v<7?"#dc2626":"#059669" }}>
                {v !== null ? v : "–"}
              </div>
            </div>
          ))}
        </div>
        {s.neededAvg !== null && (
          <div style={{ marginTop:"8px", padding:"5px 10px", borderRadius:"8px",
            background:s.canRecover?"#fffbeb":"#fef2f2",
            border:`1px solid ${s.canRecover?"#fcd34d":"#fca5a5"}`,
            fontSize:"0.76rem", fontWeight:700,
            color:s.canRecover?"#92400e":"#dc2626" }}>
            {s.canRecover
              ? `⚠️ Necesita ${s.neededAvg} en el trimestre restante para aprobar`
              : `❌ No puede recuperarse en el trimestre restante (necesitaría ${s.neededAvg})`}
          </div>
        )}
        {s.neededAvg === null && s.average < 7 && (
          <div style={{ marginTop:"8px", padding:"5px 10px", borderRadius:"8px",
            background:"#fef2f2", border:"1px solid #fca5a5",
            fontSize:"0.76rem", fontWeight:700, color:"#dc2626" }}>
            ❌ Los tres trimestres ya están completos
          </div>
        )}
        {s.average >= 7 && s.average < 7.5 && (
          <div style={{ marginTop:"8px", padding:"5px 10px", borderRadius:"8px",
            background:"#fffbeb", border:"1px solid #fcd34d",
            fontSize:"0.76rem", fontWeight:700, color:"#92400e" }}>
            ⚠️ Promedio ajustado — puede bajar de 7 con una nota baja
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>
        Alumnos en riesgo por materia
      </h2>

      {allSubjects.length > 1 && (
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"14px" }}>
          {allSubjects.map(s => (
            <button key={s} onClick={() => setSelectedSubject(s)} style={{
              padding:"7px 16px", borderRadius:"20px",
              border:`2px solid ${selectedSubject===s?"#1e3a5f":"#e2e8f0"}`,
              background:selectedSubject===s?"#1e3a5f":"white",
              color:selectedSubject===s?"white":"#64748b",
              cursor:"pointer", fontSize:"0.82rem", fontWeight:600,
            }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:"0.8rem", color:"#64748b", fontWeight:600 }}>Año:</span>
        {["", ...SUBJECT_GRADES_LIST].map(g => (
          <button key={g} onClick={() => setGradeFilter(g)} style={{
            padding:"5px 12px", borderRadius:"20px",
            border:`1px solid ${gradeFilter===g?"#1e3a5f":"#e2e8f0"}`,
            background:gradeFilter===g?"#1e3a5f":"white",
            color:gradeFilter===g?"white":"#64748b",
            cursor:"pointer", fontSize:"0.78rem", fontWeight:600,
          }}>{g || "Todos"}</button>
        ))}
      </div>

      {subjectGrades.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem" }}>📊</div>
          <p>No hay evaluaciones cargadas para esta materia</p>
        </div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px", padding:"10px 14px", background:"#fef2f2", borderRadius:"10px", border:"1px solid #fca5a5" }}>
                <span style={{ fontSize:"1.2rem" }}>🔴</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, color:"#dc2626", fontSize:"0.95rem" }}>Llevan la materia</div>
                  <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>Promedio anual menor a 7</div>
                </div>
                <span style={{ background:"#dc2626", color:"white", borderRadius:"20px", padding:"3px 12px", fontWeight:800, fontSize:"0.9rem" }}>
                  {failing.length}
                </span>
              </div>
              {failing.length === 0 ? (
                <div className="card" style={{ padding:"24px", textAlign:"center", color:"#94a3b8" }}>
                  <div style={{ fontSize:"2rem" }}>✅</div>
                  <p style={{ margin:0, fontSize:"0.88rem" }}>Ningún alumno está reprobando</p>
                </div>
              ) : (
                <div>{failing.map(s => <StudentCard key={s.id} s={s} borderColor="#ef4444" />)}</div>
              )}
            </div>

            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px", padding:"10px 14px", background:"#fffbeb", borderRadius:"10px", border:"1px solid #fcd34d" }}>
                <span style={{ fontSize:"1.2rem" }}>🟡</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, color:"#d97706", fontSize:"0.95rem" }}>En riesgo</div>
                  <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>Promedio entre 7.0 y 7.5</div>
                </div>
                <span style={{ background:"#d97706", color:"white", borderRadius:"20px", padding:"3px 12px", fontWeight:800, fontSize:"0.9rem" }}>
                  {atRisk.length}
                </span>
              </div>
              {atRisk.length === 0 ? (
                <div className="card" style={{ padding:"24px", textAlign:"center", color:"#94a3b8" }}>
                  <div style={{ fontSize:"2rem" }}>✅</div>
                  <p style={{ margin:0, fontSize:"0.88rem" }}>Ningún alumno en riesgo</p>
                </div>
              ) : (
                <div>{atRisk.map(s => <StudentCard key={s.id} s={s} borderColor="#f59e0b" />)}</div>
              )}
            </div>
          </div>

          <div style={{ marginTop:"16px", padding:"12px 18px", background:"#f8fafc", borderRadius:"10px", border:"1px solid #e2e8f0", fontSize:"0.83rem", color:"#64748b" }}>
            Total con evaluaciones: <strong>{students.length}</strong> ·{" "}
            <span style={{ color:"#dc2626", fontWeight:700 }}>{failing.length} reprobando</span> ·{" "}
            <span style={{ color:"#d97706", fontWeight:700 }}>{atRisk.length} en riesgo</span>
          </div>
        </>
      )}
    </div>
  );
}
