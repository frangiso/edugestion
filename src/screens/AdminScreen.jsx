import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import {
  getAllTeachers, getAllGrades, getAllStudents, getAllAttitudes,
  createUser, updateStudent, createStudent,
  deleteStudent, deleteUserProfile, deleteGrade, searchStudents, searchParents,
  searchObservations, getAttitudesByStudent,
  ATTITUDE_VALUES, ATTITUDE_LABELS, ATTITUDE_COLORS
} from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];
const SUBJECTS = ["Matemática","Tecnología","Lengua y Literatura","Inglés","Lenguaje de las Artes Visuales","Psicología","Geografía","Política y Ciudadanía","Filosofía","Biología","Producción de las Artes Visuales","Educación Física","Artes Visuales y T.I.C.","Química","Educación Artística","Historia","Física","Economía","Formación para la Vida y el Trabajo","Sociología","Formación Ética","E.O.I.","Arte e Industrias Culturales","Arte Cultura y Sociedades"];

// ── Helpers actitudinales ────────────────────────────────────────
const ATTITUDE_NUM = { PD:1, DB:2, DM:3, DA:4 };
function numToAttitude(n) {
  if (n <= 1.5) return "PD";
  if (n <= 2.5) return "DB";
  if (n <= 3.5) return "DM";
  return "DA";
}
function calcAttSummary(atts, trimNum) {
  const filtered = trimNum ? atts.filter(a => a.trimester === trimNum) : atts;
  if (!filtered.length) return null;
  const nums = filtered.map(a => ATTITUDE_NUM[a.value]).filter(Boolean);
  if (!nums.length) return null;
  const numAvg = nums.reduce((a,b) => a+b, 0) / nums.length;
  return { value: numToAttitude(numAvg), numAvg: parseFloat(numAvg.toFixed(2)), count: filtered.length };
}

