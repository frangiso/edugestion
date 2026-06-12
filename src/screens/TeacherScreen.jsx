import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor, Top6Tab, CourseObservationsTab } from "../components";
import {
  searchStudents, getStudentsByGrade,
  getGradesByTeacherPaged, getMoreGradesByTeacher, getGradesByStudent, getAllGradesByTeacher,
  createGrade, createGradesBatch, deleteGrade,
  getGradeTypes, addGradeType,
  getObservationsByTeacher, createObservation, deleteObservation,
  getAttitudesByTeacher, saveAttitude, saveAttitudesBatch, deleteAttitude,
  ATTITUDE_VALUES, ATTITUDE_LABELS, ATTITUDE_COLORS,
  getUpcomingByTeacher, getUpcomingPastByTeacher, createUpcoming, deleteUpcoming,
} from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];

// Convierte valor actitudinal a número para promediar
const ATTITUDE_NUM = { PD:1, DB:2, DM:3, DA:4 };
// Convierte número a valor más cercano
function numToAttitude(n) {
  if (n <= 1.5) return "PD";
  if (n <= 2.5) return "DB";
  if (n <= 3.5) return "DM";
  return "DA";
}

export default function TeacherScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("add");
  const [grades, setGrades] = useState([]);
  const [gradeTypes, setGradeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // ── Lazy: actitudinales y observaciones se cargan solo cuando se abre la pestaña ──
  const [attitudes, setAttitudes] = useState([]);
  const [attitudesLoaded, setAttitudesLoaded] = useState(false);
  const [observations, setObservations] = useState([]);
  const [observationsLoaded, setObservationsLoaded] = useState(false);

  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || "");

  // Al montar: solo carga notas y tipos (sin actitudinales ni observaciones)
  useEffect(() => { loadInitial(); }, []);

  async function loadInitial() {
    setLoading(true);
    const [{ grades: g, hasMore: hm }, types] = await Promise.all([
      getGradesByTeacherPaged(user.uid),
      getGradeTypes(user.uid),
    ]);
    setGrades(g); setHasMore(hm); setGradeTypes(types);
    setLoading(false);
  }

  // Carga lazy de actitudinales (solo la primera vez que se abre la pestaña)
  async function ensureAttitudesLoaded() {
    if (attitudesLoaded) return;
    const att = await getAttitudesByTeacher(user.uid);
    setAttitudes(att);
    setAttitudesLoaded(true);
  }

  // Carga lazy de observaciones (solo la primera vez que se abre la pestaña)
  async function ensureObservationsLoaded() {
    if (observationsLoaded) return;
    const obs = await getObservationsByTeacher(user.uid);
    setObservations(obs);
    setObservationsLoaded(true);
  }

  // Manejo de cambio de pestaña con lazy loading
  function handleTabChange(newTab) {
    setTab(newTab);
    if (newTab === "attitudes") ensureAttitudesLoaded();
    if (newTab === "observations") ensureObservationsLoaded();
  }

  async function loadMore() {
    const { grades: more, hasMore: hm } = await getMoreGradesByTeacher(user.uid);
    setGrades(more); setHasMore(hm);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle={`Profesor · ${subjects.join(", ")}`} />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {/* Selector de materia si tiene más de una */}
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

        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px", overflowX:"auto" }}>
          {[
            ["add","📝 Cargar nota"],
            ["mygrades","📋 Mis evaluaciones"],
            ["student","🔍 Ver alumno"],
            ["attitudes","🎯 Actitudinales"],
            ["observations","💬 Observaciones"],
            ["upcoming","📅 Próximas eval."],
            ["ranking","📊 Rendimiento"],
            ["top6","🏆 Top 6° Año"],
          ].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>handleTabChange(k)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div> : (
          <div className="fade" key={tab}>
            {tab==="add"          && <AddGrade user={user} subject={selectedSubject} grades={grades} setGrades={setGrades} gradeTypes={gradeTypes} setGradeTypes={setGradeTypes} setSaving={setSaving} profile={profile} />}
            {tab==="mygrades"     && <MyGrades grades={grades} setGrades={setGrades} setSaving={setSaving} hasMore={hasMore} loadMore={loadMore} />}
            {tab==="student"      && <StudentGradesTab user={user} subject={selectedSubject} setSaving={setSaving} />}
            {tab==="attitudes"    && <AttitudesTab user={user} profile={profile} subject={selectedSubject} attitudes={attitudes} setAttitudes={setAttitudes} setSaving={setSaving} loaded={attitudesLoaded} />}
            {tab==="observations" && <ObservationsTab user={user} profile={profile} observations={observations} setObservations={setObservations} setSaving={setSaving} loaded={observationsLoaded} />}
            {tab==="upcoming"     && <UpcomingTab user={user} profile={profile} subject={selectedSubject} setSaving={setSaving} />}
            {tab==="ranking"      && <Ranking grades={grades} subject={selectedSubject} />}
            {tab==="top6"         && <Top6Tab />}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARGAR NOTA (individual o masiva)
// ═══════════════════════════════════════════════════════════════════
function AddGrade({ user, subject, grades, setGrades, gradeTypes, setGradeTypes, setSaving, profile }) {
  const [mode, setMode] = useState("individual"); // individual | bulk
  // --- Individual ---
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState(""); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false); const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ score:"", type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
  const [success, setSuccess] = useState(false);
  const [newType, setNewType] = useState(""); const [showNewType, setShowNewType] = useState(false);
  // --- Bulk ---
  const [bulkGrade, setBulkGrade] = useState(""); const [bulkStudents, setBulkStudents] = useState([]); const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({ type:"Examen", trimester:1, date:new Date().toISOString().split("T")[0], note:"" });
  const [bulkScores, setBulkScores] = useState({});

  async function doSearch() { if (!nameQ && !gradeQ) return; setSearching(true); const r = await searchStudents({name:nameQ, grade:gradeQ}); setSearchResults(r); setSearching(false); }

  async function submitIndividual() {
    if (!selectedStudent || !form.score) return;
    const score = parseFloat(form.score);
    if (score<1||score>10) { alert("La nota debe estar entre 1 y 10"); return; }
    setSaving(true);
    const data = { ...form, score, teacherId:user.uid, teacherName:profile.name||"", subject, studentId:selectedStudent.id, studentName:selectedStudent.name, studentGrade:selectedStudent.grade||"" };
    const id = await createGrade(data);
    setGrades(prev=>[{id,...data},...prev]);
    setForm({ score:"", type:form.type, trimester:form.trimester, date:form.date, note:"" });
    setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500);
    setSaving(false);
  }

  async function loadBulkStudents() {
    if (!bulkGrade) return;
    setBulkLoading(true);
    const students = await searchStudents({ grade: bulkGrade });
    setBulkStudents(students);
    const scores = {};
    students.forEach(s => { scores[s.id] = ""; });
    setBulkScores(scores);
    setBulkLoading(false);
  }

  async function submitBulk() {
    const toSave = bulkStudents.filter(s => bulkScores[s.id] !== "" && !isNaN(parseFloat(bulkScores[s.id])));
    if (toSave.length === 0) { alert("Completá al menos una nota"); return; }
    const invalid = toSave.filter(s => parseFloat(bulkScores[s.id]) < 1 || parseFloat(bulkScores[s.id]) > 10);
    if (invalid.length > 0) { alert(`Nota inválida para: ${invalid.map(s=>s.name).join(", ")}. Debe ser entre 1 y 10.`); return; }
    setSaving(true);
    const gradesData = toSave.map(s => ({
      ...bulkForm,
      score: parseFloat(bulkScores[s.id]),
      teacherId: user.uid, teacherName: profile.name||"",
      subject, studentId: s.id, studentName: s.name, studentGrade: s.grade||"",
    }));
    const newGrades = await createGradesBatch(gradesData);
    setGrades(prev => [...newGrades, ...prev]);
    setBulkScores({});
    bulkStudents.forEach(s => { setBulkScores(prev=>({...prev,[s.id]:""})); });
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500);
    setSaving(false);
  }

  async function handleAddType() {
    if (!newType.trim()) return;
    const updated = await addGradeType(user.uid, newType.trim());
    setGradeTypes(updated);
    setNewType(""); setShowNewType(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Cargar evaluación · <span style={{ color:"#065f46" }}>{subject}</span></h2>
        <div style={{ display:"flex", gap:"8px" }}>
          {[["individual","👤 Individual"],["bulk","👥 Masiva por curso"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)} style={{ padding:"8px 16px", borderRadius:"20px", border:`2px solid ${mode===m?"#1e3a5f":"#e2e8f0"}`, background:mode===m?"#1e3a5f":"white", color:mode===m?"white":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>

      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ {mode==="bulk"?"Notas guardadas correctamente":"Nota guardada correctamente"}</div>}

      {/* Tipos de evaluación */}
      <div style={{ marginBottom:"20px" }}>
        <label>Tipo de evaluación</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"6px" }}>
          {gradeTypes.map(t => (
            <button key={t} onClick={()=>{ mode==="individual"?setForm(f=>({...f,type:t})):setBulkForm(f=>({...f,type:t})); }} style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${(mode==="individual"?form.type:bulkForm.type)===t?"#1e3a5f":"#e2e8f0"}`, background:(mode==="individual"?form.type:bulkForm.type)===t?"#1e3a5f":"white", color:(mode==="individual"?form.type:bulkForm.type)===t?"white":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{t}</button>
          ))}
          <button onClick={()=>setShowNewType(!showNewType)} style={{ padding:"6px 14px", borderRadius:"20px", border:"2px dashed #cbd5e1", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>+ Nuevo tipo</button>
        </div>
        {showNewType && (
          <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
            <input value={newType} onChange={e=>setNewType(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddType()} placeholder="Ej: Taller, Laboratorio..." style={{ flex:1 }} />
            <button className="btn-primary" onClick={handleAddType}>Agregar</button>
            <button onClick={()=>setShowNewType(false)} style={{ padding:"10px 14px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white" }}>✕</button>
          </div>
        )}
      </div>

      {/* ── MODO INDIVIDUAL ─────────────────────────────────────── */}
      {mode === "individual" && (
        <div>
          <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
            <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>1. Buscar alumno</h3>
            {selectedStudent ? (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px" }}>
                <div><span style={{ fontWeight:700 }}>{selectedStudent.name}</span><span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span></div>
                <button onClick={()=>{setSelectedStudent(null);setSearchResults([]);}} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
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
                    {searchResults.map(s=>(
                      <div key={s.id} onClick={()=>setSelectedStudent(s)} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}>
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
                  <label>Trimestre</label>
                  <select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>
                    {trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
                  </select>
                </div>
                <div><label>Fecha</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div>
                <div><label>Observación (opcional)</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Comentario para el tutor..." /></div>
              </div>
              <button className="btn-primary" onClick={submitIndividual} style={{ marginTop:"20px", padding:"12px 32px", fontSize:"1rem" }}>Guardar evaluación →</button>
            </div>
          )}
        </div>
      )}

      {/* ── MODO MASIVO ──────────────────────────────────────────── */}
      {mode === "bulk" && (
        <div>
          <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
            <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>1. Seleccionar curso</h3>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} style={{ flex:1 }}>
                <option value="">Seleccionar año...</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn-primary" onClick={loadBulkStudents} disabled={!bulkGrade||bulkLoading}>{bulkLoading?"Cargando...":"Cargar alumnos"}</button>
            </div>
          </div>

          {bulkStudents.length > 0 && (
            <>
              <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
                <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>2. Datos de la evaluación</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                  <div>
                    <label>Trimestre</label>
                    <select value={bulkForm.trimester} onChange={e=>setBulkForm({...bulkForm,trimester:parseInt(e.target.value)})}>
                      {trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
                    </select>
                  </div>
                  <div><label>Fecha</label><input type="date" value={bulkForm.date} onChange={e=>setBulkForm({...bulkForm,date:e.target.value})} /></div>
                  <div style={{ gridColumn:"1/-1" }}><label>Observación para todos (opcional)</label><input value={bulkForm.note} onChange={e=>setBulkForm({...bulkForm,note:e.target.value})} placeholder="Comentario general..." /></div>
                </div>
              </div>

              <div className="card" style={{ padding:"24px" }}>
                <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>3. Ingresar notas — {bulkGrade} ({bulkStudents.length} alumnos)</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px", alignItems:"center", marginBottom:"8px" }}>
                  <span style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Alumno</span>
                  <span style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase", width:"100px", textAlign:"center" }}>Nota (1–10)</span>
                </div>
                {bulkStudents.map(s => (
                  <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</div>
                    <input
                      type="number" min="1" max="10" step="0.5"
                      value={bulkScores[s.id]||""}
                      onChange={e=>setBulkScores(prev=>({...prev,[s.id]:e.target.value}))}
                      placeholder="–"
                      style={{ width:"100px", textAlign:"center", padding:"8px 10px" }}
                    />
                  </div>
                ))}
                <div style={{ marginTop:"20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.85rem", color:"#64748b" }}>{Object.values(bulkScores).filter(v=>v!=="").length} de {bulkStudents.length} notas completadas</span>
                  <button className="btn-primary" onClick={submitBulk} style={{ padding:"12px 32px", fontSize:"1rem" }}>Guardar todas las notas →</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MIS EVALUACIONES
// ═══════════════════════════════════════════════════════════════════
function MyGrades({ grades, setGrades, setSaving, hasMore, loadMore }) {
  const [trim, setTrim] = useState(0); const [nameFilter, setNameFilter] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const filtered = grades.filter(g=>trim===0||g.trimester===trim).filter(g=>!nameFilter||(g.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));
  async function removeGrade(id) { setSaving(true); await deleteGrade(id); setGrades(prev=>prev.filter(g=>g.id!==id)); setSaving(false); }
  async function handleLoadMore() { setLoadingMore(true); await loadMore(); setLoadingMore(false); }
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Mis evaluaciones ({filtered.length})</h2>
        <div style={{ display:"flex", gap:"6px" }}>{[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=><button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>)}</div>
      </div>
      <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por nombre..." style={{ width:"100%", marginBottom:"16px" }} />
      {filtered.length===0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}><div style={{ fontSize:"3rem" }}>📋</div><p>No hay evaluaciones aún</p></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {filtered.map(g=>(
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
          {hasMore && <button className="btn-primary" onClick={handleLoadMore} disabled={loadingMore} style={{ margin:"8px auto", display:"block" }}>{loadingMore?"Cargando...":"Cargar más evaluaciones"}</button>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACTITUDINALES — carga individual y masiva
// Recibe `loaded` para mostrar spinner mientras carga la primera vez
// ═══════════════════════════════════════════════════════════════════
function AttitudesTab({ user, profile, subject, attitudes, setAttitudes, setSaving, loaded }) {
  const [mode, setMode] = useState("individual"); // individual | bulk
  const [trim, setTrim] = useState(1);
  const [success, setSuccess] = useState("");

  // --- Individual ---
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState(""); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false); const [selectedStudent, setSelectedStudent] = useState(null);
  const [indValue, setIndValue] = useState("DB");
  const [indNote, setIndNote] = useState("");

  // --- Bulk ---
  const [bulkGrade, setBulkGrade] = useState(""); const [bulkStudents, setBulkStudents] = useState([]); const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkValues, setBulkValues] = useState({}); // { [studentId]: "PD"|"DB"|"DM"|"DA" }

  // Spinner mientras carga por primera vez
  if (!loaded) {
    return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando actitudinales...</div>;
  }

  async function doSearch() { if (!nameQ&&!gradeQ) return; setSearching(true); const r = await searchStudents({name:nameQ,grade:gradeQ}); setSearchResults(r); setSearching(false); }

  async function submitIndividual() {
    if (!selectedStudent) { alert("Seleccioná un alumno"); return; }
    setSaving(true);
    const data = {
      teacherId: user.uid, teacherName: profile.name||"",
      studentId: selectedStudent.id, studentName: selectedStudent.name, studentGrade: selectedStudent.grade||"",
      subject, trimester: trim, value: indValue,
      date: new Date().toISOString().split("T")[0],
      note: indNote.trim(),
    };
    const id = await saveAttitude(data);
    const saved = { id, ...data };
    setAttitudes(prev => { const idx=prev.findIndex(a=>a.id===id); return idx!==-1?prev.map(a=>a.id===id?saved:a):[saved,...prev]; });
    setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ(""); setIndNote("");
    setSuccess("✅ Actitudinal guardada");
    setTimeout(()=>setSuccess(""), 2500);
    setSaving(false);
  }

  async function loadBulkStudents() {
    if (!bulkGrade) return;
    setBulkLoading(true);
    const students = await searchStudents({ grade: bulkGrade });
    setBulkStudents(students);
    // Pre-cargar valores existentes de este prof+materia+trimestre para este curso
    const vals = {};
    students.forEach(s => {
      const existing = attitudes.find(a => a.studentId===s.id && a.subject===subject && a.trimester===trim && a.teacherId===user.uid);
      vals[s.id] = existing?.value || "";
    });
    setBulkValues(vals);
    setBulkLoading(false);
  }

  async function submitBulk() {
    const toSave = bulkStudents.filter(s => bulkValues[s.id]);
    if (toSave.length===0) { alert("Asigná al menos una actitudinal"); return; }
    setSaving(true);
    const data = toSave.map(s => ({
      teacherId: user.uid, teacherName: profile.name||"",
      studentId: s.id, studentName: s.name, studentGrade: s.grade||"",
      subject, trimester: trim, value: bulkValues[s.id],
      date: new Date().toISOString().split("T")[0], note:"",
    }));
    await saveAttitudesBatch(data);
    // Actualizar caché local
    setAttitudes(prev => {
      let updated = [...prev];
      data.forEach(d => {
        const idx = updated.findIndex(a=>a.studentId===d.studentId&&a.subject===subject&&a.trimester===trim&&a.teacherId===user.uid);
        if (idx!==-1) updated[idx]={...updated[idx],...d};
        else updated=[{id:`${d.studentId}_${subject}_${trim}`, ...d},...updated];
      });
      return updated;
    });
    setSuccess(`✅ ${toSave.length} actitudinales guardadas`);
    setTimeout(()=>setSuccess(""), 2500);
    setSaving(false);
  }

  // Mis actitudinales filtradas
  const myAttitudes = attitudes.filter(a=>a.subject===subject&&a.trimester===trim);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Actitudinales · <span style={{ color:"#065f46" }}>{subject}</span></h2>
        <div style={{ display:"flex", gap:"8px" }}>
          {[["individual","👤 Individual"],["bulk","👥 Masiva por curso"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)} style={{ padding:"8px 16px", borderRadius:"20px", border:`2px solid ${mode===m?"#1e3a5f":"#e2e8f0"}`, background:mode===m?"#1e3a5f":"white", color:mode===m?"white":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Selector de trimestre */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        {trimNames.map((n,i)=>(
          <button key={i} onClick={()=>setTrim(i+1)} style={{ padding:"7px 16px", borderRadius:"20px", background:trim===i+1?"#1e3a5f":"white", color:trim===i+1?"white":"#64748b", border:`1px solid ${trim===i+1?"#1e3a5f":"#e2e8f0"}`, cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{n}</button>
        ))}
      </div>

      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>{success}</div>}

      {/* Leyenda de valores */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        {ATTITUDE_VALUES.map(v=>(
          <div key={v} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 14px", borderRadius:"20px", background:`${ATTITUDE_COLORS[v]}15`, border:`1px solid ${ATTITUDE_COLORS[v]}` }}>
            <span style={{ fontWeight:800, color:ATTITUDE_COLORS[v] }}>{v}</span>
            <span style={{ fontSize:"0.78rem", color:"#475569" }}>{ATTITUDE_LABELS[v]}</span>
          </div>
        ))}
      </div>

      {/* ── INDIVIDUAL ────────────────────────────────────────────── */}
      {mode==="individual" && (
        <div>
          <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
            <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>1. Buscar alumno</h3>
            {selectedStudent ? (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px" }}>
                <div><span style={{ fontWeight:700 }}>{selectedStudent.name}</span><span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span></div>
                <button onClick={()=>{setSelectedStudent(null);setSearchResults([]);}} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
              </div>
            ) : (
              <>
                <div style={{ display:"flex", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
                  <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre..." style={{ flex:1, minWidth:"160px" }} />
                  <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
                    <option value="">Todos</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                  <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
                </div>
                {searchResults.length>0&&<div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"180px", overflowY:"auto" }}>{searchResults.map(s=><div key={s.id} onClick={()=>setSelectedStudent(s)} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}><span style={{ fontWeight:600 }}>{s.name}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span></div>)}</div>}
              </>
            )}
          </div>
          {selectedStudent && (
            <div className="card" style={{ padding:"24px" }}>
              <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>2. Asignar actitudinal</h3>
              <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
                {ATTITUDE_VALUES.map(v=>(
                  <button key={v} onClick={()=>setIndValue(v)} style={{ padding:"12px 24px", borderRadius:"12px", border:`3px solid ${ATTITUDE_COLORS[v]}`, background:indValue===v?ATTITUDE_COLORS[v]:"white", color:indValue===v?"white":ATTITUDE_COLORS[v], cursor:"pointer", fontWeight:800, fontSize:"1rem", transition:"all 0.2s" }}>
                    {v} <span style={{ fontSize:"0.72rem", fontWeight:400, display:"block" }}>{ATTITUDE_LABELS[v]}</span>
                  </button>
                ))}
              </div>
              <label>Nota (opcional)</label>
              <input value={indNote} onChange={e=>setIndNote(e.target.value)} placeholder="Observación sobre la actitud..." style={{ marginTop:"4px", marginBottom:"16px" }} />
              <button className="btn-primary" onClick={submitIndividual} style={{ padding:"12px 32px", fontSize:"1rem" }}>Guardar actitudinal →</button>
            </div>
          )}
        </div>
      )}

      {/* ── MASIVA ────────────────────────────────────────────────── */}
      {mode==="bulk" && (
        <div>
          <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
            <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>Seleccionar curso</h3>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} style={{ flex:1 }}>
                <option value="">Seleccionar año...</option>
                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn-primary" onClick={loadBulkStudents} disabled={!bulkGrade||bulkLoading}>{bulkLoading?"Cargando...":"Cargar alumnos"}</button>
            </div>
          </div>

          {bulkStudents.length>0 && (
            <div className="card" style={{ padding:"24px" }}>
              <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Asignar actitudinal — {bulkGrade} ({trimNames[trim-1]})</h3>
              <p style={{ fontSize:"0.82rem", color:"#64748b", margin:"0 0 16px" }}>Hacé clic en el valor para cada alumno. Los ya guardados aparecen preseleccionados.</p>

              {bulkStudents.map(s => (
                <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"12px", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <span style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</span>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {ATTITUDE_VALUES.map(v=>(
                      <button key={v} onClick={()=>setBulkValues(prev=>({...prev,[s.id]:v}))} style={{ padding:"6px 12px", borderRadius:"10px", border:`2px solid ${ATTITUDE_COLORS[v]}`, background:bulkValues[s.id]===v?ATTITUDE_COLORS[v]:"white", color:bulkValues[s.id]===v?"white":ATTITUDE_COLORS[v], cursor:"pointer", fontWeight:700, fontSize:"0.82rem", minWidth:"42px", textAlign:"center" }}>
                        {v}
                      </button>
                    ))}
                    {bulkValues[s.id] && (
                      <button onClick={()=>setBulkValues(prev=>({...prev,[s.id]:""}))} style={{ padding:"6px 10px", borderRadius:"10px", border:"1px solid #e2e8f0", background:"white", color:"#94a3b8", cursor:"pointer", fontSize:"0.78rem" }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ marginTop:"20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"0.85rem", color:"#64748b" }}>{Object.values(bulkValues).filter(v=>v!=="").length} de {bulkStudents.length} asignadas</span>
                <button className="btn-primary" onClick={submitBulk} style={{ padding:"12px 32px", fontSize:"1rem" }}>Guardar actitudinales →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MIS ACTITUDINALES CARGADAS ─────────────────────────── */}
      {myAttitudes.length>0 && (
        <div style={{ marginTop:"32px" }}>
          <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 12px" }}>Mis actitudinales cargadas — {trimNames[trim-1]}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"12px" }}>
            {myAttitudes.map(a=>(
              <div key={a.id} className="card" style={{ padding:"16px", borderTop:`4px solid ${ATTITUDE_COLORS[a.value]||"#e2e8f0"}` }}>
                <div style={{ fontWeight:700, color:"#1e293b", marginBottom:"4px" }}>{a.studentName}</div>
                <span className="badge" style={{ background:`${ATTITUDE_COLORS[a.value]}20`, color:ATTITUDE_COLORS[a.value], border:`1px solid ${ATTITUDE_COLORS[a.value]}` }}>{a.value} — {ATTITUDE_LABELS[a.value]}</span>
                {a.note && <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:"6px" }}>{a.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES
// Recibe `loaded` para mostrar spinner mientras carga la primera vez
// ═══════════════════════════════════════════════════════════════════
function ObservationsTab({ user, profile, observations, setObservations, setSaving, loaded }) {
  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState(""); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false); const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ text:"", date:new Date().toISOString().split("T")[0] });
  const [success, setSuccess] = useState(false); const [nameFilter, setNameFilter] = useState("");

  // Spinner mientras carga por primera vez
  if (!loaded) {
    return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando observaciones...</div>;
  }

  async function doSearch() { if (!nameQ&&!gradeQ) return; setSearching(true); const r=await searchStudents({name:nameQ,grade:gradeQ}); setSearchResults(r); setSearching(false); }
  async function submit() {
    if (!selectedStudent||!form.text.trim()) return;
    setSaving(true);
    const data = { studentId:selectedStudent.id, studentName:selectedStudent.name, studentGrade:selectedStudent.grade||"", teacherId:user.uid, teacherName:profile.name||"", subjects, text:form.text.trim(), date:form.date };
    const id = await createObservation(data);
    setObservations(prev=>[{id,...data},...prev]);
    setForm({text:"",date:form.date}); setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    setSuccess(true); setTimeout(()=>setSuccess(false), 2500); setSaving(false);
  }
  async function removeObs(id) { setSaving(true); await deleteObservation(id); setObservations(prev=>prev.filter(o=>o.id!==id)); setSaving(false); }
  const filtered = observations.filter(o=>!nameFilter||(o.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Observaciones</h2>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ Observación guardada</div>}
      <div className="card" style={{ padding:"24px", marginBottom:"24px", border:"2px solid #e0e7ff" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Nueva observación</h3>
        {selectedStudent ? (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px", marginBottom:"16px" }}>
            <div><span style={{ fontWeight:700 }}>{selectedStudent.name}</span><span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span></div>
            <button onClick={()=>{setSelectedStudent(null);setSearchResults([]);}} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
          </div>
        ) : (
          <div style={{ marginBottom:"16px" }}>
            <div style={{ display:"flex", gap:"10px", marginBottom:"8px", flexWrap:"wrap" }}>
              <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre..." style={{ flex:1 }} />
              <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
                <option value="">Todos</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
            </div>
            {searchResults.length>0&&<div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"160px", overflowY:"auto" }}>{searchResults.map(s=><div key={s.id} onClick={()=>{setSelectedStudent(s);setSearchResults([]);}} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}><span style={{ fontWeight:600 }}>{s.name}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span></div>)}</div>}
          </div>
        )}
        {selectedStudent && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"16px", marginBottom:"16px" }}>
              <div><label>Observación</label><textarea value={form.text} onChange={e=>setForm({...form,text:e.target.value})} placeholder="Ej: El alumno no trabajó durante la clase..." rows={3} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical" }} /></div>
              <div><label>Fecha</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{ width:"160px" }} /></div>
            </div>
            <button className="btn-primary" onClick={submit}>Guardar observación →</button>
          </>
        )}
      </div>
      <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 12px" }}>Mis observaciones ({filtered.length})</h3>
      <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por nombre..." style={{ width:"100%", marginBottom:"16px" }} />
      {filtered.length===0 ? <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}><div style={{ fontSize:"3rem" }}>💬</div><p>No hay observaciones aún</p></div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {filtered.map(o=>(
            <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                <div><span style={{ fontWeight:700 }}>{o.studentName}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"8px" }}>{o.studentGrade}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}><span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{o.date}</span><button className="btn-danger" onClick={()=>removeObs(o.id)}>Eliminar</button></div>
              </div>
              <p style={{ margin:0, color:"#475569", fontSize:"0.9rem", lineHeight:1.5 }}>{o.text}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:"32px", paddingTop:"32px", borderTop:"1px solid #e2e8f0" }}>
        <CourseObservationsTab user={user} profile={profile} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PRÓXIMAS EVALUACIONES
// ═══════════════════════════════════════════════════════════════════
function UpcomingTab({ user, profile, subject, setSaving }) {
  const [vigentes, setVigentes] = useState([]); const [pasadas, setPasadas] = useState([]);
  const [loadedVigentes, setLoadedVigentes] = useState(false); const [loadedPasadas, setLoadedPasadas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", type:"Examen", grade:"", dateStart:new Date().toISOString().split("T")[0], dateEnd:"", trimester:1, description:"" });
  const [loading, setLoading] = useState(false);
  useEffect(() => { loadVigentes(); }, []);
  async function loadVigentes() { setLoading(true); const r=await getUpcomingByTeacher(user.uid); setVigentes(r); setLoadedVigentes(true); setLoading(false); }
  async function loadPasadas() { const r=await getUpcomingPastByTeacher(user.uid); setPasadas(r); setLoadedPasadas(true); }
  async function saveUpcoming() {
    if (!form.title||!form.dateEnd||!form.grade) { alert("Completá título, año y fecha de fin"); return; }
    setSaving(true);
    const data={...form, teacherId:user.uid, teacherName:profile.name||"", subject};
    const id=await createUpcoming(data);
    setVigentes(prev=>[...prev,{id,...data}]);
    setForm({title:"",type:"Examen",grade:"",dateStart:new Date().toISOString().split("T")[0],dateEnd:"",trimester:1,description:""});
    setShowForm(false); setSaving(false);
  }
  async function removeUpcoming(id) { setSaving(true); await deleteUpcoming(id,user.uid); setVigentes(prev=>prev.filter(u=>u.id!==id)); setSaving(false); }
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Próximas evaluaciones</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Publicar evaluación"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
            <div><label>Título</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej: Parcial Unidad 3" /></div>
            <div><label>Tipo</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{["Examen","Trabajo Práctico","Exposición","Proyecto","Parcial","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label>Año/Curso</label><select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option value="">Seleccionar...</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
            <div><label>Trimestre</label><select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>{trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>
            <div><label>Fecha inicio</label><input type="date" value={form.dateStart} onChange={e=>setForm({...form,dateStart:e.target.value})} /></div>
            <div><label>Fecha límite</label><input type="date" value={form.dateEnd} onChange={e=>setForm({...form,dateEnd:e.target.value})} /></div>
            <div style={{ gridColumn:"1/-1" }}><label>Descripción (opcional)</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit" }} /></div>
          </div>
          <button className="btn-primary" onClick={saveUpcoming} style={{ marginTop:"16px" }}>Publicar evaluación</button>
        </div>
      )}
      {loading?<div style={{ textAlign:"center",padding:"40px",color:"#94a3b8" }}>Cargando...</div>:(
        <>
          {vigentes.length===0?<div className="card" style={{ padding:"32px",textAlign:"center",color:"#94a3b8" }}><p>No hay evaluaciones vigentes publicadas</p></div>:(
            <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
              {vigentes.map(u=>(
                <div key={u.id} className="card" style={{ padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700,color:"#1e293b" }}>{u.title}</div>
                    <div style={{ fontSize:"0.82rem",color:"#64748b" }}>{u.subject} · {u.grade} · {trimNames[u.trimester-1]}</div>
                    <div style={{ fontSize:"0.78rem",color:"#94a3b8",marginTop:"2px" }}>hasta {u.dateEnd}</div>
                  </div>
                  <button className="btn-danger" onClick={()=>removeUpcoming(u.id)}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:"20px",textAlign:"center" }}>
            {!loadedPasadas?<button onClick={loadPasadas} style={{ background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:"0.85rem",textDecoration:"underline" }}>Ver evaluaciones pasadas</button>:(
              pasadas.length>0&&<div style={{ display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px" }}>{pasadas.map(u=><div key={u.id} className="card" style={{ padding:"12px 16px",opacity:0.6,fontSize:"0.85rem" }}><span style={{ fontWeight:600 }}>{u.title}</span> · {u.grade} · hasta {u.dateEnd}</div>)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RENDIMIENTO
// ═══════════════════════════════════════════════════════════════════
function Ranking({ grades, subject }) {
  const [nameFilter, setNameFilter] = useState(""); const [gradeFilter, setGradeFilter] = useState("");
  const subjectGrades = grades.filter(g=>g.subject===subject);
  const studentMap = {};
  subjectGrades.forEach(g=>{
    if (!studentMap[g.studentId]) studentMap[g.studentId]={id:g.studentId,name:g.studentName||"–",grade:g.studentGrade||"",scores:[]};
    studentMap[g.studentId].scores.push(g.score);
  });
  let students = Object.values(studentMap);
  if (nameFilter) students=students.filter(s=>s.name.toLowerCase().includes(nameFilter.toLowerCase()));
  if (gradeFilter) students=students.filter(s=>s.grade===gradeFilter);
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 16px" }}>Rendimiento — {subject}</h2>
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Buscar alumno..." style={{ flex:1, minWidth:"160px" }} />
        <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{ width:"120px" }}><option value="">Todos los años</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select>
      </div>
      {students.length===0?<div className="card" style={{ padding:"48px",textAlign:"center",color:"#94a3b8" }}><p>No hay evaluaciones para esta materia aún</p></div>:(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"16px" }}>
          {students.map(s=>{
            const sa=avg(s.scores); const color=sa==="–"?"#e2e8f0":scoreColor(parseFloat(sa));
            return (
              <div key={s.id} className="card" style={{ padding:"20px", borderTop:`3px solid ${color}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div><div style={{ fontWeight:700,color:"#1e293b" }}>{s.name}</div>{s.grade&&<span className="badge" style={{ background:"#dbeafe",color:"#1e40af",marginTop:"4px" }}>{s.grade}</span>}</div>
                  <div style={{ textAlign:"right" }}><div style={{ fontSize:"1.8rem",fontWeight:800,color,fontFamily:"'Playfair Display',serif" }}>{sa}</div><div style={{ fontSize:"0.72rem",color:"#94a3b8" }}>{s.scores.length} eval.</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// VER ALUMNO — vista individual + tabla masiva por curso
// ═══════════════════════════════════════════════════════════════════
function StudentGradesTab({ user, subject, setSaving }) {
  const [mode, setMode] = useState("bulk"); // "bulk" | "individual"
  const [allTeacherGrades, setAllTeacherGrades] = useState(null); // null = no cargado aún
  const [loadingAll, setLoadingAll] = useState(false);

  // ── Modo individual ──
  const [nameQ, setNameQ] = useState("");
  const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Cargar TODAS las notas del profe una sola vez (se reutiliza en ambos modos)
  async function ensureTeacherGrades() {
    if (allTeacherGrades !== null) return allTeacherGrades;
    setLoadingAll(true);
    const g = await getAllGradesByTeacher(user.uid);
    setAllTeacherGrades(g);
    setLoadingAll(false);
    return g;
  }

  // Al cambiar de modo, asegurar que las notas estén cargadas
  async function handleModeChange(m) {
    setMode(m);
    if (m === "bulk") ensureTeacherGrades();
  }

  async function removeGrade(id) {
    if (!confirm("¿Eliminar esta evaluación?")) return;
    setSaving(true);
    await deleteGrade(id);
    setAllTeacherGrades(prev => prev ? prev.filter(g => g.id !== id) : null);
    setSaving(false);
  }

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setSearching(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setSearchResults(r);
    setSearching(false);
  }

  async function selectStudent(s) {
    setSelectedStudent(s);
    setSearchResults([]);
    setLoadingGrades(true);
    await ensureTeacherGrades();
    setLoadingGrades(false);
  }

  function clearStudent() {
    setSelectedStudent(null);
    setNameQ("");
    setGradeQ("");
    setSearchResults([]);
  }

  // Notas del alumno seleccionado en la materia activa
  const myGrades = allTeacherGrades
    ? allTeacherGrades.filter(g => g.studentId === selectedStudent?.id && g.subject === subject)
    : [];

  // Agrupar por trimestre (individual)
  const byTrim = { 1: [], 2: [], 3: [] };
  myGrades.forEach(g => { if (byTrim[g.trimester]) byTrim[g.trimester].push(g); });

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>
          Ver notas · <span style={{ color:"#065f46" }}>{subject}</span>
        </h2>
        <div style={{ display:"flex", gap:"8px" }}>
          {[["bulk","👥 Por curso"],["individual","👤 Individual"]].map(([m,l]) => (
            <button key={m} onClick={() => handleModeChange(m)} style={{ padding:"8px 16px", borderRadius:"20px", border:`2px solid ${mode===m?"#1e3a5f":"#e2e8f0"}`, background:mode===m?"#1e3a5f":"white", color:mode===m?"white":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
          ))}
        </div>
      </div>
      <p style={{ color:"#64748b", fontSize:"0.88rem", margin:"0 0 20px" }}>
        {mode==="bulk" ? "Promedio de todos los alumnos por trimestre en tu materia." : "Buscá un alumno para ver el detalle y eliminar evaluaciones."}
      </p>

      {/* ══ MODO MASIVO: tabla por curso ════════════════════════════ */}
      {mode === "bulk" && (
        <BulkAveragesView
          user={user}
          subject={subject}
          allTeacherGrades={allTeacherGrades}
          loadingAll={loadingAll}
          ensureTeacherGrades={ensureTeacherGrades}
          onSelectStudent={(s) => { handleModeChange("individual"); selectStudent(s); }}
        />
      )}

      {/* ══ MODO INDIVIDUAL: detalle de un alumno ═══════════════════ */}
      {mode === "individual" && (
        <>
          {!selectedStudent ? (
            <div className="card" style={{ padding:"24px" }}>
              <div style={{ display:"flex", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
                <input
                  value={nameQ}
                  onChange={e => setNameQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch()}
                  placeholder="🔍 Nombre del alumno..."
                  style={{ flex:1, minWidth:"160px" }}
                />
                <select value={gradeQ} onChange={e => setGradeQ(e.target.value)} style={{ width:"120px" }}>
                  <option value="">Todos los años</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button className="btn-primary" onClick={doSearch} disabled={searching}>
                  {searching ? "Buscando..." : "Buscar"}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"240px", overflowY:"auto" }}>
                  {searchResults.map(s => (
                    <div key={s.id} onClick={() => selectStudent(s)} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</span>
                      <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && nameQ && !searching && (
                <p style={{ color:"#94a3b8", fontSize:"0.85rem", margin:"8px 0 0" }}>Sin resultados.</p>
              )}
            </div>
          ) : (
            <div>
              {/* Header alumno */}
              <div className="card" style={{ padding:"16px 24px", marginBottom:"20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#1e293b", fontSize:"1.05rem" }}>{selectedStudent.name}</div>
                  <div style={{ display:"flex", gap:"8px", marginTop:"4px", flexWrap:"wrap" }}>
                    <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{selectedStudent.grade}</span>
                    <span className="badge" style={{ background:"#d1fae5", color:"#065f46" }}>{subject}</span>
                  </div>
                </div>
                <button onClick={clearStudent} style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#64748b", fontSize:"0.85rem" }}>
                  ← Buscar otro
                </button>
              </div>

              {loadingGrades ? (
                <div style={{ textAlign:"center", padding:"48px", color:"#94a3b8" }}>Cargando notas...</div>
              ) : myGrades.length === 0 ? (
                <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                  <div style={{ fontSize:"3rem", marginBottom:"8px" }}>📭</div>
                  <p>Todavía no cargaste ninguna nota para <strong>{selectedStudent.name}</strong> en {subject}.</p>
                </div>
              ) : (
                <>
                  {/* Resumen global */}
                  <div className="card" style={{ padding:"16px 24px", marginBottom:"20px", display:"flex", gap:"24px", flexWrap:"wrap", alignItems:"center" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"2rem", fontWeight:800, color: avg(myGrades.map(g=>g.score))==="–"?"#94a3b8":scoreColor(parseFloat(avg(myGrades.map(g=>g.score)))), fontFamily:"'Playfair Display',serif" }}>
                        {avg(myGrades.map(g => g.score))}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Promedio general</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"2rem", fontWeight:800, color:"#1e3a5f", fontFamily:"'Playfair Display',serif" }}>{myGrades.length}</div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Evaluaciones</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"2rem", fontWeight:800, color:"#7c3aed", fontFamily:"'Playfair Display',serif" }}>
                        {Math.min(...myGrades.map(g => g.score))}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Nota mínima</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"2rem", fontWeight:800, color:"#065f46", fontFamily:"'Playfair Display',serif" }}>
                        {Math.max(...myGrades.map(g => g.score))}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Nota máxima</div>
                    </div>
                  </div>

                  {/* Notas por trimestre */}
                  {[1, 2, 3].map(t => {
                    const tGrades = byTrim[t];
                    if (tGrades.length === 0) return null;
                    const tAvg = avg(tGrades.map(g => g.score));
                    const tAvgNum = parseFloat(tAvg);
                    return (
                      <div key={t} style={{ marginBottom:"20px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                          <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0, fontSize:"1.05rem" }}>{trimNames[t-1]}</h3>
                          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                            <span style={{ fontSize:"0.78rem", color:"#64748b" }}>{tGrades.length} eval.</span>
                            <span style={{ fontWeight:800, fontSize:"1.2rem", color: tAvg==="–"?"#94a3b8":scoreColor(tAvgNum), fontFamily:"'Playfair Display',serif" }}>{tAvg}</span>
                            <span style={{ fontSize:"0.72rem", color:"#94a3b8" }}>prom.</span>
                          </div>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                          {tGrades.map(g => (
                            <div key={g.id} className="card" style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:"14px", borderLeft:`4px solid ${scoreColor(g.score)}` }}>
                              <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"1rem", flexShrink:0 }}>
                                {g.score}
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:600, color:"#1e293b", fontSize:"0.9rem" }}>{g.type}</div>
                                <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:"2px" }}>{g.date}</div>
                                {g.note && <div style={{ fontSize:"0.78rem", color:"#7c3aed", marginTop:"4px" }}>💬 {g.note}</div>}
                              </div>
                              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px", flexShrink:0 }}>
                                <div style={{ textAlign:"right" }}>
                                  <span style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>nota</span>
                                  <div style={{ fontSize:"1.4rem", fontWeight:800, color:scoreColor(g.score), fontFamily:"'Playfair Display',serif", lineHeight:1 }}>
                                    {g.score}<span style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:400 }}>/10</span>
                                  </div>
                                </div>
                                <button className="btn-danger" onClick={() => removeGrade(g.id)}>Eliminar</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VISTA MASIVA — tabla de promedios por curso
// ═══════════════════════════════════════════════════════════════════
function BulkAveragesView({ user, subject, allTeacherGrades, loadingAll, ensureTeacherGrades, onSelectStudent }) {
  const [selectedGrade, setSelectedGrade] = useState(GRADES[0]);
  const [courseStudents, setCourseStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Cargar alumnos del curso seleccionado y las notas del profe
  useEffect(() => {
    loadCourse();
  }, [selectedGrade]);

  async function loadCourse() {
    setLoadingStudents(true);
    setLoaded(false);
    await ensureTeacherGrades();
    const students = await searchStudents({ grade: selectedGrade });
    setCourseStudents(students.sort((a,b) => a.name.localeCompare(b.name)));
    setLoadingStudents(false);
    setLoaded(true);
  }

  // Calcular promedio de un alumno en un trimestre
  function trimAvg(studentId, trim) {
    if (!allTeacherGrades) return "–";
    const gs = allTeacherGrades.filter(
      g => g.studentId === studentId && g.subject === subject && g.trimester === trim
    );
    return gs.length > 0 ? avg(gs.map(g => g.score)) : "–";
  }

  function generalAvg(studentId) {
    if (!allTeacherGrades) return "–";
    const gs = allTeacherGrades.filter(
      g => g.studentId === studentId && g.subject === subject
    );
    return gs.length > 0 ? avg(gs.map(g => g.score)) : "–";
  }

  const isLoading = loadingAll || loadingStudents;

  return (
    <div>
      {/* Selector de curso */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
        {GRADES.map(g => (
          <button key={g} onClick={() => setSelectedGrade(g)} style={{ padding:"8px 20px", borderRadius:"20px", border:`2px solid ${selectedGrade===g?"#1e3a5f":"#e2e8f0"}`, background:selectedGrade===g?"#1e3a5f":"white", color:selectedGrade===g?"white":"#64748b", cursor:"pointer", fontWeight:700, fontSize:"0.88rem" }}>
            {g}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign:"center", padding:"48px", color:"#94a3b8" }}>Cargando...</div>
      ) : courseStudents.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem" }}>📭</div>
          <p>No hay alumnos en {selectedGrade}</p>
        </div>
      ) : (
        <div className="card" style={{ overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"520px" }}>
            <thead>
              <tr style={{ background:"#1e3a5f", color:"white" }}>
                <th style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, fontSize:"0.85rem" }}>Alumno</th>
                {trimNames.map((n,i) => (
                  <th key={i} style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>{n}</th>
                ))}
                <th style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>Prom. Anual</th>
                <th style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {courseStudents.map((s, idx) => {
                const t1 = trimAvg(s.id, 1);
                const t2 = trimAvg(s.id, 2);
                const t3 = trimAvg(s.id, 3);
                const ga = generalAvg(s.id);
                const gaNum = parseFloat(ga);
                return (
                  <tr key={s.id} style={{ borderBottom:"1px solid #f1f5f9", background: idx%2===0?"white":"#f8fafc" }}>
                    <td style={{ padding:"12px 16px", fontWeight:600, color:"#1e293b" }}>{s.name}</td>
                    {[t1,t2,t3].map((v,i) => {
                      const vNum = parseFloat(v);
                      return (
                        <td key={i} style={{ padding:"12px 16px", textAlign:"center" }}>
                          <span style={{ fontWeight:700, color: v==="–"?"#cbd5e1":scoreColor(vNum), fontSize:"1rem" }}>{v}</span>
                        </td>
                      );
                    })}
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <span style={{ fontWeight:800, fontSize:"1.1rem", color: ga==="–"?"#cbd5e1":scoreColor(gaNum), fontFamily:"'Playfair Display',serif" }}>{ga}</span>
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <button onClick={() => onSelectStudent(s)} style={{ padding:"5px 14px", borderRadius:"20px", background:"#dbeafe", color:"#1e40af", border:"none", cursor:"pointer", fontSize:"0.8rem", fontWeight:600 }}>
                        Ver →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Promedio del curso */}
      {loaded && courseStudents.length > 0 && allTeacherGrades && (
        <div style={{ marginTop:"16px", display:"flex", gap:"16px", flexWrap:"wrap" }}>
          {[1,2,3].map(t => {
            const allScores = courseStudents
              .map(s => {
                const gs = allTeacherGrades.filter(g => g.studentId===s.id && g.subject===subject && g.trimester===t);
                return gs.length > 0 ? parseFloat(avg(gs.map(g=>g.score))) : null;
              })
              .filter(v => v !== null);
            const courseAvg = allScores.length > 0 ? avg(allScores) : "–";
            const courseAvgNum = parseFloat(courseAvg);
            return (
              <div key={t} className="card" style={{ padding:"14px 20px", flex:1, minWidth:"140px", textAlign:"center", borderTop:`3px solid ${courseAvg==="–"?"#e2e8f0":scoreColor(courseAvgNum)}` }}>
                <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", marginBottom:"4px" }}>{trimNames[t-1]}</div>
                <div style={{ fontSize:"1.6rem", fontWeight:800, color: courseAvg==="–"?"#cbd5e1":scoreColor(courseAvgNum), fontFamily:"'Playfair Display',serif" }}>{courseAvg}</div>
                <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>prom. del curso</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
