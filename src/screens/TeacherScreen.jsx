import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import {
  searchStudents, getStudentsByGrade,
  getGradesByTeacherPaged, getMoreGradesByTeacher, getGradesByStudent,
  createGrade, createGradesBatch, deleteGrade,
  getObservationsByTeacher, createObservation, deleteObservation,
  getUpcomingByTeacher, getUpcomingPastByTeacher, createUpcoming, deleteUpcoming, updateUpcoming,
  getGradeTypes, addGradeType
} from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];
const UPCOMING_TYPES = ["Examen","Recuperatorio","Trabajo Práctico","Exposición","Proyecto","Parcial","Cuestionario","Otro"];
const typeColors = { "Examen":"#dc2626","Recuperatorio":"#ea580c","Trabajo Práctico":"#7c3aed","Exposición":"#0369a1","Proyecto":"#065f46","Parcial":"#9f1239","Cuestionario":"#1d4ed8","Otro":"#475569" };

export default function TeacherScreen({ user, profile, logout }) {
  const [tab, setTab] = useState("add");
  const [saving, setSaving] = useState(false);
  const [gradeTypes, setGradeTypes] = useState([]);
  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] || "");

  useEffect(() => {
    getGradeTypes(user.uid).then(setGradeTypes);
  }, []);

  async function handleAddType(newType) {
    const updated = await addGradeType(user.uid, newType);
    if (updated) setGradeTypes(updated);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={saving} logout={logout} subtitle={`Profesor · ${subjects.join(", ")}`} />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {subjects.length > 1 && (
          <div style={{ marginBottom:"20px", display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>Materia activa:</span>
            {subjects.map(s => (
              <button key={s} onClick={()=>setSelectedSubject(s)} style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${selectedSubject===s?"#065f46":"#e2e8f0"}`, background:selectedSubject===s?"#d1fae5":"white", color:selectedSubject===s?"#065f46":"#64748b", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"28px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
          {[["add","📝 Cargar notas"],["mygrades","📋 Mis evaluaciones"],["upcoming","📅 Próximas eval."],["student","👤 Ver alumno"],["observations","💬 Observaciones"],["ranking","📊 Rendimiento"]].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        <div className="fade" key={tab}>
          {tab==="add"          && <AddGrade user={user} profile={profile} subject={selectedSubject} gradeTypes={gradeTypes} onAddType={handleAddType} setSaving={setSaving} />}
          {tab==="mygrades"     && <MyGrades user={user} setSaving={setSaving} />}
          {tab==="upcoming"     && <UpcomingTab user={user} profile={profile} subject={selectedSubject} setSaving={setSaving} />}
          {tab==="student"      && <StudentView />}
          {tab==="observations" && <ObservationsTab user={user} profile={profile} setSaving={setSaving} />}
          {tab==="ranking"      && <Ranking user={user} subject={selectedSubject} />}
        </div>
      </div>
    </div>
  );
}

// ─── Selector de tipo con opción de agregar ───────────────────────
function TypeSelector({ value, onChange, types, onAddType }) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");

  async function confirmAdd() {
    if (!newType.trim()) return;
    await onAddType(newType.trim());
    onChange(newType.trim());
    setNewType(""); setAdding(false);
  }

  return (
    <div>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"6px" }}>
        {types.map(t => (
          <button key={t} onClick={()=>onChange(t)} style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${value===t?"#1e3a5f":"#e2e8f0"}`, background:value===t?"#1e3a5f":"white", color:value===t?"white":"#475569", cursor:"pointer", fontSize:"0.82rem", fontWeight:600, transition:"all 0.15s" }}>
            {t}
          </button>
        ))}
        <button onClick={()=>setAdding(!adding)} style={{ padding:"6px 14px", borderRadius:"20px", border:"2px dashed #cbd5e1", background:"white", color:"#94a3b8", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>
          {adding?"✕ Cancelar":"+ Nuevo tipo"}
        </button>
      </div>
      {adding && (
        <div className="fade" style={{ display:"flex", gap:"8px", marginTop:"10px", alignItems:"center" }}>
          <input value={newType} onChange={e=>setNewType(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmAdd()} placeholder="Ej: Trabajo de campo..." style={{ flex:1, maxWidth:"280px" }} autoFocus />
          <button className="btn-primary" onClick={confirmAdd} style={{ padding:"8px 16px", fontSize:"0.85rem" }}>Guardar tipo</button>
        </div>
      )}
    </div>
  );
}

// ─── Cargar notas (individual o masiva por curso) ─────────────────
function AddGrade({ user, profile, subject, gradeTypes, onAddType, setSaving }) {
  const [mode, setMode] = useState("bulk"); // "bulk" = por curso | "single" = individual
  const [selectedType, setSelectedType] = useState(gradeTypes[0] || "Examen");
  const [trimester, setTrimester] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState("");

  // Modo masivo
  const [selectedGrade, setSelectedGrade] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [scores, setScores] = useState({}); // { [studentId]: score }

  // Modo individual
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [singleScore, setSingleScore] = useState("");

  async function loadStudentsByGrade(grade) {
    setSelectedGrade(grade); setStudents([]); setScores({});
    if (!grade) return;
    setLoadingStudents(true);
    const list = await getStudentsByGrade(grade);
    setStudents(list);
    setLoadingStudents(false);
  }

  async function submitBulk() {
    const toSave = students.filter(s => scores[s.id] !== undefined && scores[s.id] !== "");
    if (toSave.length === 0) { alert("Ingresá al menos una nota"); return; }
    const invalid = toSave.find(s => { const v = parseFloat(scores[s.id]); return isNaN(v) || v < 1 || v > 10; });
    if (invalid) { alert(`La nota de ${invalid.name} debe estar entre 1 y 10`); return; }
    setSaving(true);
    const gradesData = toSave.map(s => ({
      score: parseFloat(scores[s.id]),
      type: selectedType,
      trimester,
      date,
      note,
      teacherId: user.uid,
      teacherName: profile.name || "",
      subject,
      studentId: s.id,
      studentName: s.name,
      studentGrade: s.grade || "",
    }));
    await createGradesBatch(gradesData);
    setScores({}); setNote("");
    setSuccess(`✅ ${toSave.length} nota(s) guardada(s) correctamente`);
    setTimeout(()=>setSuccess(""), 3000);
    setSaving(false);
  }

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setSearching(true);
    const r = await searchStudents({ name:nameQ, grade:gradeQ });
    setSearchResults(r); setSearching(false);
  }

  async function submitSingle() {
    if (!selectedStudent || !singleScore) return;
    const score = parseFloat(singleScore);
    if (score < 1 || score > 10) { alert("La nota debe estar entre 1 y 10"); return; }
    setSaving(true);
    await createGrade({ score, type:selectedType, trimester, date, note, teacherId:user.uid, teacherName:profile.name||"", subject, studentId:selectedStudent.id, studentName:selectedStudent.name, studentGrade:selectedStudent.grade||"" });
    setSingleScore(""); setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ(""); setNote("");
    setSuccess("✅ Nota guardada correctamente");
    setTimeout(()=>setSuccess(""), 2500);
    setSaving(false);
  }

  // Sincronizar tipo seleccionado cuando cargan los tipos
  useEffect(() => { if (gradeTypes.length > 0 && !gradeTypes.includes(selectedType)) setSelectedType(gradeTypes[0]); }, [gradeTypes]);

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 8px" }}>Cargar evaluaciones</h2>
      <p style={{ color:"#64748b", marginBottom:"20px", fontSize:"0.9rem" }}>Materia: <strong>{subject}</strong></p>
      {success && <div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>{success}</div>}

      {/* Selector de modo */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        <button onClick={()=>setMode("bulk")} style={{ flex:1, padding:"12px", borderRadius:"12px", border:`2px solid ${mode==="bulk"?"#1e3a5f":"#e2e8f0"}`, background:mode==="bulk"?"#1e3a5f":"white", color:mode==="bulk"?"white":"#64748b", cursor:"pointer", fontWeight:700, fontSize:"0.9rem" }}>
          📋 Por curso (masivo)
        </button>
        <button onClick={()=>setMode("single")} style={{ flex:1, padding:"12px", borderRadius:"12px", border:`2px solid ${mode==="single"?"#1e3a5f":"#e2e8f0"}`, background:mode==="single"?"#1e3a5f":"white", color:mode==="single"?"white":"#64748b", cursor:"pointer", fontWeight:700, fontSize:"0.9rem" }}>
          👤 Individual
        </button>
      </div>

      {/* Configuración común: tipo, trimestre, fecha */}
      <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Configuración de la evaluación</h3>

        <div style={{ marginBottom:"16px" }}>
          <label>Tipo de evaluación</label>
          <TypeSelector value={selectedType} onChange={setSelectedType} types={gradeTypes} onAddType={onAddType} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
          <div>
            <label>Trimestre</label>
            <select value={trimester} onChange={e=>setTrimester(parseInt(e.target.value))}>
              {trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
            </select>
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label>Observación general (opcional)</label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Comentario para tutores..." />
          </div>
        </div>
      </div>

      {/* ── MODO MASIVO ── */}
      {mode === "bulk" && (
        <div className="card" style={{ padding:"24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"12px" }}>
            <h3 style={{ margin:0, color:"#1e3a5f", fontSize:"1rem" }}>Notas por curso</h3>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <label style={{ margin:0, fontSize:"0.85rem", color:"#475569" }}>Año:</label>
              <select value={selectedGrade} onChange={e=>loadStudentsByGrade(e.target.value)} style={{ width:"120px" }}>
                <option value="">Seleccionar...</option>
                {GRADES.map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {!selectedGrade && <p style={{ color:"#94a3b8", textAlign:"center", padding:"24px 0", margin:0 }}>Seleccioná un año para ver la lista de alumnos</p>}
          {loadingStudents && <p style={{ color:"#94a3b8", textAlign:"center", padding:"24px 0", margin:0 }}>Cargando alumnos...</p>}

          {students.length > 0 && (
            <>
              <div style={{ marginBottom:"12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"0.82rem", color:"#64748b" }}>{students.length} alumnos · dejá vacío si el alumno estuvo ausente</span>
                <span style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>{Object.values(scores).filter(v=>v!=="").length} notas ingresadas</span>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"20px" }}>
                {students.map((s, idx) => {
                  const val = scores[s.id] ?? "";
                  const scoreNum = parseFloat(val);
                  const color = val !== "" && !isNaN(scoreNum) ? scoreColor(scoreNum) : "#e2e8f0";
                  return (
                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background: idx%2===0?"#f8fafc":"white", borderRadius:"10px", border:"1px solid #e2e8f0" }}>
                      {/* Círculo de nota */}
                      <div style={{ width:"36px", height:"36px", borderRadius:"50%", background: val!==""&&!isNaN(scoreNum)?color:"#f1f5f9", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}>
                        {val!==""&&!isNaN(scoreNum) && <span style={{ fontWeight:800, fontSize:"0.85rem", color:"white" }}>{scoreNum}</span>}
                      </div>
                      {/* Nombre */}
                      <span style={{ flex:1, fontWeight:600, color:"#1e293b", fontSize:"0.92rem" }}>{s.name}</span>
                      {/* Input nota */}
                      <input
                        type="number" min="1" max="10" step="0.5"
                        value={val}
                        onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="–"
                        style={{ width:"72px", textAlign:"center", border:`2px solid ${val!==""?"#1e3a5f":"#e2e8f0"}`, borderRadius:"8px", padding:"6px 8px", fontSize:"1rem", fontWeight:700, outline:"none", background:"white" }}
                        onFocus={e=>e.target.select()}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <button onClick={()=>setScores({})} style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#64748b", fontSize:"0.85rem" }}>Limpiar todo</button>
                <button className="btn-primary" onClick={submitBulk} style={{ padding:"12px 28px", fontSize:"1rem" }}>
                  Guardar {Object.values(scores).filter(v=>v!=="").length} notas →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODO INDIVIDUAL ── */}
      {mode === "single" && (
        <div className="card" style={{ padding:"24px" }}>
          <h3 style={{ margin:"0 0 12px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar alumno</h3>
          {selectedStudent ? (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px", marginBottom:"16px" }}>
              <div><span style={{ fontWeight:700 }}>{selectedStudent.name}</span><span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span></div>
              <button onClick={()=>{ setSelectedStudent(null); setSearchResults([]); }} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
            </div>
          ) : (
            <div style={{ marginBottom:"16px" }}>
              <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
                <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre del alumno..." style={{ flex:1, minWidth:"160px" }} />
                <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}>
                  <option value="">Todos los años</option>
                  {GRADES.map(g=><option key={g}>{g}</option>)}
                </select>
                <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginTop:"8px", display:"flex", flexDirection:"column", gap:"6px", maxHeight:"200px", overflowY:"auto" }}>
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
            <div>
              <label>Nota (1–10)</label>
              <input type="number" min="1" max="10" step="0.5" value={singleScore} onChange={e=>setSingleScore(e.target.value)} placeholder="Ej: 8" style={{ maxWidth:"120px", marginTop:"4px" }} />
              <button className="btn-primary" onClick={submitSingle} style={{ marginTop:"16px", display:"block", padding:"12px 32px", fontSize:"1rem" }}>Guardar nota →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mis evaluaciones ─────────────────────────────────────────────
function MyGrades({ user, setSaving }) {
  const [grades, setGrades] = useState([]); const [hasMore, setHasMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState(""); const [trim, setTrim] = useState(0);
  async function cargar() { setLoading(true); const { grades:g, hasMore:hm } = await getGradesByTeacherPaged(user.uid); setGrades(g); setHasMore(hm); setLoaded(true); setLoading(false); }
  async function loadMore() { setLoadingMore(true); const { grades:g, hasMore:hm } = await getMoreGradesByTeacher(user.uid); setGrades(g); setHasMore(hm); setLoadingMore(false); }
  async function removeGrade(id) { setSaving(true); await deleteGrade(id); setGrades(prev=>prev.filter(g=>g.id!==id)); setSaving(false); }
  const filtered = grades.filter(g=>trim===0||g.trimester===trim).filter(g=>!nameFilter||(g.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));
  const trimAvgs = [1,2,3].map(t=>{ const tg=grades.filter(g=>g.trimester===t); return { t, avg:avg(tg.map(g=>g.score)), count:tg.length }; });
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Mis evaluaciones</h2>
      {!loaded ? (
        <div className="card" style={{ padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📋</div>
          <p style={{ color:"#64748b", marginBottom:"20px" }}>Presioná para cargar tus evaluaciones</p>
          <button className="btn-primary" onClick={cargar} disabled={loading} style={{ padding:"12px 28px", fontSize:"1rem" }}>{loading?"Cargando...":"🔍 Cargar mis evaluaciones"}</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding:"16px 20px", marginBottom:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px" }}>
              {trimAvgs.map(({ t, avg:ta, count }) => (
                <div key={t} style={{ textAlign:"center", padding:"10px", background:"#f8fafc", borderRadius:"10px", border:`2px solid ${ta==="–"?"#e2e8f0":scoreColor(parseFloat(ta))}` }}>
                  <div style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600, textTransform:"uppercase" }}>{trimNames[t-1]}</div>
                  <div style={{ fontSize:"1.6rem", fontWeight:800, color:ta==="–"?"#94a3b8":scoreColor(parseFloat(ta)), fontFamily:"'Playfair Display',serif" }}>{ta}</div>
                  <div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{count} eval.</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", flexWrap:"wrap", gap:"10px" }}>
            <span style={{ color:"#64748b", fontSize:"0.85rem" }}>{grades.length}{hasMore?"+":""} evaluaciones</span>
            <div style={{ display:"flex", gap:"6px" }}>{[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=><button key={v} onClick={()=>setTrim(v)} style={{ padding:"5px 12px", borderRadius:"20px", background:trim===v?"#1e3a5f":"#f1f5f9", color:trim===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>)}</div>
          </div>
          <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por alumno..." style={{ width:"100%", marginBottom:"16px" }} />
          {filtered.length===0 ? <div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay evaluaciones con ese filtro.</p></div> : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {filtered.map(g => (
                <div key={g.id} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"16px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"1.1rem", flexShrink:0 }}>{g.score}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:"#1e293b" }}>{g.studentName||"–"}{g.studentGrade&&<span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"4px" }}>{g.studentGrade}</span>}</div>
                    <div style={{ fontSize:"0.8rem", color:"#64748b" }}>{g.subject} · {g.type} · {trimNames[g.trimester-1]} · {g.date}</div>
                    {g.note&&<div style={{ fontSize:"0.8rem", color:"#7c3aed", marginTop:"2px" }}>💬 {g.note}</div>}
                  </div>
                  <button className="btn-danger" onClick={()=>removeGrade(g.id)}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
          {hasMore && <div style={{ textAlign:"center", marginTop:"20px" }}><button onClick={loadMore} disabled={loadingMore} style={{ padding:"10px 28px", borderRadius:"10px", border:"2px solid #1e3a5f", background:"white", color:"#1e3a5f", cursor:"pointer", fontWeight:600 }}>{loadingMore?"Cargando...":"⬇ Cargar más"}</button></div>}
        </>
      )}
    </div>
  );
}

// ─── Próximas evaluaciones ────────────────────────────────────────
function UpcomingTab({ user, profile, subject, setSaving }) {
  const [vigentes, setVigentes] = useState([]); const [pasadas, setPasadas] = useState([]);
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false);
  const [loadingPasadas, setLoadingPasadas] = useState(false); const [pasadasLoaded, setPasadasLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false); const [editItem, setEditItem] = useState(null);
  const todayStr = new Date().toISOString().split("T")[0];
  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  const emptyForm = { title:"", type:"Examen", subject, grade:"", trimester:1, dateStart:todayStr, dateEnd:todayStr, description:"" };
  const [form, setForm] = useState(emptyForm);

  async function cargar() { setLoading(true); const data = await getUpcomingByTeacher(user.uid); setVigentes(data); setLoaded(true); setLoading(false); }
  async function cargarPasadas() { if (pasadasLoaded) return; setLoadingPasadas(true); const data = await getUpcomingPastByTeacher(user.uid); setPasadas(data); setPasadasLoaded(true); setLoadingPasadas(false); }

  async function save() {
    if (!form.title || !form.dateEnd) { alert("Completá el título y la fecha de entrega"); return; }
    setSaving(true);
    if (editItem) {
      await updateUpcoming(editItem.id, user.uid, form);
      const updated = { ...editItem, ...form };
      if (updated.dateEnd >= todayStr) { setVigentes(prev=>prev.map(x=>x.id===editItem.id?updated:x).sort((a,b)=>a.dateEnd.localeCompare(b.dateEnd))); setPasadas(prev=>prev.filter(x=>x.id!==editItem.id)); }
      else { setVigentes(prev=>prev.filter(x=>x.id!==editItem.id)); setPasadas(prev=>prev.map(x=>x.id===editItem.id?updated:x)); }
      setEditItem(null);
    } else {
      const data = { ...form, teacherId:user.uid, teacherName:profile.name||"", subject:form.subject||subject };
      const id = await createUpcoming(data);
      const newItem = { id, ...data };
      if (newItem.dateEnd >= todayStr) setVigentes(prev=>[...prev,newItem].sort((a,b)=>a.dateEnd.localeCompare(b.dateEnd)));
    }
    setForm(emptyForm); setShowForm(false); setSaving(false);
  }

  async function remove(id, isPast) {
    if (!confirm("¿Eliminar?")) return;
    setSaving(true);
    await deleteUpcoming(id, user.uid);
    if (isPast) setPasadas(prev=>prev.filter(x=>x.id!==id));
    else setVigentes(prev=>prev.filter(x=>x.id!==id));
    setSaving(false);
  }

  function startEdit(item) { setEditItem(item); setForm({ title:item.title, type:item.type, subject:item.subject, grade:item.grade||"", trimester:item.trimester||1, dateStart:item.dateStart||todayStr, dateEnd:item.dateEnd, description:item.description||"" }); setShowForm(true); }
  function cancelForm() { setShowForm(false); setEditItem(null); setForm(emptyForm); }

  function ItemCard({ item, isPast=false }) {
    const daysLeft = Math.ceil((new Date(item.dateEnd)-new Date(todayStr))/86400000);
    const color = typeColors[item.type]||"#475569";
    return (
      <div className="card" style={{ padding:"16px 20px", borderLeft:`4px solid ${isPast?"#cbd5e1":color}`, opacity:isPast?0.65:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
              <span className="badge" style={{ background:`${color}15`, color, border:`1px solid ${color}30`, fontWeight:700 }}>{item.type}</span>
              <span className="badge" style={{ background:"#f0fdf4", color:"#166534" }}>{item.subject}</span>
              {item.grade && <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{item.grade}</span>}
              <span className="badge" style={{ background:"#f8fafc", color:"#64748b" }}>{trimNames[(item.trimester||1)-1]}</span>
            </div>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:"1rem", marginBottom:"4px" }}>{item.title}</div>
            {item.description && <p style={{ margin:"0 0 6px", color:"#64748b", fontSize:"0.85rem", lineHeight:1.4 }}>{item.description}</p>}
            <div style={{ fontSize:"0.78rem", color:"#94a3b8", display:"flex", gap:"14px", flexWrap:"wrap" }}>
              {item.dateStart&&item.dateStart!==item.dateEnd&&<span>📅 Inicio: <strong style={{ color:"#475569" }}>{item.dateStart}</strong></span>}
              <span>⏰ Entrega: <strong style={{ color:"#475569" }}>{item.dateEnd}</strong></span>
              {!isPast&&<span style={{ color:daysLeft<=3?"#dc2626":daysLeft<=7?"#f59e0b":"#16a34a", fontWeight:700 }}>{daysLeft===0?"¡Hoy!":daysLeft===1?"Mañana":`En ${daysLeft} días`}</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
            <button onClick={()=>startEdit(item)} style={{ padding:"5px 10px", borderRadius:"8px", border:"1px solid #e2e8f0", background:"white", cursor:"pointer", fontSize:"0.8rem" }}>✏️</button>
            <button className="btn-danger" onClick={()=>remove(item.id, isPast)} style={{ padding:"5px 10px", fontSize:"0.8rem" }}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Próximas evaluaciones</h2>
        <button className="btn-primary" onClick={()=>{ if(showForm) cancelForm(); else { setShowForm(true); setEditItem(null); setForm(emptyForm); } }}>{showForm?"Cancelar":"+ Nueva"}</button>
      </div>
      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"24px", border:"2px solid #e0e7ff" }}>
          <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>{editItem?"Editar":"Nueva evaluación programada"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
            <div style={{ gridColumn:"1/-1" }}><label>Título *</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej: Examen unidad 3 – Ecuaciones" /></div>
            <div><label>Tipo *</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{UPCOMING_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label>Materia *</label><select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}>{subjects.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label>Año / Curso</label><select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option value="">Todos los años</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select></div>
            <div><label>Trimestre</label><select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>{trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>
            <div><label>Fecha de inicio (opcional)</label><input type="date" value={form.dateStart} onChange={e=>setForm({...form,dateStart:e.target.value})} /></div>
            <div><label>Fecha de entrega *</label><input type="date" value={form.dateEnd} onChange={e=>setForm({...form,dateEnd:e.target.value})} /></div>
            <div style={{ gridColumn:"1/-1" }}><label>Descripción (opcional)</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical" }} /></div>
          </div>
          <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
            <button className="btn-primary" onClick={save}>Guardar</button>
            <button onClick={cancelForm} style={{ padding:"10px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white" }}>Cancelar</button>
          </div>
        </div>
      )}
      {!loaded ? (
        <div className="card" style={{ padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📅</div>
          <p style={{ color:"#64748b", marginBottom:"20px" }}>Publicá evaluaciones para que los tutores puedan verlas</p>
          <button className="btn-primary" onClick={cargar} disabled={loading} style={{ padding:"12px 28px", fontSize:"1rem" }}>{loading?"Cargando...":"🔍 Cargar vigentes"}</button>
        </div>
      ) : (
        <>
          {vigentes.length===0&&<div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay evaluaciones vigentes. Usá el botón "+" para agregar.</p></div>}
          {vigentes.length>0&&<div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>{vigentes.map(item=><ItemCard key={item.id} item={item} />)}</div>}
          <div style={{ textAlign:"center" }}>
            {!pasadasLoaded ? (
              <button onClick={cargarPasadas} disabled={loadingPasadas} style={{ padding:"8px 20px", borderRadius:"10px", border:"1px solid #e2e8f0", background:"white", color:"#64748b", cursor:"pointer", fontSize:"0.82rem" }}>{loadingPasadas?"Cargando...":"🕐 Ver evaluaciones anteriores"}</button>
            ) : pasadas.length===0 ? (
              <p style={{ color:"#94a3b8", fontSize:"0.82rem" }}>No hay evaluaciones anteriores.</p>
            ) : (
              <>
                <p style={{ color:"#94a3b8", fontSize:"0.82rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", margin:"0 0 10px" }}>Anteriores</p>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>{pasadas.map(item=><ItemCard key={item.id} item={item} isPast />)}</div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StudentView() {
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null); const [studentGrades, setStudentGrades] = useState([]); const [loadingGrades, setLoadingGrades] = useState(false);
  async function doSearch() { if (!nameQ&&!gradeQ) return; setSearching(true); const r=await searchStudents({name:nameQ,grade:gradeQ}); setSearchResults(r); setSearching(false); }
  async function selectStudent(s) { setSelectedStudent(s); setLoadingGrades(true); const g=await getGradesByStudent(s.id); setStudentGrades(g); setLoadingGrades(false); }
  const globalAvg=avg(studentGrades.map(g=>g.score));
  const trimAvgs=[1,2,3].map(t=>{ const tg=studentGrades.filter(g=>g.trimester===t); return { t, avg:avg(tg.map(g=>g.score)), count:tg.length }; });
  const subjectMap={}; studentGrades.forEach(g=>{ if(!subjectMap[g.subject]) subjectMap[g.subject]=[]; subjectMap[g.subject].push(g); });
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Ver alumno</h2>
      {!selectedStudent ? (
        <div className="card" style={{ padding:"24px" }}>
          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre del alumno..." style={{ flex:1, minWidth:"160px" }} />
            <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"120px" }}><option value="">Todos los años</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select>
            <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
          </div>
          {searchResults.length>0&&<div style={{ marginTop:"8px", display:"flex", flexDirection:"column", gap:"6px", maxHeight:"300px", overflowY:"auto" }}>{searchResults.map(s=><div key={s.id} onClick={()=>selectStudent(s)} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}><span style={{ fontWeight:600 }}>{s.name}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span></div>)}</div>}
        </div>
      ) : (
        <div>
          <div className="card" style={{ padding:"20px 24px", marginBottom:"16px", borderLeft:"5px solid #1e3a5f", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 4px", fontSize:"1.3rem" }}>{selectedStudent.name}</h3><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{selectedStudent.grade}</span></div>
            <div style={{ display:"flex", gap:"20px", alignItems:"center" }}>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:"1.8rem", fontWeight:800, color:globalAvg==="–"?"#94a3b8":scoreColor(parseFloat(globalAvg)), fontFamily:"'Playfair Display',serif" }}>{globalAvg}</div><div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>Promedio</div></div>
              <button onClick={()=>{ setSelectedStudent(null); setStudentGrades([]); }} style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", fontSize:"0.82rem" }}>← Volver</button>
            </div>
          </div>
          {loadingGrades?<div style={{ textAlign:"center", padding:"40px", color:"#94a3b8" }}>Cargando...</div>:(
            <>
              <div className="card" style={{ padding:"16px 20px", marginBottom:"16px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px" }}>
                  {trimAvgs.map(({ t, avg:ta, count })=><div key={t} style={{ textAlign:"center", padding:"10px", background:"#f8fafc", borderRadius:"10px", border:`2px solid ${ta==="–"?"#e2e8f0":scoreColor(parseFloat(ta))}` }}><div style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600, textTransform:"uppercase" }}>{trimNames[t-1]}</div><div style={{ fontSize:"1.6rem", fontWeight:800, color:ta==="–"?"#94a3b8":scoreColor(parseFloat(ta)), fontFamily:"'Playfair Display',serif" }}>{ta}</div><div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{count} eval.</div></div>)}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {Object.entries(subjectMap).map(([subject,sGrades])=>{ const sAvg=parseFloat(avg(sGrades.map(g=>g.score))); return (
                  <div key={subject} className="card" style={{ overflow:"hidden" }}>
                    <div style={{ padding:"12px 20px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:"#1e3a5f" }}>{subject}</span>
                      <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                        {[1,2,3].map(t=>{ const ta=avg(sGrades.filter(g=>g.trimester===t).map(g=>g.score)); return ta!=="–"?<span key={t} style={{ fontSize:"0.7rem", padding:"2px 6px", borderRadius:"10px", background:`${scoreColor(parseFloat(ta))}15`, color:scoreColor(parseFloat(ta)), fontWeight:600 }}>{trimNames[t-1].split(" ")[0]}: {ta}</span>:null; })}
                        <span style={{ fontWeight:800, color:scoreColor(sAvg), fontSize:"1.1rem", fontFamily:"'Playfair Display',serif" }}>{avg(sGrades.map(g=>g.score))}</span>
                      </div>
                    </div>
                    {sGrades.map(g=><div key={g.id} style={{ padding:"10px 20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #f8fafc" }}><div style={{ width:"32px", height:"32px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"0.85rem", flexShrink:0 }}>{g.score}</div><div><span style={{ fontWeight:600, fontSize:"0.88rem" }}>{g.type}</span><span style={{ fontSize:"0.78rem", color:"#94a3b8", marginLeft:"8px" }}>{trimNames[g.trimester-1]} · {g.date}</span></div></div>)}
                  </div>
                ); })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ObservationsTab({ user, profile, setSaving }) {
  const [observations, setObservations] = useState([]); const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false);
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState(""); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null); const [form, setForm] = useState({ text:"", date:new Date().toISOString().split("T")[0] });
  const [success, setSuccess] = useState(false); const [nameFilter, setNameFilter] = useState("");
  const subjects = profile.subjects || (profile.subject ? [profile.subject] : []);
  async function doSearch() { if (!nameQ&&!gradeQ) return; setSearching(true); const r=await searchStudents({name:nameQ,grade:gradeQ}); setSearchResults(r); setSearching(false); }
  async function cargar() { setLoading(true); const o=await getObservationsByTeacher(user.uid); setObservations(o); setLoaded(true); setLoading(false); }
  async function submit() {
    if (!selectedStudent || !form.text.trim()) return; setSaving(true);
    const data = { studentId:selectedStudent.id, studentName:selectedStudent.name, studentGrade:selectedStudent.grade||"", teacherId:user.uid, teacherName:profile.name||"", subjects, text:form.text.trim(), date:form.date };
    const id = await createObservation(data); setObservations(prev=>[{ id, ...data },...prev]); if (!loaded) setLoaded(true);
    setForm({ text:"", date:new Date().toISOString().split("T")[0] }); setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    setSuccess(true); setTimeout(()=>setSuccess(false),2500); setSaving(false);
  }
  async function removeObs(id) { setSaving(true); await deleteObservation(id); setObservations(prev=>prev.filter(o=>o.id!==id)); setSaving(false); }
  const filtered = observations.filter(o=>!nameFilter||(o.studentName||"").toLowerCase().includes(nameFilter.toLowerCase()));
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Observaciones</h2>
      {success&&<div className="fade" style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", color:"#065f46", fontWeight:600 }}>✅ Observación guardada</div>}
      <div className="card" style={{ padding:"24px", marginBottom:"24px", border:"2px solid #e0e7ff" }}>
        <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>Nueva observación</h3>
        {selectedStudent ? (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#dbeafe", borderRadius:"10px", marginBottom:"16px" }}>
            <div><span style={{ fontWeight:700 }}>{selectedStudent.name}</span><span className="badge" style={{ background:"white", color:"#1e40af", marginLeft:"8px" }}>{selectedStudent.grade}</span></div>
            <button onClick={()=>{ setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ(""); }} style={{ fontSize:"0.8rem", color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>✕ Cambiar</button>
          </div>
        ) : (
          <div style={{ marginBottom:"16px" }}>
            <label>Buscar alumno</label>
            <div style={{ display:"flex", gap:"10px", marginTop:"6px", flexWrap:"wrap" }}>
              <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="🔍 Nombre..." style={{ flex:1, minWidth:"140px" }} />
              <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"110px" }}><option value="">Todos los años</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select>
              <button className="btn-primary" onClick={doSearch} disabled={searching}>{searching?"Buscando...":"Buscar"}</button>
            </div>
            {searchResults.length>0&&<div style={{ marginTop:"8px", display:"flex", flexDirection:"column", gap:"6px", maxHeight:"180px", overflowY:"auto" }}>{searchResults.map(s=><div key={s.id} onClick={()=>{ setSelectedStudent(s); setSearchResults([]); }} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:"8px", border:"1px solid #e2e8f0", cursor:"pointer", display:"flex", justifyContent:"space-between" }}><span style={{ fontWeight:600 }}>{s.name}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span></div>)}</div>}
          </div>
        )}
        {selectedStudent&&(
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"16px", marginBottom:"16px" }}>
              <div><label>Observación</label><textarea value={form.text} onChange={e=>setForm({...form,text:e.target.value})} rows={3} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", resize:"vertical", marginTop:"4px" }} /></div>
              <div><label>Fecha</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{ marginTop:"4px" }} /></div>
            </div>
            <button className="btn-primary" onClick={submit}>Guardar →</button>
          </>
        )}
      </div>
      <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 12px" }}>Mis observaciones</h3>
      {!loaded ? (
        <div className="card" style={{ padding:"40px", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:"12px" }}>💬</div>
          <p style={{ color:"#64748b", marginBottom:"20px" }}>Presioná para cargar tus observaciones</p>
          <button className="btn-primary" onClick={cargar} disabled={loading}>{loading?"Cargando...":"🔍 Cargar"}</button>
        </div>
      ) : (
        <>
          <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Filtrar por alumno..." style={{ width:"100%", marginBottom:"16px" }} />
          {filtered.length===0?<div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay observaciones aún.</p></div>:(
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {filtered.map(o=>(
                <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                    <div><span style={{ fontWeight:700 }}>{o.studentName}</span><span className="badge" style={{ background:"#dbeafe", color:"#1e40af", marginLeft:"8px" }}>{o.studentGrade}</span></div>
                    <div style={{ display:"flex", gap:"12px", alignItems:"center" }}><span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{o.date}</span><button className="btn-danger" onClick={()=>removeObs(o.id)}>Eliminar</button></div>
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

function Ranking({ user, subject }) {
  const [grades, setGrades] = useState([]); const [hasMore, setHasMore] = useState(false); const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState(""); const [gradeFilter, setGradeFilter] = useState("");
  async function cargar() { setLoading(true); const { grades:g, hasMore:hm }=await getGradesByTeacherPaged(user.uid); setGrades(g); setHasMore(hm); setLoaded(true); setLoading(false); }
  async function loadMore() { setLoadingMore(true); const { grades:g, hasMore:hm }=await getMoreGradesByTeacher(user.uid); setGrades(g); setHasMore(hm); setLoadingMore(false); }
  const subjectGrades=grades.filter(g=>g.subject===subject);
  const studentMap={};
  subjectGrades.forEach(g=>{ if (!studentMap[g.studentId]) studentMap[g.studentId]={ id:g.studentId, name:g.studentName||"–", grade:g.studentGrade||"", scores:[], trimScores:{1:[],2:[],3:[]} }; studentMap[g.studentId].scores.push(g.score); if (studentMap[g.studentId].trimScores[g.trimester]) studentMap[g.studentId].trimScores[g.trimester].push(g.score); });
  let students=Object.values(studentMap);
  if (nameFilter) students=students.filter(s=>s.name.toLowerCase().includes(nameFilter.toLowerCase()));
  if (gradeFilter) students=students.filter(s=>s.grade===gradeFilter);
  students.sort((a,b)=>parseFloat(avg(b.scores)||0)-parseFloat(avg(a.scores)||0));
  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 20px" }}>Rendimiento — {subject}</h2>
      {!loaded ? (
        <div className="card" style={{ padding:"48px", textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📊</div>
          <p style={{ color:"#64748b", marginBottom:"20px" }}>Presioná para ver el rendimiento</p>
          <button className="btn-primary" onClick={cargar} disabled={loading} style={{ padding:"12px 28px", fontSize:"1rem" }}>{loading?"Cargando...":"🔍 Ver rendimiento"}</button>
        </div>
      ) : (
        <>
          {hasMore&&<p style={{ color:"#f59e0b", fontSize:"0.82rem", marginBottom:"16px" }}>⚠️ Hay más evaluaciones sin cargar.</p>}
          <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
            <input value={nameFilter} onChange={e=>setNameFilter(e.target.value)} placeholder="🔍 Buscar alumno..." style={{ flex:1, minWidth:"160px" }} />
            <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{ width:"120px" }}><option value="">Todos los años</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select>
          </div>
          {students.length===0?<div className="card" style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}><p>No hay evaluaciones para esta materia aún.</p></div>:(
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {students.map((s,idx)=>{ const sa=avg(s.scores); const color=sa==="–"?"#e2e8f0":scoreColor(parseFloat(sa)); return (
                <div key={s.id} className="card" style={{ padding:"16px 20px", borderLeft:`4px solid ${color}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}><span style={{ fontWeight:800, color:"#94a3b8", fontSize:"0.9rem", minWidth:"24px" }}>#{idx+1}</span><div><div style={{ fontWeight:700 }}>{s.name}</div>{s.grade&&<span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{s.grade}</span>}</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:"1.6rem", fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>{sa}</div><div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{s.scores.length} eval.</div></div>
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>{[1,2,3].map(t=>{ const ta=avg(s.trimScores[t]); return ta!=="–"?<span key={t} style={{ fontSize:"0.72rem", padding:"2px 8px", borderRadius:"20px", background:`${scoreColor(parseFloat(ta))}15`, color:scoreColor(parseFloat(ta)), fontWeight:600, border:`1px solid ${scoreColor(parseFloat(ta))}30` }}>{trimNames[t-1]}: {ta}</span>:null; })}</div>
                </div>
              ); })}
            </div>
          )}
          {hasMore&&<div style={{ textAlign:"center", marginTop:"20px" }}><button onClick={loadMore} disabled={loadingMore} style={{ padding:"10px 28px", borderRadius:"10px", border:"2px solid #1e3a5f", background:"white", color:"#1e3a5f", cursor:"pointer", fontWeight:600 }}>{loadingMore?"Cargando...":"⬇ Cargar más"}</button></div>}
        </>
      )}
    </div>
  );
}
