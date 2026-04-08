import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { searchStudents, getGradesByTeacher, createGrade, deleteGrade, getObservationsByTeacher, createObservation, deleteObservation } from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];

export default function TeacherScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("add");
  const [grades, setGrades] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || "");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [g, o] = await Promise.all([getGradesByTeacher(user.uid), getObservationsByTeacher(user.uid)]);
    setGrades(g);
    setObservations(o);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle={`Profesor · ${subjects.join(", ")}`} />
      <div style={{ maxWidth:"900px", margin:"0 auto", padding:"24px 20px" }}>

        {subjects.length > 1 && (
          <div style={{ marginBottom:"20px", display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>Materia activa:</span>
            {subjects.map(s => (
              <button key={s} onClick={()=>setSelectedSubject(s)} style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${selectedSubject===s?"#065f46":"#e2e8f0"}`, background:selectedSubject===s?"#d1fae5":"white", color:selectedSubject===s?"#065f46":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px" }}>
          {[["add","📝 Cargar nota"],["mygrades","📋 Mis evaluaciones"],["observations","💬 Observaciones"],["ranking","📊 Rendimiento"]].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div> : (
          <div className="fade" key={tab}>
            {tab==="add" && <AddGrade user={user} subject={selectedSubject} grades={grades} setGrades={setGrades} setSaving={setSaving} />}
            {tab==="mygrades" && <MyGrades grades={grades} setGrades={setGrades} setSaving={setSaving} />}
            {tab==="observations" && <ObservationsTab user={user} profile={profile} observations={observations} setObservations={setObservations} setSaving={setSaving} />}
            {tab==="ranking" && <Ranking grades={grades} subject={selectedSubject} />}
          </div>
        )}
      </div>
    </div>
  );
}

function AddGrade({ user, subject, grades, setGrades, setSaving }) {
  const [nameQ, setNameQ] = useState("");
  const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ score:"", type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
  const [success, setSuccess] = useState(false);

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setSearching(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setSearchResults(r);
    setSearching(false);
  }

  async function submit() {
    if (!selectedStudent || !form.score) return;
    const score = parseFloat(form.score);
    if (score < 1 || score > 10) { alert("La nota debe estar entre 1 y 10"); return; }
    setSaving(true);
    const data = { ...form, score, teacherId: user.uid, teacherName: profile?.name || "", subject, studentId: selectedStudent.id, studentName: selectedStudent.name };
    const id = await createGrade(data);
    setGrades(prev => [{ id, ...data }, ...prev]);
    setForm({ score:"", type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
    setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500);
    setSaving(false);
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>Cargar evaluación</h2>
      <p style={{ color:"#64748b", marginBottom:"24px", fontSize:"0.9rem" }}>Materia: <strong>{subject}</strong></p>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ Nota guardada correctamente</div>}

      <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
        <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>1. Buscar alumno</h3>
        {selectedStudent ? (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px" }}>
            <div>
              <span style={{ fontWeight:700, color:"#1e293b" }}>{selectedStudent.name}</span>
              <span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span>
            </div>
            <button onClick={()=>{ setSelectedStudent(null); setSearchResults([]); }} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
              <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre del alumno..." style={{ flex:1, minWidth:"160px" }} />
              <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
                <option value="">Todos los años</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"200px", overflowY:"auto" }}>
                {searchResults.map(s => (
                  <div key={s.id} onClick={()=>setSelectedStudent(s)} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontWeight:600 }}>{s.name}</span>
                    <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedStudent && (
        <div className="card" style={{ padding:"24px" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>2. Datos de la evaluación</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
            <div><label>Nota (1–10)</label><input type="number" min="1" max="10" step="0.5" value={form.score} onChange={e=>setForm({...form,score:e.target.value})} placeholder="Ej: 8" /></div>
            <div>
              <label>Tipo de evaluación</label>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                {["Examen","Trabajo Práctico","Exposición","Cuestionario","Proyecto","Parcial","Otro"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Trimestre</label>
              <select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>
                {trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
              </select>
            </div>
            <div><label>Fecha</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div>
            <div style={{ gridColumn:"1/-1" }}><label>Observación (opcional)</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Comentario para el tutor..." /></div>
          </div>
          <button className="btn-primary" onClick={submit} style={{ marginTop:"20px", padding:"12px 32px", fontSize:"1rem" }}>Guardar evaluación →</button>
        </div>
      )}
    </div>
  );
}

function MyGrades({ grades, setGrades, setSaving }) {
  const [trim, setTrim] = useState(0);
  const [nameFilter, setNameFilter] = useState("");
  const filtered = grades.filter(g => trim===0 || g.trimester===trim).filter(g => !nameFilter || (g.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));

  async function removeGrade(id) {
    setSaving(true);
    await deleteGrade(id);
    setGrades(prev=>prev.filter(g=>g.id!==id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Mis evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>
          {[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
            <button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>
      <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por nombre de alumno..." style={{ width:"100%", marginBottom:"16px" }} />
      {filtered.length===0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}><div style={{ fontSize:"3rem", marginBottom:"12px" }}>📋</div><p>No hay evaluaciones aún</p></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {filtered.map(g => (
            <div key={g.id} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"16px" }}>
              <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"1.1rem", flexShrink:0 }}>{g.score}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:"#1e293b" }}>{g.studentName||"–"}</div>
                <div style={{ fontSize:"0.8rem", color:"#64748b" }}>{g.subject} · {g.type} · {trimNames[g.trimester-1]} · {g.date}</div>
                {g.note && <div style={{ fontSize:"0.8rem", color:"#7c3aed", marginTop:"2px" }}>💬 {g.note}</div>}
              </div>
              <button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Observaciones ────────────────────────────────────────────────
function ObservationsTab({ user, profile, observations, setObservations, setSaving }) {
  const [nameQ, setNameQ] = useState("");
  const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ text:"", date:new Date().toISOString().split("T")[0] });
  const [success, setSuccess] = useState(false);
  const [nameFilter, setNameFilter] = useState("");

  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setSearching(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setSearchResults(r);
    setSearching(false);
  }

  async function submit() {
    if (!selectedStudent || !form.text.trim()) return;
    setSaving(true);
    const data = {
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentGrade: selectedStudent.grade,
      teacherId: user.uid,
      teacherName: profile.name || "",
      subjects: subjects,
      text: form.text.trim(),
      date: form.date,
    };
    const id = await createObservation(data);
    setObservations(prev => [{ id, ...data }, ...prev]);
    setForm({ text:"", date:new Date().toISOString().split("T")[0] });
    setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500);
    setSaving(false);
  }

  async function removeObs(id) {
    setSaving(true);
    await deleteObservation(id);
    setObservations(prev => prev.filter(o => o.id !== id));
    setSaving(false);
  }

  const filtered = observations.filter(o => !nameFilter || (o.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Observaciones</h2>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ Observación guardada</div>}

      {/* Formulario nueva observación */}
      <div className="card" style={{ padding:"24px", marginBottom:"24px", border:"2px solid #e0e7ff" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Nueva observación</h3>

        {/* Buscador alumno */}
        {selectedStudent ? (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px", marginBottom:"16px" }}>
            <div>
              <span style={{ fontWeight:700, color:"#1e293b" }}>{selectedStudent.name}</span>
              <span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span>
            </div>
            <button onClick={()=>{ setSelectedStudent(null); setSearchResults([]); }} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
          </div>
        ) : (
          <div style={{ marginBottom:"16px" }}>
            <label>Buscar alumno</label>
            <div style={{ display:"flex", gap:"10px", marginTop:"6px", flexWrap:"wrap" }}>
              <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre..." style={{ flex:1, minWidth:"140px" }} />
              <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"110px" }}>
                <option value="">Todos los años</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop:"8px", display:"flex", flexDirection:"column", gap:"6px", maxHeight:"180px", overflowY:"auto" }}>
                {searchResults.map(s => (
                  <div key={s.id} onClick={()=>{ setSelectedStudent(s); setSearchResults([]); }} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontWeight:600 }}>{s.name}</span>
                    <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedStudent && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"16px", marginBottom:"16px" }}>
              <div>
                <label>Observación</label>
                <textarea
                  value={form.text}
                  onChange={e=>setForm({...form,text:e.target.value})}
                  placeholder="Ej: El alumno no trabajó durante la clase, se mostró desatento..."
                  rows={3}
                  style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical" }}
                />
              </div>
              <div>
                <label>Fecha</label>
                <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{ width:"160px" }} />
              </div>
            </div>
            <button className="btn-primary" onClick={submit}>Guardar observación →</button>
          </>
        )}
      </div>

      {/* Listado de observaciones propias */}
      <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 12px" }}>Mis observaciones ({filtered.length})</h3>
      <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por nombre de alumno..." style={{ width:"100%", marginBottom:"16px" }} />

      {filtered.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem", marginBottom:"12px" }}>💬</div>
          <p>No hay observaciones cargadas aún</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {filtered.map(o => (
            <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                <div>
                  <span style={{ fontWeight:700, color:"#1e293b" }}>{o.studentName}</span>
                  <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"8px" }}>{o.studentGrade}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{o.date}</span>
                  <button className="btn-danger" onClick={()=>removeObs(o.id)}>Eliminar</button>
                </div>
              </div>
              <p style={{ margin:0, color:"#475569", fontSize:"0.9rem", lineHeight:1.5 }}>{o.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ranking({ grades, subject }) {
  const [nameFilter, setNameFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const subjectGrades = grades.filter(g => g.subject === subject);
  const studentMap = {};
  subjectGrades.forEach(g => {
    if (!studentMap[g.studentId]) studentMap[g.studentId] = { id:g.studentId, name:g.studentName||"–", grade:g.studentGrade||"", scores:[] };
    studentMap[g.studentId].scores.push(g.score);
  });
  let students = Object.values(studentMap);
  if (nameFilter) students = students.filter(s=>s.name.toLowerCase().includes(nameFilter.toLowerCase()));
  if (gradeFilter) students = students.filter(s=>s.grade===gradeFilter);

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 16px" }}>Rendimiento — {subject}</h2>
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Buscar alumno..." style={{ flex:1, minWidth:"160px" }} />
        <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{ width:"120px" }}>
          <option value="">Todos los años</option>
          {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      {students.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}><p>No hay evaluaciones para esta materia aún.</p></div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"16px" }}>
          {students.map(s => {
            const sa = avg(s.scores);
            const color = sa==="–" ? "#e2e8f0" : scoreColor(parseFloat(sa));
            return (
              <div key={s.id} className="card" style={{ padding:"20px", borderTop:`3px solid ${color}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ fontWeight:700, color:"#1e293b" }}>{s.name}</div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"1.8rem", fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>{sa}</div>
                    <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>{s.scores.length} eval.</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
