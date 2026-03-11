import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getAllUsers, getAllStudents, getAllGrades, createUser, updateStudent, createStudent, deleteStudent, deleteUserProfile, deleteGrade } from "../db";

export default function AdminScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [u, s, g] = await Promise.all([getAllUsers(), getAllStudents(), getAllGrades()]);
    setUsers(u); setStudents(s); setGrades(g);
    setLoading(false);
  }

  const teachers = users.filter(u => u.role === "teacher");
  const parents = users.filter(u => u.role === "parent");

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle="Panel Director" />
      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px" }}>
          {[["overview","📊 Resumen"],["students","👨‍🎓 Alumnos"],["teachers","👨‍🏫 Profesores"],["parents","👨‍👩‍👧 Tutores"],["allgrades","📋 Todas las Notas"]].map(([k,l]) => (
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando datos...</div>
        ) : (
          <div className="fade" key={tab}>
            {tab === "overview" && <Overview students={students} grades={grades} users={users} />}
            {tab === "students" && <StudentsTab students={students} users={users} setStudents={setStudents} setSaving={setSaving} />}
            {tab === "teachers" && <TeachersTab teachers={teachers} users={users} setUsers={setUsers} setSaving={setSaving} />}
            {tab === "parents" && <ParentsTab parents={parents} students={students} users={users} setUsers={setUsers} setSaving={setSaving} />}
            {tab === "allgrades" && <AllGradesTab grades={grades} students={students} users={users} setGrades={setGrades} setSaving={setSaving} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Overview({ students, grades, users }) {
  const teachers = users.filter(u => u.role === "teacher");
  const parents = users.filter(u => u.role === "parent");
  const globalAvg = avg(grades.map(g => g.score));

  const cards = [
    { icon:"👨‍🎓", label:"Alumnos", value: students.length, color:"#1e3a5f" },
    { icon:"👨‍🏫", label:"Profesores", value: teachers.length, color:"#065f46" },
    { icon:"👨‍👩‍👧", label:"Tutores", value: parents.length, color:"#7c2d12" },
    { icon:"📝", label:"Evaluaciones", value: grades.length, color:"#4c1d95" },
    { icon:"⭐", label:"Promedio global", value: globalAvg, color:"#92400e" },
  ];

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Resumen del año escolar</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px", marginBottom:"32px" }}>
        {cards.map(c => (
          <div key={c.label} className="card" style={{ padding:"20px", borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:"1.8rem" }}>{c.icon}</div>
            <div style={{ fontSize:"2rem", fontWeight:800, color:c.color, fontFamily:"'Playfair Display',serif" }}>{c.value}</div>
            <div style={{ color:"#64748b", fontSize:"0.82rem", textTransform:"uppercase", letterSpacing:"0.5px" }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
        <div className="card" style={{ padding:"24px" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1.1rem" }}>Notas por trimestre</h3>
          {[1,2,3].map(t => {
            const tg = grades.filter(g => g.trimester === t);
            const ta = avg(tg.map(g => g.score));
            return (
              <div key={t} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontSize:"0.85rem", color:"#475569" }}>{trimNames[t-1]}</span>
                  <span style={{ fontWeight:700, color: ta==="–" ? "#94a3b8" : scoreColor(parseFloat(ta)) }}>{ta}</span>
                </div>
                <div style={{ height:"6px", background:"#e2e8f0", borderRadius:"3px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width: ta==="–"?"0":`${parseFloat(ta)*10}%`, background: ta==="–"?"#e2e8f0":scoreColor(parseFloat(ta)), borderRadius:"3px" }} />
                </div>
                <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:"2px" }}>{tg.length} evaluaciones</div>
              </div>
            );
          })}
        </div>
        <div className="card" style={{ padding:"24px" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1.1rem" }}>Alumnos</h3>
          {students.slice(0,6).map(s => {
            const sg = grades.filter(g => g.studentId === s.id);
            const sa = avg(sg.map(g => g.score));
            return (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:"0.9rem", color:"#1e293b" }}>{s.name}</div>
                  <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>{s.grade}</div>
                </div>
                <div style={{ fontWeight:800, color: sa==="–"?"#94a3b8":scoreColor(parseFloat(sa)), fontSize:"1.1rem" }}>{sa}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ students, users, setStudents, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", grade:"", tutorEmail:"" });

  async function addStudent() {
    if (!form.name || !form.grade) return;
    setSaving(true);
    const id = await createStudent(form);
    setStudents(prev => [...prev, { id, ...form }]);
    setForm({ name:"", grade:"", tutorEmail:"" });
    setShowForm(false);
    setSaving(false);
  }

  async function removeStudent(id) {
    if (!confirm("¿Eliminar este alumno y todas sus notas?")) return;
    setSaving(true);
    await deleteStudent(id);
    setStudents(prev => prev.filter(s => s.id !== id));
    setSaving(false);
  }

  async function updateTutor(id, tutorEmail) {
    await updateStudent(id, { tutorEmail });
    setStudents(prev => prev.map(s => s.id === id ? { ...s, tutorEmail } : s));
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Alumnos ({students.length})</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo alumno"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
            <div><label>Nombre completo</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre Apellido" /></div>
            <div><label>Año / División</label><input value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} placeholder="3°A" /></div>
            <div><label>Email del tutor</label><input value={form.tutorEmail} onChange={e=>setForm({...form,tutorEmail:e.target.value})} placeholder="tutor@email.com" /></div>
          </div>
          <button className="btn-primary" onClick={addStudent} style={{ marginTop:"16px" }}>Guardar alumno</button>
        </div>
      )}
      <div className="card">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Alumno","Año","Email Tutor","Acciones"].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"12px 16px", fontWeight:600 }}>{s.name}</td>
                <td style={{ padding:"12px 16px" }}><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span></td>
                <td style={{ padding:"12px 16px" }}>
                  <input value={s.tutorEmail||""} onChange={e=>updateTutor(s.id,e.target.value)} placeholder="sin tutor" style={{ width:"220px", padding:"6px 10px", fontSize:"0.82rem" }} />
                </td>
                <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeStudent(s.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeachersTab({ teachers, users, setUsers, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", subject:"" });
  const subjects = ["Matemática","Tecnología","Lengua y Literatura","Inglés","Lenguaje de las Artes Visuales","Psicología","Geografía","Política y Ciudadanía","Filosofía","Biología","Producción de las Artes Visuales","Educación Física","Artes Visuales y T.I.C.","Química","Educación Artística","Historia","Física","Economía","Formación para la Vida y el Trabajo","Sociología","Formación Ética","E.O.I."];

  async function addTeacher() {
    if (!form.name || !form.email || !form.password || !form.subject) return;
    setSaving(true);
    try {
      const uid = await createUser(form.email, form.password, { name:form.name, subject:form.subject, role:"teacher" });
      setUsers(prev => [...prev, { id:uid, role:"teacher", name:form.name, email:form.email, subject:form.subject }]);
      setForm({ name:"", email:"", password:"", subject:"" });
      setShowForm(false);
    } catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  }

  async function removeTeacher(id) {
    if (!confirm("¿Eliminar este profesor?")) return;
    setSaving(true);
    await deleteUserProfile(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Profesores ({teachers.length})</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo profesor"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #d1fae5" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"16px" }}>
            <div><label>Nombre</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Prof. Apellido" /></div>
            <div><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="materia@escuela.edu" /></div>
            <div><label>Contraseña inicial</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
            <div><label>Materia</label>
              <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>
                <option value="">Seleccionar...</option>
                {subjects.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={addTeacher} style={{ marginTop:"16px" }}>Guardar profesor</button>
        </div>
      )}
      <div className="card">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Profesor","Email","Materia","Acciones"].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"12px 16px", fontWeight:600 }}>{t.name}</td>
                <td style={{ padding:"12px 16px", color:"#64748b", fontSize:"0.85rem" }}>{t.email}</td>
                <td style={{ padding:"12px 16px" }}><span className="badge" style={{ background:"#d1fae5", color:"#065f46" }}>{t.subject}</span></td>
                <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeTeacher(t.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParentsTab({ parents, students, users, setUsers, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", childIds:[] });

  function toggleChild(id) {
    setForm(f => ({ ...f, childIds: f.childIds.includes(id) ? f.childIds.filter(c=>c!==id) : [...f.childIds, id] }));
  }

  async function addParent() {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const uid = await createUser(form.email, form.password, { name:form.name, role:"parent", childIds:form.childIds });
      setUsers(prev => [...prev, { id:uid, role:"parent", name:form.name, email:form.email, childIds:form.childIds }]);
      setForm({ name:"", email:"", password:"", childIds:[] });
      setShowForm(false);
    } catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  }

  async function removeParent(id) {
    if (!confirm("¿Eliminar este tutor?")) return;
    setSaving(true);
    await deleteUserProfile(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Padres / Tutores ({parents.length})</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo tutor"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #fed7aa" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <div><label>Nombre</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div><label>Contraseña inicial</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          </div>
          <label>Hijos asociados</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"4px", marginBottom:"16px" }}>
            {students.map(s => (
              <button key={s.id} onClick={()=>toggleChild(s.id)} style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${form.childIds.includes(s.id)?"#7c2d12":"#e2e8f0"}`, background:form.childIds.includes(s.id)?"#fff7ed":"white", color:form.childIds.includes(s.id)?"#7c2d12":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>
                {s.name} ({s.grade})
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={addParent}>Guardar tutor</button>
        </div>
      )}
      <div className="card">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Tutor","Email","Hijos","Acciones"].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {parents.map(p => {
              const children = students.filter(s => (p.childIds||[]).includes(s.id) || s.tutorEmail === p.email);
              return (
                <tr key={p.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"12px 16px", fontWeight:600 }}>{p.name}</td>
                  <td style={{ padding:"12px 16px", color:"#64748b", fontSize:"0.85rem" }}>{p.email}</td>
                  <td style={{ padding:"12px 16px" }}>
                    {children.length===0 ? <span style={{ color:"#94a3b8", fontSize:"0.82rem" }}>Sin hijos</span> :
                      children.map(c=><span key={c.id} className="badge" style={{ background:"#fff7ed", color:"#7c2d12", marginRight:"4px" }}>{c.name}</span>)}
                  </td>
                  <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeParent(p.id)}>Eliminar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllGradesTab({ grades, students, users, setGrades, setSaving }) {
  const [trim, setTrim] = useState(0);
  const filtered = trim===0 ? grades : grades.filter(g=>g.trimester===trim);

  async function removeGrade(id) {
    setSaving(true);
    await deleteGrade(id);
    setGrades(prev => prev.filter(g => g.id !== id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>
          {[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
            <button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="card" style={{ overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"700px" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Alumno","Materia","Tipo","Nota","Trimestre","Fecha",""].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(g => {
              const student = students.find(s=>s.id===g.studentId);
              return (
                <tr key={g.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"12px 16px", fontWeight:600, fontSize:"0.9rem" }}>{student?.name||"–"}</td>
                  <td style={{ padding:"12px 16px", fontSize:"0.85rem", color:"#475569" }}>{g.subject}</td>
                  <td style={{ padding:"12px 16px" }}><span className="badge" style={{ background:"#f0f9ff", color:"#0369a1" }}>{g.type}</span></td>
                  <td style={{ padding:"12px 16px" }}><span style={{ fontWeight:800, fontSize:"1.1rem", color:scoreColor(g.score) }}>{g.score}</span><span style={{ color:"#94a3b8", fontSize:"0.75rem" }}>/10</span></td>
                  <td style={{ padding:"12px 16px", fontSize:"0.82rem", color:"#64748b" }}>{trimNames[g.trimester-1]}</td>
                  <td style={{ padding:"12px 16px", fontSize:"0.82rem", color:"#64748b" }}>{g.date}</td>
                  <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
