import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getAllStudents, getGradesByTeacher, createGrade, deleteGrade } from "../db";

export default function TeacherScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("add");
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [s, g] = await Promise.all([getAllStudents(), getGradesByTeacher(user.uid)]);
    setStudents(s); setGrades(g);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle={`Profesor · ${profile.subject}`} />
      <div style={{ maxWidth:"900px", margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px" }}>
          {[["add","📝 Cargar nota"],["mygrades","📋 Mis evaluaciones"],["ranking","📊 Rendimiento"]].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        {loading ? <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div> : (
          <div className="fade" key={tab}>
            {tab==="add" && <AddGrade user={user} profile={profile} students={students} grades={grades} setGrades={setGrades} setSaving={setSaving} />}
            {tab==="mygrades" && <MyGrades grades={grades} students={students} setGrades={setGrades} setSaving={setSaving} />}
            {tab==="ranking" && <Ranking students={students} grades={grades} profile={profile} />}
          </div>
        )}
      </div>
    </div>
  );
}

function AddGrade({ user, profile, students, grades, setGrades, setSaving }) {
  const [form, setForm] = useState({ studentId:"", score:"", type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (!form.studentId || !form.score) return;
    const score = parseFloat(form.score);
    if (score < 1 || score > 10) { alert("La nota debe estar entre 1 y 10"); return; }
    setSaving(true);
    const data = { ...form, score, teacherId: user.uid, subject: profile.subject };
    const id = await createGrade(data);
    setGrades(prev => [{ id, ...data }, ...prev]);
    setForm({ studentId:"", score:"", type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
    setSuccess(true);
    setTimeout(()=>setSuccess(false), 2500);
    setSaving(false);
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>Cargar evaluación</h2>
      <p style={{ color:"#64748b", marginBottom:"24px", fontSize:"0.9rem" }}>Materia: <strong>{profile.subject}</strong></p>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ Nota guardada en Firebase</div>}
      <div className="card" style={{ padding:"28px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
          <div>
            <label>Alumno</label>
            <select value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}>
              <option value="">Seleccionar alumno...</option>
              {students.sort((a,b)=>a.name.localeCompare(b.name)).map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade}</option>)}
            </select>
          </div>
          <div>
            <label>Nota (1–10)</label>
            <input type="number" min="1" max="10" step="0.5" value={form.score} onChange={e=>setForm({...form,score:e.target.value})} placeholder="Ej: 8" />
          </div>
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
          <div>
            <label>Fecha</label>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div>
            <label>Observación (opcional)</label>
            <input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Comentario para el tutor..." />
          </div>
        </div>
        {form.score && parseFloat(form.score)>=1 && parseFloat(form.score)<=10 && (
          <div style={{ marginTop:"20px", padding:"16px", background:"#f8fafc", borderRadius:"10px", display:"flex", alignItems:"center", gap:"16px" }}>
            <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:scoreColor(parseFloat(form.score)), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:"1.4rem", fontWeight:800 }}>{form.score}</div>
            <div>
              <div style={{ fontWeight:600, color:"#1e293b" }}>{students.find(s=>s.id===form.studentId)?.name || "Alumno no seleccionado"}</div>
              <div style={{ fontSize:"0.82rem", color:"#64748b" }}>{profile.subject} · {form.type} · {trimNames[form.trimester-1]}</div>
            </div>
          </div>
        )}
        <button className="btn-primary" onClick={submit} style={{ marginTop:"20px", padding:"12px 32px", fontSize:"1rem" }}>Guardar evaluación →</button>
      </div>
    </div>
  );
}

function MyGrades({ grades, students, setGrades, setSaving }) {
  const [trim, setTrim] = useState(0);
  const filtered = trim===0 ? grades : grades.filter(g=>g.trimester===trim);

  async function removeGrade(id) {
    setSaving(true);
    await deleteGrade(id);
    setGrades(prev=>prev.filter(g=>g.id!==id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Mis evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>
          {[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
            <button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>
      {filtered.length===0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📋</div>
          <p>No hay evaluaciones cargadas aún</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {filtered.map(g => {
            const student = students.find(s=>s.id===g.studentId);
            return (
              <div key={g.id} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"16px" }}>
                <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"1.1rem", flexShrink:0 }}>{g.score}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:"#1e293b" }}>{student?.name}</div>
                  <div style={{ fontSize:"0.8rem", color:"#64748b" }}>{g.type} · {trimNames[g.trimester-1]} · {g.date}</div>
                  {g.note && <div style={{ fontSize:"0.8rem", color:"#7c3aed", marginTop:"2px" }}>💬 {g.note}</div>}
                </div>
                <button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Ranking({ students, grades, profile }) {
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Rendimiento — {profile.subject}</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"16px" }}>
        {students.map(s => {
          const sg = grades.filter(g=>g.studentId===s.id);
          const sa = avg(sg.map(g=>g.score));
          const color = sa==="–" ? "#e2e8f0" : scoreColor(parseFloat(sa));
          return (
            <div key={s.id} className="card" style={{ padding:"20px", borderTop:`3px solid ${color}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#1e293b" }}>{s.name}</div>
                  <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginTop:"4px" }}>{s.grade}</span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"1.8rem", fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>{sa}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>{sg.length} eval.</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