// ── Componente principal ─────────────────────────────────────────
export default function AdminScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("overview");
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Lazy: grades solo se carga al abrir la pestaña "Notas" ──
  const [grades, setGrades] = useState([]);
  const [gradesLoaded, setGradesLoaded] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);

  // Al montar: solo carga profesores (sin getAllGrades)
  useEffect(() => { loadInitial(); }, []);

  async function loadInitial() {
    setLoading(true);
    const t = await getAllTeachers();
    setTeachers(t);
    setLoading(false);
  }

  // Carga lazy de notas (solo la primera vez que se abre la pestaña)
  async function ensureGradesLoaded() {
    if (gradesLoaded) return;
    setGradesLoading(true);
    const g = await getAllGrades();
    setGrades(g);
    setGradesLoaded(true);
    setGradesLoading(false);
  }

  // Cambio de pestaña con lazy loading de notas
  function handleTabChange(newTab) {
    setTab(newTab);
    if (newTab === "allgrades" || newTab === "overview") ensureGradesLoaded();
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle="Panel Director" />
      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
          {[
            ["overview","📊 Resumen"],
            ["students","👨‍🎓 Alumnos"],
            ["teachers","👨‍🏫 Profesores"],
            ["parents","👨‍👩‍👧 Tutores"],
            ["allgrades","📋 Notas"],
            ["attitudes","🎯 Actitudinales"],
            ["allobservations","💬 Observaciones"],
            ["export","📥 Exportar Excel"],
          ].map(([k,l]) => (
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>handleTabChange(k)}>{l}</button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando datos...</div>
        ) : (
          <div className="fade" key={tab}>
            {tab === "overview"        && <Overview grades={grades} teachers={teachers} gradesLoaded={gradesLoaded} gradesLoading={gradesLoading} />}
            {tab === "students"        && <StudentsTab setSaving={setSaving} />}
            {tab === "teachers"        && <TeachersTab teachers={teachers} setTeachers={setTeachers} setSaving={setSaving} />}
            {tab === "parents"         && <ParentsTab setSaving={setSaving} />}
            {tab === "allgrades"       && <AllGradesTab grades={grades} setGrades={setGrades} setSaving={setSaving} loaded={gradesLoaded} loading={gradesLoading} />}
            {tab === "attitudes"       && <AllAttitudesTab />}
            {tab === "allobservations" && <AllObservationsTab />}
            {tab === "export"         && <ExportTab />}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RESUMEN
// Muestra datos de profesores siempre; notas solo cuando ya cargaron
// ════════════════════════════════════════════════════════════════════
function Overview({ grades, teachers, gradesLoaded, gradesLoading }) {
  const globalAvg = gradesLoaded ? avg(grades.map(g => g.score)) : "–";
  const cards = [
    { icon:"👨‍🏫", label:"Profesores", value: teachers.length, color:"#065f46" },
    { icon:"📝", label:"Evaluaciones", value: gradesLoaded ? grades.length : "–", color:"#4c1d95" },
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
        {gradesLoading ? (
          <div style={{ textAlign:"center", padding:"20px", color:"#94a3b8", fontSize:"0.9rem" }}>Cargando estadísticas...</div>
        ) : !gradesLoaded ? (
          <div style={{ textAlign:"center", padding:"20px", color:"#94a3b8", fontSize:"0.9rem" }}>Abrí la pestaña 📋 Notas para cargar las estadísticas</div>
        ) : (
          [1,2,3].map(t => {
            const tg = grades.filter(g => g.trimester === t);
            const ta = avg(tg.map(g => g.score));
            return (
              <div key={t} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontSize:"0.85rem", color:"#475569" }}>{trimNames[t-1]}</span>
                  <span style={{ fontWeight:700, color: ta==="–"?"#94a3b8":scoreColor(parseFloat(ta)) }}>{ta}</span>
                </div>
                <div style={{ height:"6px", background:"#e2e8f0", borderRadius:"3px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width: ta==="–"?"0":`${parseFloat(ta)*10}%`, background: ta==="–"?"#e2e8f0":scoreColor(parseFloat(ta)), borderRadius:"3px" }} />
                </div>
                <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:"2px" }}>{tg.length} evaluaciones</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BUSCADOR DE ALUMNOS (reutilizable)
// ════════════════════════════════════════════════════════════════════
function StudentSearch({ onSelect, buttonLabel="Seleccionar" }) {
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState("");
  const [results, setResults] = useState([]); const [searched, setSearched] = useState(false); const [loading, setLoading] = useState(false);
  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setLoading(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setResults(r); setSearched(true); setLoading(false);
  }
  return (
    <div>
      <div style={{ display:"flex", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
        <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Buscar por nombre..." style={{ flex:1, minWidth:"160px" }} />
        <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
          <option value="">Todos los años</option>
          {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn-primary" onClick={doSearch} disabled={loading}>{loading?"Buscando...":"Buscar"}</button>
      </div>
      {searched && results.length===0 && <p style={{ color:"#94a3b8", fontSize:"0.85rem" }}>No se encontraron alumnos.</p>}
      {results.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"220px", overflowY:"auto" }}>
          {results.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#f8fafc", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
              <div>
                <span style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</span>
                <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"8px" }}>{s.grade}</span>
              </div>
              {onSelect && <button className="btn-primary" onClick={()=>onSelect(s)} style={{ padding:"4px 12px", fontSize:"0.8rem" }}>{buttonLabel}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ALUMNOS
// ════════════════════════════════════════════════════════════════════
function StudentsTab({ setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", grade:"", tutorEmail:"" });
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({ name:"", grade:"", tutorEmail:"" });
  const [success, setSuccess] = useState("");

  async function addStudent() {
    if (!form.name || !form.grade) { alert("Completá nombre y año"); return; }
    setSaving(true);
    await createStudent(form);
    setForm({ name:"", grade:"", tutorEmail:"" }); setShowForm(false);
    setSuccess("✅ Alumno guardado"); setTimeout(()=>setSuccess(""), 2500);
    setSaving(false);
  }
  async function removeStudent(id) {
    if (!confirm("¿Eliminar este alumno?")) return;
    setSaving(true); await deleteStudent(id); setSaving(false);
    setEditStudent(null); setSuccess("✅ Alumno eliminado"); setTimeout(()=>setSuccess(""), 2500);
  }
  async function saveEdit() {
    if (!editForm.name || !editForm.grade) { alert("Completá nombre y año"); return; }
    setSaving(true);
    await updateStudent(editStudent.id, { name:editForm.name, grade:editForm.grade, tutorEmail:editForm.tutorEmail });
    setSaving(false); setEditStudent(null);
    setSuccess("✅ Alumno actualizado"); setTimeout(()=>setSuccess(""), 2500);
  }
  function startEdit(s) { setEditStudent(s); setEditForm({ name:s.name, grade:s.grade||"", tutorEmail:s.tutorEmail||"" }); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Alumnos</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo alumno"}</button>
      </div>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>{success}</div>}
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Nuevo alumno</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
            <div><label>Nombre completo</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Apellido Nombre" /></div>
            <div><label>Año</label>
              <select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>
                <option value="">Seleccionar...</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><label>Email del tutor (opcional)</label><input value={form.tutorEmail} onChange={e=>setForm({...form,tutorEmail:e.target.value})} placeholder="tutor@email.com" /></div>
          </div>
          <button className="btn-primary" onClick={addStudent} style={{ marginTop:"16px" }}>Guardar alumno</button>
        </div>
      )}
      <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
        <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar alumno para editar</h3>
        <StudentSearch buttonLabel="✏️ Editar" onSelect={startEdit} />
      </div>
      {editStudent && (
        <div className="card fade" style={{ padding:"24px", border:"2px solid #fde68a", background:"#fffbeb" }}>
          <h3 style={{ margin:"0 0 16px", color:"#92400e", fontSize:"1rem" }}>Editando: {editStudent.name}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <div><label>Nombre completo</label><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></div>
            <div><label>Año</label>
              <select value={editForm.grade} onChange={e=>setEditForm({...editForm,grade:e.target.value})}>
                <option value="">Seleccionar...</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div><label>Email del tutor</label><input value={editForm.tutorEmail} onChange={e=>setEditForm({...editForm,tutorEmail:e.target.value})} placeholder="tutor@email.com" /></div>
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            <button className="btn-primary" onClick={saveEdit}>💾 Guardar cambios</button>
            <button className="btn-danger" onClick={()=>removeStudent(editStudent.id)}>Eliminar alumno</button>
            <button onClick={()=>setEditStudent(null)} style={{ padding:"10px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PROFESORES
// ════════════════════════════════════════════════════════════════════
function TeachersTab({ teachers, setTeachers, setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", subjects:[] });
  function toggleSubject(s) { setForm(f=>({...f, subjects:f.subjects.includes(s)?f.subjects.filter(x=>x!==s):[...f.subjects,s]})); }
  async function addTeacher() {
    if (!form.name||!form.email||!form.password||form.subjects.length===0){alert("Completá todos los campos y seleccioná al menos una materia");return;}
    setSaving(true);
    try {
      const uid = await createUser(form.email,form.password,{name:form.name,subjects:form.subjects,subject:form.subjects[0],role:"teacher"});
      setTeachers(prev=>[...prev,{id:uid,role:"teacher",name:form.name,email:form.email,subjects:form.subjects,subject:form.subjects[0]}]);
      setForm({name:"",email:"",password:"",subjects:[]}); setShowForm(false);
    } catch(e){alert(e.message);}
    setSaving(false);
  }
  async function removeTeacher(id) {
    if(!confirm("¿Eliminar este profesor?"))return;
    setSaving(true); await deleteUserProfile(id); setTeachers(prev=>prev.filter(t=>t.id!==id)); setSaving(false);
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
            {SUBJECTS.map(s=><button key={s} onClick={()=>toggleSubject(s)} style={{ padding:"6px 12px", borderRadius:"20px", border:`2px solid ${form.subjects.includes(s)?"#065f46":"#e2e8f0"}`, background:form.subjects.includes(s)?"#d1fae5":"white", color:form.subjects.includes(s)?"#065f46":"#64748b", cursor:"pointer", fontSize:"0.8rem", fontWeight:600 }}>{s}</button>)}
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
            {teachers.map(t=>{
              const materias = t.subjects||(t.subject?[t.subject]:[]);
              return (
                <tr key={t.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"12px 16px", fontWeight:600 }}>{t.name}</td>
                  <td style={{ padding:"12px 16px", color:"#64748b", fontSize:"0.85rem" }}>{t.email}</td>
                  <td style={{ padding:"12px 16px" }}>{materias.map(m=><span key={m} className="badge" style={{ background:"#d1fae5", color:"#065f46", marginRight:"4px", marginBottom:"4px" }}>{m}</span>)}</td>
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

// ════════════════════════════════════════════════════════════════════
// TUTORES
// ════════════════════════════════════════════════════════════════════
function ParentsTab({ setSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", childIds:[], childrenNames:[] });
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [searchText, setSearchText] = useState(""); const [results, setResults] = useState([]); const [searched, setSearched] = useState(false); const [searching, setSearching] = useState(false);
  async function doSearch() { setSearching(true); const r=await searchParents(searchText); setResults(r); setSearched(true); setSearching(false); }
  function toggleChild(s) {
    const already=selectedChildren.find(x=>x.id===s.id);
    if(already){setSelectedChildren(prev=>prev.filter(x=>x.id!==s.id));setForm(f=>({...f,childIds:f.childIds.filter(id=>id!==s.id),childrenNames:f.childrenNames.filter(n=>n!==s.name)}));}
    else{setSelectedChildren(prev=>[...prev,s]);setForm(f=>({...f,childIds:[...f.childIds,s.id],childrenNames:[...f.childrenNames,s.name]}));}
  }
  async function addParent() {
    if(!form.name||!form.email||!form.password)return;
    setSaving(true);
    try{
      const uid=await createUser(form.email,form.password,{name:form.name,role:"parent",childIds:form.childIds,childrenNames:form.childrenNames});
      setResults(prev=>[...prev,{id:uid,role:"parent",name:form.name,email:form.email,childIds:form.childIds,childrenNames:form.childrenNames}]);
      setForm({name:"",email:"",password:"",childIds:[],childrenNames:[]});setSelectedChildren([]);setShowForm(false);
    }catch(e){alert(e.message);}
    setSaving(false);
  }
  async function removeParent(id){if(!confirm("¿Eliminar este tutor?"))return;setSaving(true);await deleteUserProfile(id);setResults(prev=>prev.filter(p=>p.id!==id));setSaving(false);}
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Tutores</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nuevo tutor"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #fed7aa" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <div><label>Nombre</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
            <div><label>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div><label>Contraseña inicial</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
          </div>
          <label>Vincular hijos ({selectedChildren.length} seleccionados)</label>
          {selectedChildren.length>0&&<div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"6px",marginBottom:"8px" }}>{selectedChildren.map(s=><span key={s.id} className="badge" style={{ background:"#fff7ed",color:"#7c2d12",cursor:"pointer" }} onClick={()=>toggleChild(s)}>{s.name} ✕</span>)}</div>}
          <div style={{ marginTop:"8px", marginBottom:"16px" }}><StudentSearch buttonLabel="+ Vincular" onSelect={toggleChild} /></div>
          <button className="btn-primary" onClick={addParent}>Guardar tutor</button>
        </div>
      )}
      <div className="card" style={{ padding:"24px", marginBottom:"16px" }}>
        <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar tutor</h3>
        <div style={{ display:"flex", gap:"10px" }}>
          <input value={searchText} onChange={e=>setSearchText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre o email..." style={{ flex:1 }} />
          <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
        </div>
        {!searched&&<p style={{ color:"#94a3b8",fontSize:"0.82rem",marginTop:"10px",marginBottom:0 }}>Escribí un nombre o email y presioná Buscar.</p>}
      </div>
      {searched&&results.length===0&&<div className="card" style={{ padding:"32px",textAlign:"center",color:"#94a3b8" }}><p>No se encontraron tutores.</p></div>}
      {results.length>0&&(
        <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
          {results.map(p=>(
            <div key={p.id} className="card" style={{ padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,color:"#1e293b",fontSize:"0.95rem" }}>{p.name}</div>
                <div style={{ fontSize:"0.82rem",color:"#64748b",marginTop:"2px" }}>{p.email}</div>
                <div style={{ marginTop:"6px",display:"flex",flexWrap:"wrap",gap:"4px" }}>
                  {(p.childrenNames||[]).length>0?(p.childrenNames||[]).map((n,i)=><span key={i} className="badge" style={{ background:"#fff7ed",color:"#7c2d12" }}>{n}</span>):<span style={{ fontSize:"0.78rem",color:"#94a3b8" }}>Sin hijos vinculados</span>}
                </div>
              </div>
              <button className="btn-danger" onClick={()=>removeParent(p.id)} style={{ marginLeft:"16px" }}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TODAS LAS NOTAS — lazy: recibe loaded/loading del padre
// ════════════════════════════════════════════════════════════════════
function AllGradesTab({ grades, setGrades, setSaving, loaded, loading }) {
  const [trim, setTrim] = useState(0);
  const [studentFilter, setStudentFilter] = useState(null);
  const filtered = grades.filter(g=>trim===0||g.trimester===trim).filter(g=>!studentFilter||g.studentId===studentFilter.id);
  async function removeGrade(id){setSaving(true);await deleteGrade(id);setGrades(prev=>prev.filter(g=>g.id!==id));setSaving(false);}

  if (loading) {
    return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando evaluaciones...</div>;
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>{[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=><button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px",borderRadius:"20px",background:trim===v?"#1e3a5f":"#f1f5f9",color:trim===v?"white":"#64748b",border:"none",cursor:"pointer",fontSize:"0.78rem",fontWeight:600 }}>{l}</button>)}</div>
      </div>
      <div className="card" style={{ padding:"16px", marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
          <label style={{ margin:0 }}>Filtrar por alumno</label>
          {studentFilter&&<button onClick={()=>setStudentFilter(null)} style={{ fontSize:"0.78rem",color:"#dc2626",background:"none",border:"none",cursor:"pointer" }}>✕ Limpiar filtro</button>}
        </div>
        {studentFilter?<span className="badge" style={{ background:"#dbeafe",color:"#1e40af" }}>{studentFilter.name} ({studentFilter.grade})</span>:<StudentSearch buttonLabel="Filtrar" onSelect={setStudentFilter} />}
      </div>
      <div className="card" style={{ overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"700px" }}>
          <thead><tr style={{ borderBottom:"2px solid #e2e8f0" }}>
            {["Alumno","Materia","Tipo","Nota","Trimestre","Fecha",""].map(h=><th key={h} style={{ padding:"12px 16px",textAlign:"left",fontSize:"0.75rem",color:"#94a3b8",textTransform:"uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(g=>(
              <tr key={g.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                <td style={{ padding:"12px 16px",fontWeight:600,fontSize:"0.9rem" }}>{g.studentName||"–"}</td>
                <td style={{ padding:"12px 16px",fontSize:"0.85rem",color:"#475569" }}>{g.subject}</td>
                <td style={{ padding:"12px 16px" }}><span className="badge" style={{ background:"#f0f9ff",color:"#0369a1" }}>{g.type}</span></td>
                <td style={{ padding:"12px 16px" }}><span style={{ fontWeight:800,fontSize:"1.1rem",color:scoreColor(g.score) }}>{g.score}</span><span style={{ color:"#94a3b8",fontSize:"0.75rem" }}>/10</span></td>
                <td style={{ padding:"12px 16px",fontSize:"0.82rem",color:"#64748b" }}>{trimNames[g.trimester-1]}</td>
                <td style={{ padding:"12px 16px",fontSize:"0.82rem",color:"#64748b" }}>{g.date}</td>
                <td style={{ padding:"12px 16px" }}><button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 🎯 ACTITUDINALES — VISTA DEL DIRECTOR
// ════════════════════════════════════════════════════════════════════
function AllAttitudesTab() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attitudes, setAttitudes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrim, setSelectedTrim] = useState(0);

  async function selectStudent(s) {
    setSelectedStudent(s);
    setLoading(true);
    const att = await getAttitudesByStudent(s.id);
    setAttitudes(att);
    setLoading(false);
  }

  const attFiltered = selectedTrim ? attitudes.filter(a => a.trimester === selectedTrim) : attitudes;

  function getByTrimSubject(triNum) {
    const attTrim = attitudes.filter(a => a.trimester === triNum);
    const bySubject = {};
    attTrim.forEach(a => {
      if (!bySubject[a.subject]) bySubject[a.subject] = [];
      bySubject[a.subject].push(a);
    });
    return bySubject;
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>Actitudinales por alumno</h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", marginBottom:"24px" }}>
        Buscá un alumno para ver qué actitudinal le asignó cada profesor y el promedio general por trimestre.
      </p>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        {ATTITUDE_VALUES.map(v=>(
          <div key={v} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"5px 12px", borderRadius:"20px", background:`${ATTITUDE_COLORS[v]}15`, border:`1px solid ${ATTITUDE_COLORS[v]}` }}>
            <span style={{ fontWeight:800, color:ATTITUDE_COLORS[v], fontSize:"0.85rem" }}>{v}</span>
            <span style={{ fontSize:"0.75rem", color:"#475569" }}>{ATTITUDE_LABELS[v]}</span>
          </div>
        ))}
      </div>

      {/* Buscador */}
      {!selectedStudent ? (
        <div className="card" style={{ padding:"24px" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar alumno</h3>
          <StudentSearch buttonLabel="Ver actitudinales" onSelect={selectStudent} />
        </div>
      ) : (
        <div>
          {/* Header alumno */}
          <div className="card" style={{ padding:"20px 24px", marginBottom:"24px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f" }}>
            <div>
              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"1.1rem" }}>{selectedStudent.name}</div>
              <span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginTop:"4px" }}>{selectedStudent.grade}</span>
            </div>
            <button onClick={()=>{ setSelectedStudent(null); setAttitudes([]); }} style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#64748b", fontSize:"0.85rem" }}>← Buscar otro alumno</button>
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>Cargando actitudinales...</div>
          ) : attitudes.length === 0 ? (
            <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
              <div style={{ fontSize:"3rem" }}>🎯</div>
              <p>No hay actitudinales registradas para {selectedStudent.name}</p>
            </div>
          ) : (
            <>
              {/* Selector de trimestre */}
              <div style={{ display:"flex", gap:"8px", marginBottom:"24px", flexWrap:"wrap" }}>
                {[["Todos los trimestres", 0], ...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
                  <button key={v} onClick={()=>setSelectedTrim(v)} style={{ padding:"7px 16px", borderRadius:"20px", background:selectedTrim===v?"#1e3a5f":"white", color:selectedTrim===v?"white":"#64748b", border:`1px solid ${selectedTrim===v?"#1e3a5f":"#e2e8f0"}`, cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
                ))}
              </div>

              {/* Por cada trimestre */}
              {(selectedTrim ? [selectedTrim] : [1,2,3]).map(triNum => {
                const bySubject = getByTrimSubject(triNum);
                if (Object.keys(bySubject).length === 0) return null;
                const summary = calcAttSummary(attitudes, triNum);

                return (
                  <div key={triNum} style={{ marginBottom:"32px" }}>
                    <div className="card" style={{ padding:"20px 24px", marginBottom:"16px", background:"#1e3a5f", borderRadius:"16px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
                        <h3 style={{ fontFamily:"'Playfair Display',serif", color:"white", margin:0, fontSize:"1.15rem" }}>
                          {trimNames[triNum-1]}
                        </h3>
                        {summary && (
                          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                                Promedio actitudinal ({summary.count} registro{summary.count!==1?"s":""})
                              </div>
                              <div style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.6)", marginTop:"2px" }}>
                                Escala numérica: {summary.numAvg} / 4.00
                              </div>
                            </div>
                            <div style={{ background:`${ATTITUDE_COLORS[summary.value]}25`, border:`3px solid ${ATTITUDE_COLORS[summary.value]}`, borderRadius:"14px", padding:"10px 20px", textAlign:"center", minWidth:"100px" }}>
                              <div style={{ fontWeight:800, color:ATTITUDE_COLORS[summary.value], fontSize:"1.6rem", fontFamily:"'Playfair Display',serif" }}>
                                {summary.value}
                              </div>
                              <div style={{ fontSize:"0.7rem", color:ATTITUDE_COLORS[summary.value], fontWeight:600 }}>
                                {ATTITUDE_LABELS[summary.value]}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detalle por materia */}
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"14px" }}>
                      {Object.entries(bySubject).map(([subject, atts]) => {
                        const nums = atts.map(a=>ATTITUDE_NUM[a.value]).filter(Boolean);
                        const subNumAvg = nums.reduce((a,b)=>a+b,0)/nums.length;
                        const subVal = numToAttitude(subNumAvg);

                        return (
                          <div key={subject} className="card" style={{ padding:"18px 20px", borderTop:`4px solid ${ATTITUDE_COLORS[subVal]}` }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
                              <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.95rem", flex:1, paddingRight:"8px" }}>{subject}</div>
                              <span style={{ padding:"4px 12px", borderRadius:"20px", background:`${ATTITUDE_COLORS[subVal]}15`, border:`2px solid ${ATTITUDE_COLORS[subVal]}`, fontWeight:800, color:ATTITUDE_COLORS[subVal], fontSize:"0.88rem", whiteSpace:"nowrap" }}>
                                {subVal}
                              </span>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                              {atts.map((a, i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:"#f8fafc", borderRadius:"8px" }}>
                                  <div>
                                    <div style={{ fontSize:"0.82rem", fontWeight:600, color:"#475569" }}>Prof. {a.teacherName}</div>
                                    {a.note && <div style={{ fontSize:"0.74rem", color:"#94a3b8", marginTop:"2px" }}>"{a.note}"</div>}
                                  </div>
                                  <span style={{ padding:"3px 10px", borderRadius:"20px", background:`${ATTITUDE_COLORS[a.value]}15`, border:`1.5px solid ${ATTITUDE_COLORS[a.value]}`, fontWeight:700, color:ATTITUDE_COLORS[a.value], fontSize:"0.82rem", marginLeft:"8px", whiteSpace:"nowrap" }}>
                                    {a.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {atts.length > 1 && (
                              <div style={{ marginTop:"10px", display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:"8px", borderTop:"1px solid #e2e8f0" }}>
                                <span style={{ fontSize:"0.75rem", color:"#94a3b8" }}>Promedio {atts.length} profesores</span>
                                <span style={{ fontWeight:700, color:ATTITUDE_COLORS[subVal], fontSize:"0.85rem" }}>
                                  {subVal} — {ATTITUDE_LABELS[subVal]}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// OBSERVACIONES
// ════════════════════════════════════════════════════════════════════
function AllObservationsTab() {
  const [studentFilter, setStudentFilter] = useState(null);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [results, setResults] = useState([]); const [searched, setSearched] = useState(false); const [loading, setLoading] = useState(false);
  async function doSearch() {
    setLoading(true);
    const r = await searchObservations({ studentId:studentFilter?.id||"", teacherName:teacherFilter });
    setResults(r); setSearched(true); setLoading(false);
  }
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Observaciones</h2>
      <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Filtrar observaciones</h3>
        <div style={{ marginBottom:"16px" }}>
          <label>Alumno (opcional)</label>
          {studentFilter?(
            <div style={{ display:"flex",gap:"8px",alignItems:"center",marginTop:"6px" }}>
              <span className="badge" style={{ background:"#dbeafe",color:"#1e40af" }}>{studentFilter.name} ({studentFilter.grade})</span>
              <button onClick={()=>setStudentFilter(null)} style={{ fontSize:"0.78rem",color:"#dc2626",background:"none",border:"none",cursor:"pointer" }}>✕ Limpiar</button>
            </div>
          ):<div style={{ marginTop:"6px" }}><StudentSearch buttonLabel="Seleccionar" onSelect={setStudentFilter} /></div>}
        </div>
        <div style={{ marginBottom:"16px" }}>
          <label>Profesor (opcional)</label>
          <input value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)} placeholder="Nombre del profesor..." style={{ marginTop:"4px" }} />
        </div>
        <button className="btn-primary" onClick={doSearch} disabled={loading}>{loading?"Buscando...":"🔍 Buscar observaciones"}</button>
      </div>
      {searched&&results.length===0&&<div className="card" style={{ padding:"32px",textAlign:"center",color:"#94a3b8" }}><p>No se encontraron observaciones.</p></div>}
      {results.length>0&&(
        <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
          {results.map(o=>(
            <div key={o.id} className="card" style={{ padding:"16px 20px",borderLeft:"4px solid #7c3aed" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"8px" }}>
                <div><span style={{ fontWeight:700 }}>{o.studentName}</span><span className="badge" style={{ background:"#dbeafe",color:"#1e40af",marginLeft:"8px" }}>{o.studentGrade}</span></div>
                <div style={{ textAlign:"right" }}><div style={{ fontWeight:600,color:"#7c3aed",fontSize:"0.85rem" }}>Prof. {o.teacherName}</div><div style={{ fontSize:"0.78rem",color:"#94a3b8" }}>{o.date}</div></div>
              </div>
              <p style={{ margin:0,color:"#475569",fontSize:"0.9rem",lineHeight:1.5 }}>{o.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 📥 EXPORTAR EXCEL
// 3 hojas (1 por trimestre), cada hoja tiene los 6 cursos separados
// por una fila en blanco. Columnas: Alumno | Mat1 | Mat2 | ... | Actit.Prom
// Usa SheetJS (xlsx) que ya viene en el bundle de Vite via CDN o npm
// ════════════════════════════════════════════════════════════════════

const ATTITUDE_NUM_EXP = { PD:1, DB:2, DM:3, DA:4 };
const NUM_TO_ATT = (n) => {
  if (!n) return "–";
  if (n <= 1.5) return "PD";
  if (n <= 2.5) return "DB";
  if (n <= 3.5) return "DM";
  return "DA";
};
const GRADES_ORDER = ["1°","2°","3°","4°","5°","6°"];
const TRIM_NAMES_EXP = ["1° Trimestre","2° Trimestre","3° Trimestre"];

function avgNum(nums) {
  const valid = nums.filter(n => n !== null && n !== undefined && !isNaN(n));
  if (!valid.length) return null;
  return parseFloat((valid.reduce((a,b) => a+b, 0) / valid.length).toFixed(2));
}

function ExportTab() {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  async function handleExport() {
    setExporting(true);
    setStatus("Cargando datos...");

    try {
      // Cargar todo en paralelo
      const [students, grades, attitudes] = await Promise.all([
        getAllStudents(),
        getAllGrades(),
        getAllAttitudes(),
      ]);

      setStatus(`Procesando ${grades.length} evaluaciones...`);

      // Descubrir todas las materias que aparecen en grades
      const subjectsSet = new Set(grades.map(g => g.subject).filter(Boolean));
      const allSubjects = [...subjectsSet].sort();

      // Importar SheetJS dinámicamente
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs");
      const wb = XLSX.utils.book_new();

      // Una hoja por trimestre
      for (let trimIdx = 0; trimIdx < 3; trimIdx++) {
        const trimNum = trimIdx + 1;
        const sheetData = [];

        // Encabezado global de columnas
        const headerRow = ["Alumno", ...allSubjects, "Actit. Prom."];
        sheetData.push(headerRow);

        // Por cada curso
        for (const grade of GRADES_ORDER) {
          const courseStudents = students
            .filter(s => s.grade === grade)
            .sort((a,b) => a.name.localeCompare(b.name));

          if (courseStudents.length === 0) continue;

          // Fila de título del curso
          sheetData.push([`── ${grade} Año ──`]);

          for (const student of courseStudents) {
            // Promedios por materia en este trimestre
            const row = [student.name];
            for (const subject of allSubjects) {
              const studentGrades = grades.filter(
                g => g.studentId === student.id &&
                     g.subject === subject &&
                     g.trimester === trimNum
              );
              const scores = studentGrades.map(g => g.score).filter(s => s !== undefined && s !== null);
              row.push(scores.length > 0 ? avgNum(scores) : "–");
            }

            // Promedio actitudinal del trimestre
            const studentAtts = attitudes.filter(
              a => a.studentId === student.id && a.trimester === trimNum
            );
            if (studentAtts.length > 0) {
              const attNums = studentAtts
                .map(a => ATTITUDE_NUM_EXP[a.value])
                .filter(Boolean);
              const attAvgNum = attNums.length
                ? attNums.reduce((a,b) => a+b, 0) / attNums.length
                : null;
              row.push(attAvgNum ? NUM_TO_ATT(attAvgNum) : "–");
            } else {
              row.push("–");
            }

            sheetData.push(row);
          }

          // Fila en blanco entre cursos
          sheetData.push([]);
        }

        // Crear hoja
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Anchos de columna
        ws["!cols"] = [
          { wch: 28 }, // Alumno
          ...allSubjects.map(() => ({ wch: 14 })),
          { wch: 12 }, // Actit
        ];

        XLSX.utils.book_append_sheet(wb, ws, TRIM_NAMES_EXP[trimIdx]);
      }

      // Descargar
      const year = new Date().getFullYear();
      XLSX.writeFile(wb, `EduGestion_${year}.xlsx`);
      setStatus("✅ Descargado correctamente");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error al exportar: " + err.message);
    }

    setExporting(false);
  }

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>
        Exportar a Excel
      </h2>
      <p style={{ color:"#64748b", fontSize:"0.9rem", margin:"0 0 32px" }}>
        Genera un archivo <strong>.xlsx</strong> con 3 hojas (una por trimestre). En cada hoja aparecen los 6 cursos con el promedio de cada materia y el promedio actitudinal del trimestre.
      </p>

      {/* Preview de estructura */}
      <div className="card" style={{ padding:"24px", marginBottom:"28px", borderLeft:"4px solid #1e3a5f" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"0.95rem", textTransform:"uppercase", letterSpacing:"0.5px" }}>
          Estructura del archivo
        </h3>
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"16px" }}>
          {TRIM_NAMES_EXP.map((t,i) => (
            <div key={i} style={{ padding:"10px 20px", borderRadius:"10px", background:"#dbeafe", color:"#1e40af", fontWeight:700, fontSize:"0.88rem" }}>
              📄 {t}
            </div>
          ))}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", fontSize:"0.8rem", minWidth:"500px" }}>
            <thead>
              <tr style={{ background:"#1e3a5f", color:"white" }}>
                {["Alumno","Matemática","Lengua","Historia","...","Actit. Prom."].map((h,i) => (
                  <th key={i} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background:"#f1f5f9" }}>
                <td colSpan={6} style={{ padding:"6px 12px", fontWeight:700, color:"#475569", fontStyle:"italic" }}>── 1° Año ──</td>
              </tr>
              {[["García Juan","7.50","8.00","6.50","...","DM"],["López Ana","9.00","7.50","8.00","...","DA"]].map((row,i) => (
                <tr key={i} style={{ borderBottom:"1px solid #e2e8f0" }}>
                  {row.map((cell,j) => (
                    <td key={j} style={{ padding:"6px 12px", color: j===0?"#1e293b":"#475569", fontWeight: j===0?600:400 }}>{cell}</td>
                  ))}
                </tr>
              ))}
              <tr><td colSpan={6} style={{ padding:"4px" }}></td></tr>
              <tr style={{ background:"#f1f5f9" }}>
                <td colSpan={6} style={{ padding:"6px 12px", fontWeight:700, color:"#475569", fontStyle:"italic" }}>── 2° Año ──</td>
              </tr>
              <tr style={{ borderBottom:"1px solid #e2e8f0" }}>
                {["Pérez Carlos","8.00","–","7.00","...","DB"].map((cell,j) => (
                  <td key={j} style={{ padding:"6px 12px", color: j===0?"#1e293b":"#475569", fontWeight: j===0?600:400 }}>{cell}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Botón */}
      <div style={{ display:"flex", alignItems:"center", gap:"20px", flexWrap:"wrap" }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding:"14px 40px",
            borderRadius:"12px",
            background: exporting ? "#94a3b8" : "#1e3a5f",
            color:"white",
            border:"none",
            cursor: exporting ? "not-allowed" : "pointer",
            fontWeight:700,
            fontSize:"1rem",
            fontFamily:"inherit",
            display:"flex",
            alignItems:"center",
            gap:"10px",
          }}
        >
          {exporting ? "⏳ Generando..." : "📥 Descargar Excel"}
        </button>
        {status && (
          <span style={{
            fontSize:"0.9rem",
            color: status.startsWith("✅") ? "#065f46" : status.startsWith("❌") ? "#dc2626" : "#64748b",
            fontWeight:600,
          }}>
            {status}
          </span>
        )}
      </div>

      <p style={{ marginTop:"20px", fontSize:"0.8rem", color:"#94a3b8" }}>
        ⚠️ La primera exportación puede tardar unos segundos según la cantidad de datos.
        Los "–" indican que no hay notas o actitudinales cargadas para ese alumno en ese trimestre.
      </p>
    </div>
  );
}
