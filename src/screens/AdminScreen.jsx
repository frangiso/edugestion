import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getAllUsers, getAllGrades, createUser, updateStudent, createStudent, deleteStudent, deleteUserProfile, deleteGrade, searchStudents } from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];
const SUBJECTS = ["Matemática","Tecnología","Lengua y Literatura","Inglés","Lenguaje de las Artes Visuales","Psicología","Geografía","Política y Ciudadanía","Filosofía","Biología","Producción de las Artes Visuales","Educación Física","Artes Visuales y T.I.C.","Química","Educación Artística","Historia","Física","Economía","Formación para la Vida y el Trabajo","Sociología","Formación Ética","E.O.I."];

export default function AdminScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [u, g] = await Promise.all([getAllUsers(), getAllGrades()]);
    setUsers(u); setGrades(g);
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
            {tab === "overview" && <Overview grades={grades} users={users} />}
            {tab === "students" && <StudentsTab setSaving={setSaving} />}
            {tab === "teachers" && <TeachersTab teachers={teachers} users={users} setUsers={setUsers} setSaving={setSaving} />}
            {tab === "parents" && <ParentsTab parents={parents} users={users} setUsers={setUsers} setSaving={setSaving} />}
            {tab === "allgrades" && <AllGradesTab grades={grades} users={users} setGrades={setGrades} setSaving={setSaving} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Overview({ grades, users }) {
  const teachers = users.filter(u => u.role === "teacher");
  const parents = users.filter(u => u.role === "parent");
  const globalAvg = avg(grades.map(g => g.score));

  const cards = [
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
    </div>
  );
}

// ─── Buscador de alumnos lazy ─────────────────────────────────────
function StudentSearch({ onSelect, buttonLabel = "Seleccionar" }) {
  const [nameQ, setNameQ] = useState("");
  const [gradeQ, setGradeQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setLoading(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setResults(r);
    setSearched(true);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display:"flex", gap:"10px", marginBottom:"12px", flexWrap:"wrap" }}>
        <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Buscar por nombre..." style={{ flex:1, minWidth:"160px" }} />
        <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
          <option value="">Todos los años</option>
          {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn-primary" onClick={doSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {searched && results.length === 0 && <p style={{ color:"#94a3b8", fontSize:"0.85rem" }}>No se encontraron alumnos.</p>}
      {results.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"300px", overflowY:"auto" }}>
          {results.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#f8fafc", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
              <div>
                <span style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</span>
                <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"8px" }}>{s.grade}</span>
                {s.tutorEmail && <span style={{ fontSize:"0.75rem", color:"#94a3b8", marginLeft:"8px" }}>{s.tutorEmail}</span>}
              </div>
              {onSelect && <button className="btn-primary" onClick={()=>onSelect(s)} style={{ padding:"4px 12px", fontSize:"0.8rem" }}>{buttonLabel}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentsTab({ setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", grade:"", tutorEmail:"" });
  const [editStudent, setEditStudent] = useState(null);
  const [editTutor, setEditTutor] = useState("");

  async function addStudent() {
    if (!form.name || !form.grade) return;
    setSaving(true);
    await createStudent(form);
    setForm({ name:"", grade:"", tutorEmail:"" });
    setShowForm(false);
    setSaving(false);
    alert("Alumno guardado correctamente");
  }

  async function removeStudent(id) {
    if (!confirm("¿Eliminar este alumno?")) return;
    setSaving(true);
    await deleteStudent(id);
    setSaving(false);
    setEditStudent(null);
  }

  async function saveTutor() {
    if (!editStudent) return;
    setSaving(true);
    await updateStudent(editStudent.id, { tutorEmail: editTutor });
    setSaving(false);
    setEditStudent(null);
    alert("Tutor actualizado");
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Alumnos</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo alumno"}</button>
      </div>

      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
            <div><label>Nombre completo</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre Apellido" /></div>
            <div>
              <label>Año</label>
              <select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>
                <option value="">Seleccionar...</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><label>Email del tutor</label><input value={form.tutorEmail} onChange={e=>setForm({...form,tutorEmail:e.target.value})} placeholder="tutor@email.com" /></div>
          </div>
          <button className="btn-primary" onClick={addStudent} style={{ marginTop:"16px" }}>Guardar alumno</button>
        </div>
      )}

      <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar alumno</h3>
        <StudentSearch
          buttonLabel="Editar"
          onSelect={s => { setEditStudent(s); setEditTutor(s.tutorEmail || ""); }}
        />
      </div>

      {editStudent && (
        <div className="card fade" style={{ padding:"24px", border:"2px solid #e0e7ff" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Editando: {editStudent.name} ({editStudent.grade})</h3>
          <div style={{ display:"flex", gap:"12px", alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label>Email del tutor</label>
              <input value={editTutor} onChange={e=>setEditTutor(e.target.value)} placeholder="tutor@email.com" />
            </div>
            <button className="btn-primary" onClick={saveTutor}>Guardar</button>
            <button className="btn-danger" onClick={()=>removeStudent(editStudent.id)}>Eliminar alumno</button>
            <button onClick={()=>setEditStudent(null)} style={{ padding:"10px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeachersTab({ teachers, users, setUsers, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", subjects:[] });

  function toggleSubject(s) {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(s) ? f.subjects.filter(x=>x!==s) : [...f.subjects, s]
    }));
  }

  async function addTeacher() {
    if (!form.name || !form.email || !form.password || form.subjects.length === 0) {
      alert("Completá todos los campos y seleccioná al menos una materia");
      return;
    }
    setSaving(true);
    try {
      const uid = await createUser(form.email, form.password, { name:form.name, subjects:form.subjects, subject:form.subjects[0], role:"teacher" });
      setUsers(prev => [...prev, { id:uid, role:"teacher", name:form.name, email:form.email, subjects:form.subjects, subject:form.subjects[0] }]);
      setForm({ name:"", email:"", password:"", subjects:[] });
      setShowForm(false);
    } catch(e) { alert(e.message); }
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <div><label>Nombre</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Prof. Apellido" /></div>
            <div><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="profe@email.com" /></div>
            <div><label>Contraseña inicial</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          </div>
          <label>Materias que dicta ({form.subjects.length} seleccionadas)</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"8px", marginBottom:"16px" }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={()=>toggleSubject(s)} style={{ padding:"6px 12px", borderRadius:"20px", border:`2px solid ${form.subjects.includes(s)?"#065f46":"#e2e8f0"}`, background:form.subjects.includes(s)?"#d1fae5":"white", color:form.subjects.includes(s)?"#065f46":"#64748b", cursor:"pointer", fontSize:"0.8rem", fontWeight:600 }}>
                {s}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={addTeacher}>Guardar profesor</button>
        </div>
      )}
      <div className="card">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Profesor","Email","Materias","Acciones"].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {teachers.map(t => {
              const materias = t.subjects || (t.subject ? [t.subject] : []);
              return (
                <tr key={t.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"12px 16px", fontWeight:600 }}>{t.name}</td>
                  <td style={{ padding:"12px 16px", color:"#64748b", fontSize:"0.85rem" }}>{t.email}</td>
                  <td style={{ padding:"12px 16px" }}>
                    {materias.map(m=><span key={m} className="badge" style={{ background:"#d1fae5", color:"#065f46", marginRight:"4px", marginBottom:"4px" }}>{m}</span>)}
                  </td>
                  <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeTeacher(t.id)}>Eliminar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParentsTab({ parents, users, setUsers, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", childIds:[] });
  const [selectedChildren, setSelectedChildren] = useState([]);

  function toggleChild(s) {
    setSelectedChildren(prev => prev.find(x=>x.id===s.id) ? prev.filter(x=>x.id!==s.id) : [...prev, s]);
    setForm(f => ({ ...f, childIds: f.childIds.includes(s.id) ? f.childIds.filter(c=>c!==s.id) : [...f.childIds, s.id] }));
  }

  async function addParent() {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const uid = await createUser(form.email, form.password, { name:form.name, role:"parent", childIds:form.childIds });
      setUsers(prev => [...prev, { id:uid, role:"parent", name:form.name, email:form.email, childIds:form.childIds }]);
      setForm({ name:"", email:"", password:"", childIds:[] });
      setSelectedChildren([]);
      setShowForm(false);
    } catch(e) { alert(e.message); }
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
          <label>Buscar y vincular hijos ({selectedChildren.length} seleccionados)</label>
          {selectedChildren.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"6px", marginBottom:"8px" }}>
              {selectedChildren.map(s=><span key={s.id} className="badge" style={{ background:"#fff7ed", color:"#7c2d12" }}>{s.name} ({s.grade})</span>)}
            </div>
          )}
          <div style={{ marginTop:"8px", marginBottom:"16px" }}>
            <StudentSearch buttonLabel="+ Vincular" onSelect={toggleChild} />
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
            {parents.map(p => (
              <tr key={p.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"12px 16px", fontWeight:600 }}>{p.name}</td>
                <td style={{ padding:"12px 16px", color:"#64748b", fontSize:"0.85rem" }}>{p.email}</td>
                <td style={{ padding:"12px 16px", fontSize:"0.82rem", color:"#94a3b8" }}>{(p.childIds||[]).length} hijo(s)</td>
                <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeParent(p.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllGradesTab({ grades, users, setGrades, setSaving }) {
  const [trim, setTrim] = useState(0);
  const [studentFilter, setStudentFilter] = useState(null);

  const filtered = grades
    .filter(g => trim===0 || g.trimester===trim)
    .filter(g => !studentFilter || g.studentId===studentFilter.id);

  async function removeGrade(id) {
    setSaving(true);
    await deleteGrade(id);
    setGrades(prev => prev.filter(g => g.id !== id));
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>
          {[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
            <button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding:"16px", marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
          <label style={{ margin:0 }}>Filtrar por alumno</label>
          {studentFilter && <button onClick={()=>setStudentFilter(null)} style={{ fontSize:"0.78rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Limpiar filtro</button>}
        </div>
        {studentFilter ? (
          <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{studentFilter.name} ({studentFilter.grade})</span>
        ) : (
          <StudentSearch buttonLabel="Filtrar" onSelect={setStudentFilter} />
        )}
      </div>

      <div className="card" style={{ overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"700px" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Alumno","Materia","Tipo","Nota","Trimestre","Fecha",""].map(h=><th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:"0.75rem", color:"#94a3b8", textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"12px 16px", fontWeight:600, fontSize:"0.9rem" }}>{g.studentName||"–"}</td>
                <td style={{ padding:"12px 16px", fontSize:"0.85rem", color:"#475569" }}>{g.subject}</td>
                <td style={{ padding:"12px 16px" }}><span className="badge" style={{ background:"#f0f9ff", color:"#0369a1" }}>{g.type}</span></td>
                <td style={{ padding:"12px 16px" }}><span style={{ fontWeight:800, fontSize:"1.1rem", color:scoreColor(g.score) }}>{g.score}</span><span style={{ color:"#94a3b8", fontSize:"0.75rem" }}>/10</span></td>
                <td style={{ padding:"12px 16px", fontSize:"0.82rem", color:"#64748b" }}>{trimNames[g.trimester-1]}</td>
                <td style={{ padding:"12px 16px", fontSize:"0.82rem", color:"#64748b" }}>{g.date}</td>
                <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
