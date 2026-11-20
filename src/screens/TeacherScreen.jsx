import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor, Top6Tab, CourseObservationsTab, analyzeStudentRisk, RiskAlertsPanel, SubjectStatusTab } from "../components";
import {
  searchStudents, getStudentsByGrade,
  getGradesByTeacherPaged, getMoreGradesByTeacher, getGradesByStudent, getAllGradesByTeacher,
  getGradesForTeacherAndSubjects,
  createGrade, createGradesBatch, deleteGrade, updateGrade,
  getGradeTypes, addGradeType,
  getObservationsByTeacher, createObservation, deleteObservation,
  getAttitudesByTeacher, saveAttitude, saveAttitudesBatch, deleteAttitude,
  ATTITUDE_VALUES, ATTITUDE_LABELS, ATTITUDE_COLORS,
  getUpcomingByTeacher, getUpcomingPastByTeacher, createUpcoming, deleteUpcoming, updateUpcoming,
  getInternalObsByTeacher, createInternalObs, updateInternalObs, deleteInternalObs,
  getAllStudents, getAllExternalGrades, addExternalGrade, deleteExternalGrade, upsertExternalGrade,
} from "../db";

const GRADES = ["1°","2°","3°","4°","5°","6°"];

// Detecta el trimestre actual según el calendario escolar
// 1°: 25/feb – 27/may | 2°: 28/may – 15/sep | 3°: 16/sep – 18/dic
function getCurrentTrimester() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if ((m === 2 && d >= 25) || m === 3 || m === 4 || (m === 5 && d <= 27)) return 1;
  if ((m === 5 && d >= 28) || m === 6 || m === 7 || m === 8 || (m === 9 && d <= 15)) return 2;
  if ((m === 9 && d >= 16) || m === 10 || m === 11 || (m === 12 && d <= 18)) return 3;
  return 1;
}

// Toast de éxito fijo en pantalla
function SaveToast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position:"fixed", top:"24px", left:"50%", transform:"translateX(-50%)",
      zIndex:9999, background:"#065f46", color:"white",
      padding:"16px 32px", borderRadius:"16px",
      boxShadow:"0 8px 32px rgba(0,0,0,0.25)",
      fontSize:"1.05rem", fontWeight:700,
      display:"flex", alignItems:"center", gap:"12px",
      animation:"slideDown 0.3s ease",
      whiteSpace:"nowrap",
    }}>
      <span style={{ fontSize:"1.4rem" }}>✅</span>
      {message}
    </div>
  );
}


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
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 4000); }

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
    const [g, types] = await Promise.all([
      getGradesForTeacherAndSubjects(user.uid, subjects),
      getGradeTypes(user.uid),
    ]);
    setGrades(g); setHasMore(false); setGradeTypes(types);
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
      <style>{`${GLOBAL_STYLES} @keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
      <SaveToast message={toast} />
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
            ["alertas","⚠️ Alertas"],
            ["riesgo","📉 Llevan la materia"],
            ["upcoming","📅 Próximas eval."],
            ["ranking","📊 Rendimiento"],
            ["top6","🏆 Top 6° Año"],
            ["internalobs","🔒 Obs. Internas"],
            ["externas","🏫 Notas Externas"],
            ["cierre","📋 Cierre de Notas"],
          ].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>handleTabChange(k)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div> : (
          <div className="fade" key={tab}>
            {tab==="add"          && <AddGrade user={user} subject={selectedSubject} grades={grades} setGrades={setGrades} gradeTypes={gradeTypes} setGradeTypes={setGradeTypes} setSaving={setSaving} profile={profile} showToast={showToast} />}
            {tab==="mygrades"     && <MyGrades grades={grades} setGrades={setGrades} setSaving={setSaving} hasMore={hasMore} loadMore={loadMore} />}
            {tab==="student"      && <StudentGradesTab user={user} subject={selectedSubject} subjects={subjects} setSaving={setSaving} />}
            {tab==="attitudes"    && <AttitudesTab user={user} profile={profile} subject={selectedSubject} attitudes={attitudes} setAttitudes={setAttitudes} setSaving={setSaving} loaded={attitudesLoaded} />}
            {tab==="observations" && <ObservationsTab user={user} profile={profile} observations={observations} setObservations={setObservations} setSaving={setSaving} loaded={observationsLoaded} />}
            {tab==="alertas"      && <TeacherRiskTab user={user} subjects={subjects} />}
            {tab==="riesgo"       && <SubjectStatusTab grades={grades} subjects={subjects} defaultSubject={selectedSubject} />}
            {tab==="upcoming"     && <UpcomingTab user={user} profile={profile} subject={selectedSubject} setSaving={setSaving} />}
            {tab==="ranking"      && <Ranking grades={grades} subject={selectedSubject} />}
            {tab==="top6"         && <Top6Tab />}
            {tab==="internalobs"  && <InternalObsTeacherTab user={user} profile={profile} setSaving={setSaving} />}
            {tab==="externas"     && <TeacherExternalGradesTab profile={profile} subjects={subjects} />}
            {tab==="cierre"       && <TeacherCierreTab grades={grades} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARGAR NOTA (individual o masiva)
// ═══════════════════════════════════════════════════════════════════
function AddGrade({ user, subject, grades, setGrades, gradeTypes, setGradeTypes, setSaving, profile, showToast }) {
  const [mode, setMode] = useState("individual"); // individual | bulk
  // --- Individual ---
  const [nameQ, setNameQ] = useState(""); const [gradeQ, setGradeQ] = useState(""); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false); const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({ score:"", type:"Examen", trimester:getCurrentTrimester(), date:new Date().toISOString().split("T")[0], note:"" });
  const [newType, setNewType] = useState(""); const [showNewType, setShowNewType] = useState(false);
  // --- Bulk ---
  const [bulkGrade, setBulkGrade] = useState(""); const [bulkStudents, setBulkStudents] = useState([]); const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({ type:"Examen", trimester:getCurrentTrimester(), date:new Date().toISOString().split("T")[0], note:"" });
  const [bulkScores, setBulkScores] = useState({});
  // --- Confirmación ---
  const [confirmData, setConfirmData] = useState(null); // null | { mode, ...datos }

  async function doSearch() { if (!nameQ && !gradeQ) return; setSearching(true); const r = await searchStudents({name:nameQ, grade:gradeQ}); setSearchResults(r); setSearching(false); }

  function requestConfirmIndividual() {
    if (!selectedStudent || !form.score) return;
    const score = parseFloat(form.score);
    if (score<3||score>10) { alert("La nota debe estar entre 3 y 10. La nota mínima es 3."); return; }
    const today = new Date().toISOString().split("T")[0];
    if (form.date > today) { alert(`No se puede cargar una nota con fecha futura (${form.date}). La fecha máxima es hoy (${today}).`); return; }
    setConfirmData({ mode:"individual", student: selectedStudent, score, form });
  }

  async function confirmAndSaveIndividual() {
    const { student, score, form: f } = confirmData;
    setConfirmData(null);
    setSaving(true);
    const data = { ...f, score, teacherId:user.uid, teacherName:profile.name||"", subject, studentId:student.id, studentName:student.name, studentGrade:student.grade||"" };
    const id = await createGrade(data);
    setGrades(prev=>[{id,...data},...prev]);
    setForm({ score:"", type:f.type, trimester:f.trimester, date:f.date, note:"" });
    setSelectedStudent(null); setSearchResults([]); setNameQ(""); setGradeQ("");
    showToast("Nota guardada correctamente");
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

  function requestConfirmBulk() {
    const toSave = bulkStudents.filter(s => bulkScores[s.id] !== "" && !isNaN(parseFloat(bulkScores[s.id])));
    if (toSave.length === 0) { alert("Completá al menos una nota"); return; }
    const invalid = toSave.filter(s => parseFloat(bulkScores[s.id]) < 3 || parseFloat(bulkScores[s.id]) > 10);
    if (invalid.length > 0) { alert(`Nota inválida para: ${invalid.map(s=>s.name).join(", ")}. La nota debe ser entre 3 y 10 (mínimo 3).`); return; }
    const today = new Date().toISOString().split("T")[0];
    if (bulkForm.date > today) { alert(`No se puede cargar notas con fecha futura (${bulkForm.date}). La fecha máxima es hoy (${today}).`); return; }
    setConfirmData({ mode:"bulk", toSave, bulkForm, grade: bulkGrade });
  }

  async function confirmAndSaveBulk() {
    const { toSave, bulkForm: bf } = confirmData;
    setConfirmData(null);
    const missing = bulkStudents.filter(s => !bulkScores[s.id] || isNaN(parseFloat(bulkScores[s.id])));
    if (missing.length > 0) {
      const nameList = missing.map(s => `• ${s.name}`).join("\n");
      const ok = window.confirm(`⚠️ Faltan notas para ${missing.length} alumno${missing.length!==1?"s":""}:\n\n${nameList}\n\n¿Guardar igualmente con los que tienen nota cargada?`);
      if (!ok) return;
    }
    setSaving(true);
    const gradesData = toSave.map(s => ({
      ...bf,
      score: parseFloat(bulkScores[s.id]),
      teacherId: user.uid, teacherName: profile.name||"",
      subject, studentId: s.id, studentName: s.name, studentGrade: s.grade||"",
    }));
    const newGrades = await createGradesBatch(gradesData);
    setGrades(prev => [...newGrades, ...prev]);
    setBulkScores({});
    bulkStudents.forEach(s => { setBulkScores(prev=>({...prev,[s.id]:""})); });
    showToast(`${toSave.length} nota${toSave.length!==1?"s":""} guardada${toSave.length!==1?"s":""} correctamente`);
    setSaving(false);
  }

  async function handleAddType() {
    if (!newType.trim()) return;
    const updated = await addGradeType(user.uid, newType.trim());
    setGradeTypes(updated);
    setNewType(""); setShowNewType(false);
  }

  const activeTrim = getCurrentTrimester();

  // Carpetas existentes del mismo curso+materia para agregar alumno ausente
  // Solo se muestran carpetas del trimestre activo (el pasado ya está cerrado)
  const existingFolders = (() => {
    if (!selectedStudent) return [];
    const groupMap = {};
    grades
      .filter(g => g.subject === subject && g.studentGrade === selectedStudent.grade && g.trimester === activeTrim)
      .forEach(g => {
        const key = `${g.type}|||${g.date}|||${g.trimester}`;
        if (!groupMap[key]) groupMap[key] = { type:g.type, date:g.date, trimester:g.trimester, count:0 };
        groupMap[key].count++;
      });
    return Object.values(groupMap).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);
  })();

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

              {/* Carpetas existentes del curso — para agregar alumno ausente */}
              {existingFolders.length > 0 && (
                <div style={{ marginBottom:"20px", padding:"14px 16px", background:"#f0f9ff", borderRadius:"12px", border:"1px solid #bae6fd" }}>
                  <div style={{ fontSize:"0.8rem", color:"#0369a1", fontWeight:700, marginBottom:"8px" }}>
                    📁 Agregar a evaluación existente de {selectedStudent.grade}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                    {existingFolders.map(f => {
                      const isActive = form.type===f.type && form.date===f.date && form.trimester===f.trimester;
                      return (
                        <button
                          key={`${f.type}|||${f.date}`}
                          onClick={() => setForm(prev => ({ ...prev, type:f.type, date:f.date, trimester:f.trimester }))}
                          style={{ padding:"6px 14px", borderRadius:"20px", border:`2px solid ${isActive?"#059669":"#e2e8f0"}`, background:isActive?"#d1fae5":"white", color:isActive?"#065f46":"#475569", cursor:"pointer", fontSize:"0.8rem", fontWeight:600, transition:"all 0.15s" }}
                        >
                          {f.type} · {f.date}
                          <span style={{ opacity:0.6, fontSize:"0.75rem", marginLeft:"4px" }}>({f.count} alumnos)</span>
                        </button>
                      );
                    })}
                  </div>
                  {existingFolders.some(f => form.type===f.type && form.date===f.date && form.trimester===f.trimester) && (
                    <div style={{ marginTop:"8px", fontSize:"0.78rem", color:"#059669", fontWeight:600 }}>
                      ✅ La nota se agregará a esa carpeta
                    </div>
                  )}
                </div>
              )}

              <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"10px", padding:"10px 14px", marginBottom:"4px", fontSize:"0.85rem", color:"#92400e", fontWeight:600 }}>
                ⚠️ Nota mínima: <strong>3</strong> — el sistema no acepta notas menores a 3.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
                <div><label>Nota (3–10)</label><input type="number" min="3" max="10" step="0.5" value={form.score} onChange={e=>setForm({...form,score:e.target.value})} placeholder="Ej: 8" /></div>
                <div>
                  <label>Trimestre</label>
                  <select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>
                    {trimNames.map((n,i)=>(
                      <option key={i+1} value={i+1} disabled={i+1 < activeTrim}>
                        {n}{i+1 < activeTrim ? " (cerrado)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div><label>Fecha</label><input type="date" max={new Date().toISOString().split("T")[0]} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div>
                <div><label>Observación (opcional)</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Comentario para el tutor..." /></div>
              </div>
              <button className="btn-primary" onClick={requestConfirmIndividual} style={{ marginTop:"20px", padding:"12px 32px", fontSize:"1rem" }}>Guardar evaluación →</button>
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
                      {trimNames.map((n,i)=>(
                        <option key={i+1} value={i+1} disabled={i+1 < activeTrim}>
                          {n}{i+1 < activeTrim ? " (cerrado)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div><label>Fecha</label><input type="date" max={new Date().toISOString().split("T")[0]} value={bulkForm.date} onChange={e=>setBulkForm({...bulkForm,date:e.target.value})} /></div>
                  <div style={{ gridColumn:"1/-1" }}><label>Observación para todos (opcional)</label><input value={bulkForm.note} onChange={e=>setBulkForm({...bulkForm,note:e.target.value})} placeholder="Comentario general..." /></div>
                </div>
              </div>

              <div className="card" style={{ padding:"24px" }}>
                <h3 style={{ margin:"0 0 16px", color:"#1e3a5f", fontSize:"1rem" }}>3. Ingresar notas — {bulkGrade} ({bulkStudents.length} alumnos)</h3>
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", fontSize:"0.85rem", color:"#92400e", fontWeight:600 }}>
                  ⚠️ Nota mínima: <strong>3</strong> — el sistema no acepta notas menores a 3.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px", alignItems:"center", marginBottom:"8px" }}>
                  <span style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Alumno</span>
                  <span style={{ fontSize:"0.75rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase", width:"100px", textAlign:"center" }}>Nota (3–10)</span>
                </div>
                {bulkStudents.map(s => (
                  <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>{s.name}</div>
                    <input
                      type="number" min="3" max="10" step="0.5"
                      value={bulkScores[s.id]||""}
                      onChange={e=>setBulkScores(prev=>({...prev,[s.id]:e.target.value}))}
                      placeholder="–"
                      style={{ width:"100px", textAlign:"center", padding:"8px 10px" }}
                    />
                  </div>
                ))}
                <div style={{ marginTop:"20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.85rem", color:"#64748b" }}>{Object.values(bulkScores).filter(v=>v!=="").length} de {bulkStudents.length} notas completadas</span>
                  <button className="btn-primary" onClick={requestConfirmBulk} style={{ padding:"12px 32px", fontSize:"1rem" }}>Guardar todas las notas →</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN ───────────────────────────────── */}
      {confirmData && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div className="card" style={{ width:"100%", maxWidth:"440px", padding:"28px", borderTop:"5px solid #1e3a5f" }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 6px" }}>Confirmá antes de guardar</h3>
            <p style={{ color:"#64748b", fontSize:"0.85rem", margin:"0 0 20px" }}>Revisá que los datos sean correctos.</p>

            {confirmData.mode === "individual" ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {[
                  ["Alumno",    confirmData.student.name],
                  ["Materia",   subject],
                  ["Tipo",      confirmData.form.type],
                  ["Nota",      `${confirmData.score} / 10`],
                  ["Trimestre", trimNames[confirmData.form.trimester - 1]],
                  ["Fecha",     confirmData.form.date],
                  ...(confirmData.form.note ? [["Observación", confirmData.form.note]] : []),
                ].map(([label, value]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#f8fafc", borderRadius:"8px" }}>
                    <span style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>{label}</span>
                    <span style={{ fontSize:"0.9rem", color:"#1e293b", fontWeight:700 }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {[
                  ["Curso",     confirmData.grade],
                  ["Materia",   subject],
                  ["Tipo",      confirmData.bulkForm.type],
                  ["Trimestre", trimNames[confirmData.bulkForm.trimester - 1]],
                  ["Fecha",     confirmData.bulkForm.date],
                  ["Alumnos",   `${confirmData.toSave.length} notas a guardar`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#f8fafc", borderRadius:"8px" }}>
                    <span style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>{label}</span>
                    <span style={{ fontSize:"0.9rem", color:"#1e293b", fontWeight:700 }}>{value}</span>
                  </div>
                ))}
                <div style={{ maxHeight:"160px", overflowY:"auto", background:"#f8fafc", borderRadius:"8px", padding:"8px 12px" }}>
                  {confirmData.toSave.map(s => (
                    <div key={s.id} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #e2e8f0", fontSize:"0.85rem" }}>
                      <span style={{ color:"#475569" }}>{s.name}</span>
                      <span style={{ fontWeight:700, color:"#1e3a5f" }}>{parseFloat(bulkScores[s.id])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:"flex", gap:"12px", marginTop:"24px" }}>
              <button
                onClick={confirmData.mode==="individual" ? confirmAndSaveIndividual : confirmAndSaveBulk}
                style={{ flex:1, padding:"12px", borderRadius:"10px", background:"#065f46", color:"white", border:"none", cursor:"pointer", fontWeight:700, fontSize:"0.95rem" }}
              >
                Confirmar y guardar
              </button>
              <button
                onClick={() => setConfirmData(null)}
                style={{ flex:1, padding:"12px", borderRadius:"10px", background:"#f1f5f9", color:"#475569", border:"none", cursor:"pointer", fontWeight:600, fontSize:"0.95rem" }}
              >
                Corregir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MIS EVALUACIONES — vista de carpetas agrupadas
// ═══════════════════════════════════════════════════════════════════
function MyGrades({ grades, setGrades, setSaving, hasMore, loadMore }) {
  const [gradeFilter, setGradeFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [trim, setTrim]               = useState(0);
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const availableStudentGrades = [...new Set(grades.map(g => g.studentGrade).filter(Boolean))].sort();
  const availableTypes         = [...new Set(grades.map(g => g.type).filter(Boolean))].sort();
  const hasFilters = gradeFilter || typeFilter || trim !== 0 || dateFrom || dateTo;

  // Agrupar por (subject, type, studentGrade, date, trimester)
  const groupMap = {};
  grades.forEach(g => {
    const key = `${g.subject}|||${g.type}|||${g.studentGrade}|||${g.date}|||${g.trimester}`;
    if (!groupMap[key]) groupMap[key] = { key, subject:g.subject, type:g.type, studentGrade:g.studentGrade, date:g.date, trimester:g.trimester, items:[] };
    groupMap[key].items.push(g);
  });

  const allGroups = Object.values(groupMap).sort((a,b) => b.date.localeCompare(a.date));

  const filteredGroups = allGroups
    .filter(gr => !gradeFilter || gr.studentGrade === gradeFilter)
    .filter(gr => !typeFilter  || gr.type === typeFilter)
    .filter(gr => trim === 0   || gr.trimester === trim)
    .filter(gr => !dateFrom    || gr.date >= dateFrom)
    .filter(gr => !dateTo      || gr.date <= dateTo);

  async function handleLoadMore() { setLoadingMore(true); await loadMore(); setLoadingMore(false); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>
          Mis evaluaciones ({filteredGroups.length} carpeta{filteredGroups.length!==1?"s":""}{hasFilters && allGroups.length!==filteredGroups.length?` de ${allGroups.length}`:""})
        </h2>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding:"14px 18px", marginBottom:"16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:"10px" }}>
          <select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} style={{ padding:"8px 10px" }}>
            <option value="">Todos los años</option>
            {availableStudentGrades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ padding:"8px 10px" }}>
            <option value="">Todos los tipos</option>
            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={trim} onChange={e=>setTrim(parseInt(e.target.value))} style={{ padding:"8px 10px" }}>
            <option value={0}>Todos los trim.</option>
            {trimNames.map((n,i) => <option key={i+1} value={i+1}>{n}</option>)}
          </select>
          <div>
            <div style={{ fontSize:"0.7rem", color:"#94a3b8", marginBottom:"2px" }}>Desde</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ padding:"8px 10px", width:"100%", boxSizing:"border-box" }} />
          </div>
          <div>
            <div style={{ fontSize:"0.7rem", color:"#94a3b8", marginBottom:"2px" }}>Hasta</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ padding:"8px 10px", width:"100%", boxSizing:"border-box" }} />
          </div>
        </div>
        {hasFilters && (
          <button onClick={()=>{setGradeFilter("");setTypeFilter("");setTrim(0);setDateFrom("");setDateTo("");}} style={{ marginTop:"10px", padding:"5px 14px", borderRadius:"20px", border:"1px solid #e2e8f0", background:"#f8fafc", color:"#64748b", cursor:"pointer", fontSize:"0.8rem" }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem" }}>📁</div>
          <p>{hasFilters ? "Ninguna evaluación coincide con los filtros" : "No hay evaluaciones cargadas aún"}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {filteredGroups.map(gr => (
            <EvalFolder key={gr.key} group={gr} setGrades={setGrades} setSaving={setSaving} />
          ))}
          {hasMore && (
            <button className="btn-primary" onClick={handleLoadMore} disabled={loadingMore} style={{ margin:"8px auto", display:"block" }}>
              {loadingMore ? "Cargando..." : "Cargar más evaluaciones"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Carpeta individual — expandible con edición inline
function EvalFolder({ group, setGrades, setSaving }) {
  const [open, setOpen]     = useState(false);
  const [edits, setEdits]   = useState({}); // { [id]: score string }
  const [editDate, setEditDate] = useState(group.date);
  const [saving, setLocalSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const groupAvg = avg(group.items.map(g => g.score));
  const today    = new Date().toISOString().split("T")[0];

  const hasChanges = Object.keys(edits).length > 0 || editDate !== group.date;

  function handleScoreChange(id, val) {
    setEdits(prev => ({ ...prev, [id]: val }));
  }

  async function saveEdits() {
    if (editDate > today) { alert(`No se puede usar una fecha futura (${editDate})`); return; }
    setLocalSaving(true);
    const promises = [];

    // Guardar cambios de notas
    Object.entries(edits).forEach(([id, val]) => {
      const s = parseFloat(val);
      if (!isNaN(s) && s >= 1 && s <= 10) promises.push(updateGrade(id, { score: s }));
    });

    // Guardar cambio de fecha para toda la carpeta
    if (editDate !== group.date) {
      group.items.forEach(g => promises.push(updateGrade(g.id, { date: editDate })));
    }

    await Promise.all(promises);

    // Actualizar estado local
    setGrades(prev => prev.map(g => {
      if (!group.items.some(gi => gi.id === g.id)) return g;
      const scoreVal = edits[g.id] !== undefined ? parseFloat(edits[g.id]) : g.score;
      return { ...g, score: !isNaN(scoreVal) && scoreVal >= 1 && scoreVal <= 10 ? scoreVal : g.score, date: editDate };
    }));

    setEdits({});
    group.date = editDate; // update group ref for re-renders
    setLocalSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function deleteOne(id) {
    if (!window.confirm("¿Eliminar la nota de este alumno?")) return;
    setSaving(true);
    await deleteGrade(id);
    setGrades(prev => prev.filter(g => g.id !== id));
    setSaving(false);
  }

  async function deleteFolder() {
    const n = group.items.length;
    if (!window.confirm(`¿Eliminar esta evaluación completa? Se borrarán las ${n} nota${n!==1?"s":""} de todos los alumnos. Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    await Promise.all(group.items.map(g => deleteGrade(g.id)));
    setGrades(prev => prev.filter(g => !group.items.some(gi => gi.id === g.id)));
    setSaving(false);
  }

  const avgColor = groupAvg === "–" ? "#94a3b8" : scoreColor(parseFloat(groupAvg));

  return (
    <div className="card" style={{ overflow:"hidden", border: open ? "2px solid #1e3a5f" : "2px solid transparent" }}>
      {/* Cabecera / carpeta cerrada */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px", cursor:"pointer", background: open ? "#f0f4f8" : "white", transition:"background 0.15s" }}
      >
        <span style={{ fontSize:"1.6rem", flexShrink:0 }}>{open ? "📂" : "📁"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, color:"#1e3a5f", fontSize:"1rem" }}>
            {group.type} — {group.studentGrade}
          </div>
          <div style={{ fontSize:"0.8rem", color:"#64748b", marginTop:"2px" }}>
            {group.subject} · {trimNames[group.trimester-1]} · {group.date} · {group.items.length} alumno{group.items.length!==1?"s":""}
          </div>
        </div>
        <div style={{ textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:"1.4rem", fontWeight:800, color:avgColor, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{groupAvg}</div>
          <div style={{ fontSize:"0.68rem", color:"#94a3b8" }}>promedio</div>
        </div>
        <div style={{ flexShrink:0, display:"flex", gap:"8px", alignItems:"center" }}>
          <button
            onClick={e => { e.stopPropagation(); deleteFolder(); }}
            style={{ padding:"5px 12px", borderRadius:"8px", background:"#fee2e2", color:"#dc2626", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}
          >
            🗑 Eliminar
          </button>
          <span style={{ color:"#94a3b8", fontSize:"1.1rem" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Contenido expandido */}
      {open && (
        <div style={{ padding:"20px 24px", borderTop:"1px solid #e2e8f0" }}>
          {saved && (
            <div style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"10px", padding:"10px 16px", marginBottom:"16px", color:"#065f46", fontWeight:600, fontSize:"0.9rem" }}>
              ✅ Cambios guardados correctamente
            </div>
          )}

          {/* Editar fecha de la carpeta */}
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
            <label style={{ fontSize:"0.82rem", color:"#64748b", fontWeight:600 }}>Fecha de la evaluación:</label>
            <input
              type="date"
              max={today}
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              style={{ padding:"7px 12px", borderRadius:"8px", border:"1px solid #e2e8f0", fontSize:"0.9rem" }}
            />
            {editDate !== group.date && (
              <span style={{ fontSize:"0.78rem", color:"#d97706", fontWeight:600 }}>⚠ Se aplicará a todos los alumnos</span>
            )}
          </div>

          {/* Tabla de alumnos */}
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 80px", gap:"8px", padding:"0 4px" }}>
              <span style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Alumno</span>
              <span style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase", textAlign:"center" }}>Nota</span>
              <span></span>
            </div>
            {group.items.sort((a,b) => (a.studentName||"").localeCompare(b.studentName||"")).map(g => {
              const currentScore = edits[g.id] !== undefined ? edits[g.id] : String(g.score);
              const scoreNum = parseFloat(currentScore);
              const isModified = edits[g.id] !== undefined && parseFloat(edits[g.id]) !== g.score;
              return (
                <div key={g.id} style={{ display:"grid", gridTemplateColumns:"1fr 100px 80px", gap:"8px", alignItems:"center", padding:"8px 4px", borderBottom:"1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontWeight:600, color:"#1e293b", fontSize:"0.9rem" }}>{g.studentName||"–"}</div>
                    {g.note && <div style={{ fontSize:"0.75rem", color:"#7c3aed" }}>💬 {g.note}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <input
                      type="number" min="1" max="10" step="0.5"
                      value={currentScore}
                      onChange={e => handleScoreChange(g.id, e.target.value)}
                      style={{ width:"60px", padding:"6px 8px", textAlign:"center", borderRadius:"8px", border:`2px solid ${isModified?"#d97706":"#e2e8f0"}`, fontWeight:700, color:!isNaN(scoreNum)?scoreColor(scoreNum):"#1e293b", background: isModified?"#fffbeb":"white" }}
                    />
                  </div>
                  <button
                    onClick={() => deleteOne(g.id)}
                    style={{ padding:"5px 10px", borderRadius:"8px", background:"#fee2e2", color:"#dc2626", border:"none", cursor:"pointer", fontSize:"0.75rem", fontWeight:600 }}
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>

          {/* Botón guardar */}
          <div style={{ marginTop:"20px", display:"flex", justifyContent:"flex-end", gap:"10px", alignItems:"center" }}>
            {hasChanges && !saving && (
              <span style={{ fontSize:"0.8rem", color:"#d97706" }}>Hay cambios sin guardar</span>
            )}
            <button
              onClick={saveEdits}
              disabled={!hasChanges || saving}
              style={{ padding:"10px 28px", borderRadius:"10px", background: hasChanges?"#1e3a5f":"#e2e8f0", color: hasChanges?"white":"#94a3b8", border:"none", cursor: hasChanges?"pointer":"default", fontWeight:700, fontSize:"0.9rem" }}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
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
// ALERTAS DE RIESGO ACADÉMICO (vista docente)
// ═══════════════════════════════════════════════════════════════════
function TeacherRiskTab({ user, subjects }) {
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const teacherGrades = await getGradesForTeacherAndSubjects(user.uid, subjects || []);
    const studentMap = {};
    teacherGrades.forEach(g => {
      if (!studentMap[g.studentId]) {
        studentMap[g.studentId] = {
          student: { id:g.studentId, name:g.studentName||"Desconocido", grade:g.studentGrade||"" },
          grades: [],
        };
      }
      studentMap[g.studentId].grades.push(g);
    });
    const ORDER = { critical:0, warning:1, ok:2 };
    const result = Object.values(studentMap)
      .map(({ student, grades }) => analyzeStudentRisk(student, grades))
      .sort((a,b) => ORDER[a.level]-ORDER[b.level] || (a.globalAvg??10)-(b.globalAvg??10));
    setAnalyses(result);
    setLoading(false);
  }

  return <RiskAlertsPanel analyses={analyses} loading={loading} />;
}

// PRÓXIMAS EVALUACIONES
// ═══════════════════════════════════════════════════════════════════
const UPCOMING_EMPTY_FORM = { title:"", type:"Examen", grade:"", dateStart:new Date().toISOString().split("T")[0], dateEnd:"", trimester:1, description:"" };

function UpcomingTab({ user, profile, subject, setSaving }) {
  const [vigentes, setVigentes] = useState([]);
  const [pasadas, setPasadas] = useState([]);
  const [loadedPasadas, setLoadedPasadas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = crear, string = editar
  const [form, setForm] = useState(UPCOMING_EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadVigentes(); }, []);
  async function loadVigentes() { setLoading(true); const r=await getUpcomingByTeacher(user.uid); setVigentes(r); setLoading(false); }
  async function loadPasadas() { const r=await getUpcomingPastByTeacher(user.uid); setPasadas(r); setLoadedPasadas(true); }

  function openNew() { setEditingId(null); setForm(UPCOMING_EMPTY_FORM); setShowForm(true); }
  function openEdit(u) {
    setEditingId(u.id);
    setForm({ title:u.title||"", type:u.type||"Examen", grade:u.grade||"", dateStart:u.dateStart||new Date().toISOString().split("T")[0], dateEnd:u.dateEnd||"", trimester:u.trimester||1, description:u.description||"" });
    setShowForm(true);
  }
  function cancelForm() { setShowForm(false); setEditingId(null); setForm(UPCOMING_EMPTY_FORM); }

  async function saveUpcoming() {
    if (!form.title||!form.dateEnd||!form.grade) { alert("Completá título, año y fecha de fin"); return; }
    setSaving(true);
    const teacherName = profile.name || "";
    if (editingId) {
      await updateUpcoming(editingId, user.uid, { ...form });
      setVigentes(prev => prev.map(u => u.id===editingId ? { ...u, ...form } : u));
    } else {
      const data = { ...form, teacherId:user.uid, teacherName, subject };
      const id = await createUpcoming(data);
      setVigentes(prev => [...prev, { id, ...data }]);
    }
    cancelForm();
    setSaving(false);
  }

  async function removeUpcoming(id) { setSaving(true); await deleteUpcoming(id,user.uid); setVigentes(prev=>prev.filter(u=>u.id!==id)); setSaving(false); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>Próximas evaluaciones</h2>
        {!showForm && <button className="btn-primary" onClick={openNew}>+ Publicar evaluación</button>}
      </div>

      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #e0e7ff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <h3 style={{ margin:0, color:"#1e3a5f", fontSize:"1rem" }}>{editingId ? "✏️ Editar evaluación" : "Nueva evaluación"}</h3>
            <button onClick={cancelForm} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:"1.2rem" }}>✕</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
            <div><label>Título</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej: Parcial Unidad 3" /></div>
            <div><label>Tipo</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{["Examen","Trabajo Práctico","Exposición","Proyecto","Parcial","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label>Año/Curso</label><select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}><option value="">Seleccionar...</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
            <div><label>Trimestre</label><select value={form.trimester} onChange={e=>setForm({...form,trimester:parseInt(e.target.value)})}>{trimNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>
            <div><label>Fecha inicio</label><input type="date" value={form.dateStart} onChange={e=>setForm({...form,dateStart:e.target.value})} /></div>
            <div><label>Fecha límite</label><input type="date" value={form.dateEnd} onChange={e=>setForm({...form,dateEnd:e.target.value})} /></div>
            <div style={{ gridColumn:"1/-1" }}><label>Descripción (opcional)</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit" }} /></div>
          </div>
          <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
            <button className="btn-primary" onClick={saveUpcoming}>{editingId ? "Guardar cambios" : "Publicar evaluación"}</button>
            <button onClick={cancelForm} style={{ padding:"10px 20px", borderRadius:"10px", border:"1px solid #e2e8f0", background:"white", color:"#64748b", cursor:"pointer", fontWeight:600 }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign:"center",padding:"40px",color:"#94a3b8" }}>Cargando...</div> : (
        <>
          {vigentes.length===0 ? (
            <div className="card" style={{ padding:"32px",textAlign:"center",color:"#94a3b8" }}><p>No hay evaluaciones vigentes publicadas</p></div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
              {vigentes.map(u => (
                <div key={u.id} className="card" style={{ padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700,color:"#1e293b" }}>{u.title}</div>
                    <div style={{ fontSize:"0.82rem",color:"#64748b" }}>{u.subject} · {u.grade} · {trimNames[u.trimester-1]}</div>
                    <div style={{ fontSize:"0.78rem",color:"#94a3b8",marginTop:"2px" }}>hasta {u.dateEnd}</div>
                    {u.description && <div style={{ fontSize:"0.8rem",color:"#475569",marginTop:"4px" }}>{u.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:"8px", flexShrink:0 }}>
                    <button onClick={()=>openEdit(u)} style={{ padding:"6px 14px", borderRadius:"8px", background:"#dbeafe", color:"#1e40af", border:"none", cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>✏️ Editar</button>
                    <button className="btn-danger" onClick={()=>removeUpcoming(u.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:"20px",textAlign:"center" }}>
            {!loadedPasadas ? (
              <button onClick={loadPasadas} style={{ background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:"0.85rem",textDecoration:"underline" }}>Ver evaluaciones pasadas</button>
            ) : (
              pasadas.length>0 && <div style={{ display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px" }}>{pasadas.map(u=><div key={u.id} className="card" style={{ padding:"12px 16px",opacity:0.6,fontSize:"0.85rem" }}><span style={{ fontWeight:600 }}>{u.title}</span> · {u.grade} · hasta {u.dateEnd}</div>)}</div>
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
function StudentGradesTab({ user, subject, subjects, setSaving }) {
  const [mode, setMode] = useState("bulk"); // "bulk" | "individual"
  const [allTeacherGrades, setAllTeacherGrades] = useState(null); // null = no cargado aún
  const [loadingAll, setLoadingAll] = useState(false);
  const [externalGrades, setExternalGrades] = useState([]);

  useEffect(() => {
    getAllExternalGrades().then(setExternalGrades);
  }, []);

  // ── Modo individual ──
  const [nameQ, setNameQ] = useState("");
  const [gradeQ, setGradeQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [editingTrim, setEditingTrim] = useState(null); // trimestre que se está editando (1,2,3)
  const [editValue, setEditValue] = useState("");

  // Cargar notas del profe + sus materias (incluye reemplazos)
  async function ensureTeacherGrades() {
    if (allTeacherGrades !== null) return allTeacherGrades;
    setLoadingAll(true);
    const g = await getGradesForTeacherAndSubjects(user.uid, subjects || []);
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

  async function saveExtOverride(trim) {
    const val = parseFloat(editValue.replace(",","."));
    if (isNaN(val) || val < 0 || val > 10) { alert("Ingresá un valor entre 0 y 10"); return; }
    setSaving(true);
    await upsertExternalGrade({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentGrade: selectedStudent.grade || "",
      subject,
      trimester: trim,
      average: val,
      createdBy: user.uid,
    });
    const updated = await getAllExternalGrades();
    setExternalGrades(updated);
    setEditingTrim(null);
    setSaving(false);
  }

  async function deleteExtOverride(trim) {
    const entry = externalGrades.find(e =>
      e.studentId === selectedStudent?.id && e.subject === subject && e.trimester === trim
    );
    if (!entry) return;
    setSaving(true);
    await deleteExternalGrade(entry.id);
    const updated = await getAllExternalGrades();
    setExternalGrades(updated);
    setSaving(false);
  }

  // Lookup de overrides para el alumno seleccionado
  const extOverride = {};
  externalGrades.forEach(e => {
    if (e.studentId === selectedStudent?.id && e.subject === subject) {
      extOverride[e.trimester] = e.average;
    }
  });

  async function doSearch() {
    if (!nameQ && !gradeQ) return;
    setSearching(true);
    const r = await searchStudents({ name: nameQ, grade: gradeQ });
    setSearchResults(r);
    setSearching(false);
  }

  async function selectStudent(s) {
    setSelectedStudent(s);
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

  function navigateStudent(dir) {
    const idx = searchResults.findIndex(s => s.id === selectedStudent?.id);
    const next = searchResults[idx + dir];
    if (next) selectStudent(next);
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
          externalGrades={externalGrades}
          loadingAll={loadingAll}
          ensureTeacherGrades={ensureTeacherGrades}
          onSelectStudent={(s) => { handleModeChange("individual"); selectStudent(s); }}
          setExternalGrades={setExternalGrades}
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
              <div className="card" style={{ padding:"16px 24px", marginBottom:"20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#1e293b", fontSize:"1.05rem" }}>{selectedStudent.name}</div>
                  <div style={{ display:"flex", gap:"8px", marginTop:"4px", flexWrap:"wrap" }}>
                    <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{selectedStudent.grade}</span>
                    <span className="badge" style={{ background:"#d1fae5", color:"#065f46" }}>{subject}</span>
                    {searchResults.length > 1 && (
                      <span style={{ fontSize:"0.75rem", color:"#94a3b8" }}>
                        {searchResults.findIndex(s=>s.id===selectedStudent.id)+1} de {searchResults.length}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                  {searchResults.length > 1 && (
                    <>
                      <button
                        onClick={() => navigateStudent(-1)}
                        disabled={searchResults.findIndex(s=>s.id===selectedStudent.id) === 0}
                        style={{ padding:"8px 14px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#1e3a5f", fontSize:"0.85rem", fontWeight:600, opacity: searchResults.findIndex(s=>s.id===selectedStudent.id)===0 ? 0.3 : 1 }}
                      >← Anterior</button>
                      <button
                        onClick={() => navigateStudent(1)}
                        disabled={searchResults.findIndex(s=>s.id===selectedStudent.id) === searchResults.length - 1}
                        style={{ padding:"8px 14px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#1e3a5f", fontSize:"0.85rem", fontWeight:600, opacity: searchResults.findIndex(s=>s.id===selectedStudent.id)===searchResults.length-1 ? 0.3 : 1 }}
                      >Siguiente →</button>
                    </>
                  )}
                  <button onClick={clearStudent} style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #e2e8f0", cursor:"pointer", background:"white", color:"#64748b", fontSize:"0.85rem" }}>
                    Buscar otro
                  </button>
                </div>
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
                      {(() => {
                        const trimAvgs = [1,2,3].map(t => byTrim[t].length > 0 ? parseFloat(avg(byTrim[t].map(g=>g.score))) : null).filter(v=>v!==null);
                        const generalAvgVal = trimAvgs.length > 0 ? avg(trimAvgs) : "–";
                        return <>
                          <div style={{ fontSize:"2rem", fontWeight:800, color: generalAvgVal==="–"?"#94a3b8":scoreColor(parseFloat(generalAvgVal)), fontFamily:"'Playfair Display',serif" }}>
                            {generalAvgVal}
                          </div>
                          <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Promedio anual</div>
                        </>;
                      })()}
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
                    if (tGrades.length === 0 && extOverride[t] === undefined) return null;
                    const computedAvg = tGrades.length > 0 ? avg(tGrades.map(g => g.score)) : null;
                    const hasOverride = extOverride[t] !== undefined;
                    const displayAvg = hasOverride ? String(extOverride[t]) : (computedAvg || "–");
                    const displayNum = parseFloat(displayAvg);
                    return (
                      <div key={t} style={{ marginBottom:"20px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
                          <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0, fontSize:"1.05rem" }}>{trimNames[t-1]}</h3>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                            {tGrades.length > 0 && <span style={{ fontSize:"0.78rem", color:"#64748b" }}>{tGrades.length} eval.</span>}
                            {hasOverride && computedAvg && (
                              <span style={{ fontSize:"0.76rem", color:"#94a3b8", textDecoration:"line-through" }}>{computedAvg}</span>
                            )}
                            <span style={{ fontWeight:800, fontSize:"1.2rem", color:isNaN(displayNum)?"#94a3b8":scoreColor(displayNum), fontFamily:"'Playfair Display',serif" }}>{displayAvg}</span>
                            {hasOverride && <span style={{ fontSize:"0.72rem", background:"#fef3c7", color:"#92400e", border:"1px solid #fde68a", borderRadius:"10px", padding:"1px 7px", fontWeight:700 }}>✏️ editado</span>}
                            <span style={{ fontSize:"0.72rem", color:"#94a3b8" }}>prom.</span>
                            {editingTrim === t ? (
                              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                                <input
                                  type="number" min="0" max="10" step="0.01"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && saveExtOverride(t)}
                                  style={{ width:"70px", padding:"4px 8px", borderRadius:"6px", border:"1.5px solid #3b82f6", fontSize:"0.88rem", textAlign:"center" }}
                                  autoFocus
                                />
                                <button onClick={() => saveExtOverride(t)} style={{ padding:"4px 10px", borderRadius:"6px", background:"#3b82f6", border:"none", color:"white", fontWeight:700, cursor:"pointer", fontSize:"0.82rem" }}>✓</button>
                                <button onClick={() => setEditingTrim(null)} style={{ padding:"4px 10px", borderRadius:"6px", background:"#f1f5f9", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.82rem" }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display:"flex", gap:"4px" }}>
                                <button
                                  onClick={() => { setEditingTrim(t); setEditValue(hasOverride ? String(extOverride[t]) : (computedAvg || "")); }}
                                  title="Editar promedio del trimestre"
                                  style={{ padding:"3px 8px", borderRadius:"6px", background:"#eff6ff", border:"1px solid #bfdbfe", color:"#2563eb", cursor:"pointer", fontSize:"0.78rem", fontWeight:700 }}>
                                  ✏️ Editar
                                </button>
                                {hasOverride && (
                                  <button
                                    onClick={() => deleteExtOverride(t)}
                                    title="Quitar override"
                                    style={{ padding:"3px 8px", borderRadius:"6px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", cursor:"pointer", fontSize:"0.78rem" }}>
                                    ✕
                                  </button>
                                )}
                              </div>
                            )}
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
function BulkAveragesView({ user, subject, allTeacherGrades, externalGrades, setExternalGrades, loadingAll, ensureTeacherGrades, onSelectStudent }) {
  const extLookup = {};
  (externalGrades || []).forEach(e => { extLookup[`${e.studentId}__${e.subject}__${e.trimester}`] = e.average; });
  const [selectedGrade, setSelectedGrade] = useState(GRADES[0]);
  const [courseStudents, setCourseStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedCell, setExpandedCell] = useState(null); // {studentId, trim}
  const [editingCell, setEditingCell] = useState(null); // {studentId, trim}
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveOverride(studentId, studentName, studentGradeYear, trim) {
    const val = parseFloat(editValue.replace(",","."));
    if (isNaN(val) || val < 0 || val > 10) { alert("Ingresá un valor entre 0 y 10"); return; }
    setSaving(true);
    await upsertExternalGrade({ studentId, studentName, studentGrade: studentGradeYear || "", subject, trimester: trim, average: val, createdBy: user.uid });
    const updated = await getAllExternalGrades();
    setExternalGrades(updated);
    setEditingCell(null);
    setSaving(false);
  }

  async function removeOverride(studentId, trim) {
    const entry = (externalGrades || []).find(e => e.studentId === studentId && e.subject === subject && e.trimester === trim);
    if (!entry) return;
    setSaving(true);
    await deleteExternalGrade(entry.id);
    const updated = await getAllExternalGrades();
    setExternalGrades(updated);
    setSaving(false);
  }

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

  // Calcular promedio de un alumno en un trimestre (con soporte de overrides)
  function trimAvg(studentId, trim) {
    const extKey = `${studentId}__${subject}__${trim}`;
    if (extLookup[extKey] !== undefined) return String(extLookup[extKey]);
    if (!allTeacherGrades) return "–";
    const gs = allTeacherGrades.filter(
      g => g.studentId === studentId && g.subject === subject && g.trimester === trim
    );
    return gs.length > 0 ? avg(gs.map(g => g.score)) : "–";
  }

  function generalAvg(studentId) {
    const trimAvgs = [1, 2, 3].map(trim => {
      const v = trimAvg(studentId, trim);
      return v !== "–" ? parseFloat(v) : null;
    }).filter(v => v !== null);
    return trimAvgs.length > 0 ? avg(trimAvgs) : "–";
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
                  <th key={i} style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>{n} <span style={{ fontWeight:400, fontSize:"0.7rem", opacity:0.7 }}>▾</span></th>
                ))}
                <th style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>Prom. Anual <span style={{ fontWeight:400, fontSize:"0.7rem", opacity:0.7 }}>▾</span></th>
                <th style={{ padding:"12px 16px", textAlign:"center", fontWeight:600, fontSize:"0.85rem" }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {courseStudents.flatMap((s, idx) => {
                const t1 = trimAvg(s.id, 1);
                const t2 = trimAvg(s.id, 2);
                const t3 = trimAvg(s.id, 3);
                const ga = generalAvg(s.id);
                const gaNum = parseFloat(ga);
                const isAnyExp = expandedCell?.studentId === s.id;
                const allSg = allTeacherGrades ? allTeacherGrades.filter(g => g.studentId===s.id && g.subject===subject) : [];

                function cellGrades(trim) {
                  return allTeacherGrades ? allTeacherGrades.filter(g => g.studentId===s.id && g.subject===subject && g.trimester===trim) : [];
                }
                function toggleCell(trim) {
                  setExpandedCell(prev => prev?.studentId===s.id && prev?.trim===trim ? null : { studentId:s.id, trim });
                }

                const rows = [
                  <tr key={s.id} style={{ borderBottom: isAnyExp?"none":"1px solid #f1f5f9", background: idx%2===0?"white":"#f8fafc" }}>
                    <td style={{ padding:"12px 16px", fontWeight:600, color:"#1e293b" }}>{s.name}</td>
                    {[1,2,3].map(trim => {
                      const v = trim===1?t1:trim===2?t2:t3;
                      const vNum = parseFloat(v);
                      const gs = cellGrades(trim);
                      const isExp = expandedCell?.studentId===s.id && expandedCell?.trim===trim;
                      const extKey = `${s.id}__${subject}__${trim}`;
                      const hasOverride = extLookup[extKey] !== undefined;
                      const isEditing = editingCell?.studentId===s.id && editingCell?.trim===trim;
                      return (
                        <td key={trim} style={{ padding:"8px 12px", textAlign:"center", background:isExp?"#dbeafe":hasOverride?"#fefce8":"inherit", transition:"background 0.15s", minWidth:"110px" }}>
                          {isEditing ? (
                            <div style={{ display:"flex", alignItems:"center", gap:"4px", justifyContent:"center" }}>
                              <input
                                type="number" min="0" max="10" step="0.01"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if(e.key==="Enter") saveOverride(s.id, s.name, s.grade, trim); if(e.key==="Escape") setEditingCell(null); }}
                                style={{ width:"60px", padding:"3px 6px", borderRadius:"6px", border:"1.5px solid #3b82f6", fontSize:"0.88rem", textAlign:"center" }}
                                autoFocus
                                disabled={saving}
                              />
                              <button onClick={() => saveOverride(s.id, s.name, s.grade, trim)} disabled={saving}
                                style={{ padding:"3px 7px", borderRadius:"5px", background:"#3b82f6", border:"none", color:"white", fontWeight:700, cursor:"pointer", fontSize:"0.78rem" }}>✓</button>
                              <button onClick={() => setEditingCell(null)}
                                style={{ padding:"3px 7px", borderRadius:"5px", background:"#f1f5f9", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.78rem" }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                                <span style={{ fontWeight:700, color: v==="–"?"#cbd5e1":scoreColor(vNum), fontSize:"1rem" }}>{v}</span>
                                {gs.length>0 && <span onClick={() => toggleCell(trim)} style={{ fontSize:"0.65rem", color:"#93c5fd", cursor:"pointer" }}>{isExp?"▲":"▼"}</span>}
                              </div>
                              <div style={{ display:"flex", gap:"3px" }}>
                                <button
                                  onClick={() => { setEditingCell({studentId:s.id,trim}); setEditValue(hasOverride?String(extLookup[extKey]):(v!=="–"?v:"")); setExpandedCell(null); }}
                                  style={{ padding:"1px 6px", borderRadius:"4px", background:"#eff6ff", border:"1px solid #bfdbfe", color:"#2563eb", cursor:"pointer", fontSize:"0.68rem", fontWeight:700 }}>
                                  ✏️
                                </button>
                                {hasOverride && (
                                  <button onClick={() => removeOverride(s.id, trim)}
                                    style={{ padding:"1px 6px", borderRadius:"4px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", cursor:"pointer", fontSize:"0.68rem" }}>
                                    ✕
                                  </button>
                                )}
                              </div>
                              {hasOverride && <span style={{ fontSize:"0.6rem", color:"#92400e", fontWeight:700 }}>editado</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td onClick={() => allSg.length>0 && toggleCell(0)}
                        style={{ padding:"12px 16px", textAlign:"center", cursor:allSg.length>0?"pointer":"default", background:expandedCell?.studentId===s.id&&expandedCell?.trim===0?"#dbeafe":"inherit", transition:"background 0.15s" }}>
                      <span style={{ fontWeight:800, fontSize:"1.1rem", color: ga==="–"?"#cbd5e1":scoreColor(gaNum), fontFamily:"'Playfair Display',serif" }}>{ga}</span>
                      {allSg.length>0 && <span style={{ marginLeft:"3px", fontSize:"0.65rem", color:"#93c5fd" }}>{expandedCell?.studentId===s.id&&expandedCell?.trim===0?"▲":"▼"}</span>}
                    </td>
                    <td style={{ padding:"12px 16px", textAlign:"center" }}>
                      <button onClick={() => onSelectStudent(s)} style={{ padding:"5px 14px", borderRadius:"20px", background:"#dbeafe", color:"#1e40af", border:"none", cursor:"pointer", fontSize:"0.8rem", fontWeight:600 }}>
                        Ver →
                      </button>
                    </td>
                  </tr>
                ];

                if (isAnyExp) {
                  const expandGrades = expandedCell.trim === 0
                    ? allSg.sort((a,b) => a.trimester-b.trimester || a.date.localeCompare(b.date))
                    : cellGrades(expandedCell.trim);
                  rows.push(
                    <tr key={`${s.id}_exp`} style={{ background:"#eff6ff", borderBottom:"1px solid #bfdbfe" }}>
                      <td colSpan={6} style={{ padding:"12px 20px" }}>
                        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                          {expandGrades.map(g => (
                            <div key={g.id} style={{ background:"white", border:`2px solid ${scoreColor(g.score)}`, borderRadius:"10px", padding:"8px 14px", minWidth:"110px" }}>
                              <div style={{ fontWeight:800, color:scoreColor(g.score), fontSize:"1.1rem", fontFamily:"'Playfair Display',serif", lineHeight:1 }}>
                                {g.score}<span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:400 }}>/10</span>
                              </div>
                              <div style={{ fontSize:"0.78rem", fontWeight:600, color:"#1e293b", marginTop:"3px" }}>{g.type}</div>
                              <div style={{ fontSize:"0.72rem", color:"#94a3b8" }}>{g.date}{expandedCell.trim===0 && <span style={{ marginLeft:"4px", background:"#e0e7ff", color:"#4338ca", borderRadius:"4px", padding:"0 4px", fontSize:"0.65rem" }}>T{g.trimester}</span>}</div>
                              {g.note && <div style={{ fontSize:"0.7rem", color:"#7c3aed", marginTop:"2px" }}>💬 {g.note}</div>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
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

// ═══════════════════════════════════════════════════════════════════
// OBSERVACIONES INTERNAS — vista del profesor
// Solo ve las propias; no puede ver las de otros profesores
// ═══════════════════════════════════════════════════════════════════
function InternalObsTeacherTab({ user, profile, setSaving }) {
  const currentMonth = new Date().toISOString().slice(0, 7); // "2025-06"
  const [obs, setObs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId:"", studentName:"", studentGrade:"", text:"", month:currentMonth, date:new Date().toISOString().split("T")[0] });
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await getInternalObsByTeacher(user.uid);
    setObs(r); setLoaded(true); setLoading(false);
  }

  async function save() {
    if (!form.studentId || !form.text.trim() || !form.month) { alert("Seleccioná un alumno, mes y escribí la observación"); return; }
    setSaving(true);
    const data = { ...form, teacherId: user.uid, teacherName: profile.name || "" };
    const id = await createInternalObs(data);
    setObs(prev => [{ id, ...data }, ...prev]);
    setForm({ studentId:"", studentName:"", studentGrade:"", text:"", month:currentMonth, date:new Date().toISOString().split("T")[0] });
    setShowForm(false); setSaving(false);
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    setSaving(true);
    await updateInternalObs(id, user.uid, { text: editText });
    setObs(prev => prev.map(o => o.id === id ? { ...o, text: editText } : o));
    setEditingId(null); setSaving(false);
  }

  async function remove(id) {
    if (!confirm("¿Eliminar esta observación interna?")) return;
    setSaving(true);
    await deleteInternalObs(id, user.uid);
    setObs(prev => prev.filter(o => o.id !== id)); setSaving(false);
  }

  const filtered = obs.filter(o => !monthFilter || o.month === monthFilter);
  const byStudent = {};
  filtered.forEach(o => {
    if (!byStudent[o.studentId]) byStudent[o.studentId] = { name: o.studentName, grade: o.studentGrade, items: [] };
    byStudent[o.studentId].items.push(o);
  });

  const monthLabel = (m) => { if (!m) return ""; const [y,mo] = m.split("-"); const names=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return `${names[parseInt(mo,10)-1]} ${y}`; };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0 }}>🔒 Observaciones Internas</h2>
        <button className="btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?"Cancelar":"+ Nueva observación"}</button>
      </div>

      {showForm && (
        <div className="card fade" style={{ padding:"24px", marginBottom:"20px", border:"2px solid #fde68a" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <div>
              <label>Mes</label>
              <input type="month" value={form.month} onChange={e=>setForm({...form,month:e.target.value})} />
            </div>
            <div>
              <label>Fecha</label>
              <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
            </div>
          </div>
          <div style={{ marginBottom:"16px" }}>
            <label>Alumno</label>
            <StudentSearch buttonLabel="Seleccionar" onSelect={s=>setForm({...form,studentId:s.id,studentName:s.name,studentGrade:s.grade||""})} />
            {form.studentName && <span className="badge" style={{ marginTop:"8px",display:"inline-block",background:"#dbeafe",color:"#1e40af" }}>{form.studentName} {form.studentGrade&&`(${form.studentGrade})`}</span>}
          </div>
          <div style={{ marginBottom:"16px" }}>
            <label>Observación interna</label>
            <textarea value={form.text} onChange={e=>setForm({...form,text:e.target.value})} rows={4} style={{ width:"100%", border:"1.5px solid #cbd5e1", borderRadius:"10px", padding:"10px 14px", fontSize:"0.9rem", fontFamily:"inherit", boxSizing:"border-box" }} placeholder="Escribí la observación interna del alumno para este mes..." />
          </div>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      )}

      {/* Filtro de mes */}
      <div className="card" style={{ padding:"16px 20px", marginBottom:"16px", display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
        <label style={{ margin:0, fontWeight:600, color:"#1e3a5f" }}>Filtrar por mes:</label>
        <input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{ width:"180px" }} />
        {monthFilter && <button onClick={()=>setMonthFilter("")} style={{ fontSize:"0.78rem",color:"#dc2626",background:"none",border:"none",cursor:"pointer" }}>Ver todos</button>}
        <span style={{ fontSize:"0.82rem", color:"#94a3b8" }}>{filtered.length} observación{filtered.length!==1?"es":""}</span>
      </div>

      {loading && <div style={{ textAlign:"center",padding:"40px",color:"#94a3b8" }}>Cargando...</div>}

      {loaded && filtered.length===0 && (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"3rem" }}>🔒</div>
          <p>No hay observaciones internas{monthFilter ? ` para ${monthLabel(monthFilter)}` : ""}</p>
        </div>
      )}

      {Object.entries(byStudent).map(([sid, { name, grade, items }]) => (
        <div key={sid} className="card" style={{ marginBottom:"16px", overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", background:"#1e3a5f", color:"white", display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontWeight:700, fontSize:"0.95rem" }}>{name}</span>
            {grade && <span style={{ padding:"2px 10px", borderRadius:"20px", background:"rgba(255,255,255,0.15)", fontSize:"0.78rem" }}>{grade}</span>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {items.map(o => (
              <div key={o.id} style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                  <span style={{ fontWeight:600, color:"#7c3aed", fontSize:"0.82rem" }}>🗓 {monthLabel(o.month)}{o.date&&` · ${o.date}`}</span>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={()=>{ setEditingId(o.id); setEditText(o.text); }} style={{ fontSize:"0.75rem",padding:"4px 10px",borderRadius:"8px",background:"#dbeafe",color:"#1e40af",border:"none",cursor:"pointer" }}>Editar</button>
                    <button onClick={()=>remove(o.id)} className="btn-danger" style={{ fontSize:"0.75rem",padding:"4px 10px" }}>Eliminar</button>
                  </div>
                </div>
                {editingId===o.id ? (
                  <div>
                    <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3} style={{ width:"100%",border:"1.5px solid #7c3aed",borderRadius:"8px",padding:"8px 12px",fontSize:"0.88rem",fontFamily:"inherit",boxSizing:"border-box" }} />
                    <div style={{ display:"flex",gap:"8px",marginTop:"8px" }}>
                      <button className="btn-primary" onClick={()=>saveEdit(o.id)} style={{ fontSize:"0.8rem" }}>Guardar</button>
                      <button onClick={()=>setEditingId(null)} style={{ fontSize:"0.8rem" }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin:0, color:"#374151", fontSize:"0.9rem", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{o.text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
    <div style={{ marginTop:"8px" }}>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"8px" }}>
        <input value={nameQ} onChange={e=>setNameQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Nombre..." style={{ flex:1, minWidth:"140px" }} />
        <select value={gradeQ} onChange={e=>setGradeQ(e.target.value)} style={{ width:"90px" }}>
          <option value="">Año</option>
          {["1°","2°","3°","4°","5°","6°"].map(g=><option key={g}>{g}</option>)}
        </select>
        <button onClick={doSearch} disabled={loading} style={{ padding:"8px 16px",borderRadius:"8px",background:"#1e3a5f",color:"white",border:"none",cursor:"pointer",fontSize:"0.82rem" }}>{loading?"...":"Buscar"}</button>
      </div>
      {searched && results.length===0 && <p style={{ fontSize:"0.82rem",color:"#94a3b8",margin:"4px 0" }}>Sin resultados</p>}
      <div style={{ display:"flex",flexDirection:"column",gap:"4px" }}>
        {results.slice(0,5).map(s=>(
          <div key={s.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"#f8fafc",borderRadius:"8px",border:"1px solid #e2e8f0" }}>
            <span style={{ fontSize:"0.85rem" }}>{s.name} <span style={{ color:"#94a3b8" }}>({s.grade})</span></span>
            <button onClick={()=>{ onSelect(s); setResults([]); setNameQ(""); setGradeQ(""); setSearched(false); }} style={{ fontSize:"0.78rem",padding:"4px 10px",borderRadius:"6px",background:"#1e3a5f",color:"white",border:"none",cursor:"pointer" }}>{buttonLabel}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// NOTAS EXTERNAS — versión profesor (usa sus propias materias)
// ════════════════════════════════════════════════════════════════════
function TeacherExternalGradesTab({ profile, subjects }) {
  const [students, setStudents] = useState([]);
  const [externalGrades, setExternalGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ studentId:"", subject: subjects[0]||"", trimester:"1", average:"" });
  const [filterSubject, setFilterSubject] = useState("");

  useEffect(() => {
    Promise.all([getAllStudents(), getAllExternalGrades()]).then(([s, e]) => {
      setStudents(s);
      setExternalGrades(e.filter(eg => subjects.includes(eg.subject)));
      setLoading(false);
    });
  }, []);

  const selectedStudent = students.find(s => s.id === form.studentId);
  const filteredStudents = search.trim()
    ? students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : students;

  async function handleAdd() {
    if (!form.studentId || !form.subject || !form.average) return;
    const a = parseFloat(form.average);
    if (isNaN(a) || a < 1 || a > 10) return;
    setSaving(true);
    const st = students.find(s => s.id === form.studentId);
    await addExternalGrade({
      studentId: form.studentId,
      studentName: st?.name || "–",
      studentGrade: st?.grade || "–",
      subject: form.subject,
      trimester: parseInt(form.trimester),
      average: a,
      createdBy: profile?.email || "–",
    });
    const all = await getAllExternalGrades();
    setExternalGrades(all.filter(eg => subjects.includes(eg.subject)));
    setForm(f => ({ ...f, average:"" }));
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta nota externa?")) return;
    await deleteExternalGrade(id);
    setExternalGrades(eg => eg.filter(e => e.id !== id));
  }

  const displayGrades = filterSubject
    ? externalGrades.filter(e => e.subject === filterSubject)
    : externalGrades;

  if (loading) return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div>;

  return (
    <div>
      <div className="card" style={{ padding:"20px 24px", marginBottom:"24px" }}>
        <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 16px", fontSize:"1.1rem" }}>
          🏫 Cargar nota de ingreso (otro colegio)
        </h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#64748b", marginBottom:"4px" }}>Alumno</div>
            <input type="text" placeholder="🔍 Buscar por nombre..." value={search}
              onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, studentId:"" })); }}
              style={{ width:"100%", padding:"8px 12px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.9rem", boxSizing:"border-box" }} />
            {search && !form.studentId && (
              <div style={{ border:"1px solid #e2e8f0", borderRadius:"8px", marginTop:"4px", maxHeight:"180px", overflowY:"auto", background:"white" }}>
                {filteredStudents.length === 0
                  ? <div style={{ padding:"12px", color:"#94a3b8", fontSize:"0.85rem" }}>Sin resultados</div>
                  : filteredStudents.map(s => (
                    <div key={s.id} onClick={() => { setForm(f => ({ ...f, studentId:s.id })); setSearch(s.name); }}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f1f5f9", fontSize:"0.88rem" }}>
                      <strong>{s.name}</strong> <span style={{ color:"#94a3b8" }}>{s.grade}</span>
                    </div>
                  ))
                }
              </div>
            )}
            {selectedStudent && <div style={{ marginTop:"6px", fontSize:"0.8rem", color:"#059669", fontWeight:600 }}>✓ {selectedStudent.name} ({selectedStudent.grade})</div>}
          </div>
          <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
            <div style={{ flex:"2 1 200px" }}>
              <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#64748b", marginBottom:"4px" }}>Materia</div>
              <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject:e.target.value }))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }}>
                <option value="">Seleccionar materia...</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex:"1 1 120px" }}>
              <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#64748b", marginBottom:"4px" }}>Trimestre</div>
              <select value={form.trimester} onChange={e => setForm(f => ({ ...f, trimester:e.target.value }))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }}>
                <option value="1">1° Trimestre</option>
                <option value="2">2° Trimestre</option>
                <option value="3">3° Trimestre</option>
              </select>
            </div>
            <div style={{ flex:"1 1 120px" }}>
              <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#64748b", marginBottom:"4px" }}>Promedio (1–10)</div>
              <input type="number" min="1" max="10" step="0.01" value={form.average}
                onChange={e => setForm(f => ({ ...f, average:e.target.value }))} placeholder="ej: 7.50"
                style={{ width:"100%", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem", boxSizing:"border-box" }} />
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !form.studentId || !form.subject || !form.average}
            className="btn-primary" style={{ alignSelf:"flex-start", padding:"10px 24px" }}>
            {saving ? "Guardando..." : "➕ Agregar nota externa"}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", flexWrap:"wrap", gap:"10px" }}>
        <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0, fontSize:"1rem" }}>
          Notas externas cargadas ({externalGrades.length})
        </h3>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {["", ...subjects].map(s => (
            <button key={s} onClick={() => setFilterSubject(s)}
              style={{ padding:"4px 10px", borderRadius:"20px", border:`1px solid ${filterSubject===s?"#1e3a5f":"#e2e8f0"}`, background:filterSubject===s?"#1e3a5f":"white", color:filterSubject===s?"white":"#64748b", cursor:"pointer", fontSize:"0.76rem", fontWeight:600 }}>
              {s || "Todas"}
            </button>
          ))}
        </div>
      </div>

      {displayGrades.length === 0 ? (
        <div className="card" style={{ padding:"40px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2.5rem" }}>🏫</div>
          <p>No hay notas externas cargadas{filterSubject ? ` para ${filterSubject}` : ""}.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.87rem" }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                {["Alumno","Curso","Materia","Trimestre","Promedio",""].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#64748b", fontSize:"0.76rem", textTransform:"uppercase", letterSpacing:"0.4px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayGrades.map(e => (
                <tr key={e.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"9px 14px", fontWeight:600, color:"#1e293b" }}>{e.studentName}</td>
                  <td style={{ padding:"9px 14px" }}><span style={{ padding:"2px 8px", borderRadius:"12px", background:"#dbeafe", color:"#1e40af", fontSize:"0.73rem", fontWeight:700 }}>{e.studentGrade}</span></td>
                  <td style={{ padding:"9px 14px", color:"#475569" }}>{e.subject}</td>
                  <td style={{ padding:"9px 14px" }}><span style={{ fontWeight:600, color:"#7c3aed" }}>{trimNames[e.trimester-1]}</span></td>
                  <td style={{ padding:"9px 14px" }}><span style={{ fontWeight:800, fontSize:"1.1rem", color:scoreColor(e.average), fontFamily:"'Playfair Display',serif" }}>{e.average}</span></td>
                  <td style={{ padding:"9px 14px" }}><button onClick={() => handleDelete(e.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:"1rem" }}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CIERRE DE NOTAS — versión profesor (solo sus materias)
// ════════════════════════════════════════════════════════════════════
function TeacherCierreTab({ grades }) {
  const [externalGrades, setExternalGrades] = useState([]);
  const [activeIds, setActiveIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([getAllExternalGrades(), getAllStudents()]).then(([e, s]) => {
      setExternalGrades(e);
      setActiveIds(new Set(s.map(x => x.id)));
      setLoading(false);
    });
  }, []);

  const externalLookup = {};
  externalGrades.forEach(e => { externalLookup[`${e.studentId}__${e.subject}__${e.trimester}`] = e.average; });

  const allSubjectsSet = new Set([...grades.map(g => g.subject).filter(Boolean), ...externalGrades.map(e => e.subject)]);
  const allSubjects = [...allSubjectsSet].sort();

  const rows = (() => {
    if (!activeIds) return [];
    const map = {};
    grades.forEach(g => {
      if (!g.studentId || !activeIds.has(g.studentId)) return;
      if (!map[g.studentId]) map[g.studentId] = { name: g.studentName||"–", grade: g.studentGrade||"", subjects:{} };
      if (!map[g.studentId].subjects[g.subject]) map[g.studentId].subjects[g.subject] = {1:[],2:[],3:[]};
      map[g.studentId].subjects[g.subject][g.trimester].push(g.score);
    });
    externalGrades.forEach(e => {
      if (!activeIds.has(e.studentId)) return;
      if (!map[e.studentId]) map[e.studentId] = { name: e.studentName||"–", grade: e.studentGrade||"", subjects:{} };
      if (!map[e.studentId].subjects[e.subject]) map[e.studentId].subjects[e.subject] = {1:[],2:[],3:[]};
    });

    const result = [];
    Object.entries(map).forEach(([studentId, sData]) => {
      Object.entries(sData.subjects).forEach(([subject, trimData]) => {
        const t = [1,2,3].map(trim => {
          const extKey = `${studentId}__${subject}__${trim}`;
          if (externalLookup[extKey] !== undefined) return externalLookup[extKey];
          const scores = trimData[trim];
          return scores.length ? parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)) : null;
        });

        if (t[0]===null && t[1]===null && t[2]===null) return;

        const finalAvg = (t[0]!==null && t[1]!==null && t[2]!==null)
          ? parseFloat(((t[0]+t[1]+t[2])/3).toFixed(2))
          : null;

        const failedTrims = [1,2,3].filter(i => t[i-1] !== null && t[i-1] < 7);

        let status, rendirTrim;
        if (finalAvg === null) {
          status = "incompleto"; rendirTrim = null;
        } else if (finalAvg >= 6.90) {
          if (t[2] !== null && t[2] < 7) {
            status = "rendir"; rendirTrim = "3° Trim.";
          } else {
            status = "aprueba"; rendirTrim = null;
          }
        } else {
          status = "rendir";
          rendirTrim = failedTrims.length === 3
            ? "Materia completa"
            : failedTrims.map(i => `${i}° Trim.`).join(" y ");
        }

        result.push({ studentId, name: sData.name, grade: sData.grade, subject, t, finalAvg, status, rendirTrim });
      });
    });

    return result.sort((a,b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      return a.name.localeCompare(b.name);
    });
  })();

  const filtered = rows.filter(r => {
    if (filterGrade && r.grade !== filterGrade) return false;
    if (filterSubject && r.subject !== filterSubject) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byGrade = {};
  filtered.forEach(r => { if (!byGrade[r.grade]) byGrade[r.grade] = []; byGrade[r.grade].push(r); });

  const counts = { aprueba: filtered.filter(r=>r.status==="aprueba").length, rendir: filtered.filter(r=>r.status==="rendir").length, incompleto: filtered.filter(r=>r.status==="incompleto").length };

  if (loading) return <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap", alignItems:"flex-end" }}>
        <input type="text" placeholder="🔍 Buscar alumno..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ flex:"2 1 160px", padding:"8px 12px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }} />
        <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)}
          style={{ flex:"1 1 110px", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }}>
          <option value="">Todos los cursos</option>
          {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)}
          style={{ flex:"2 1 180px", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }}>
          <option value="">Todas las materias</option>
          {allSubjects.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{ flex:"1 1 160px", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #e2e8f0", fontSize:"0.88rem" }}>
          <option value="">Todos los resultados</option>
          <option value="aprueba">✅ Solo aprueban</option>
          <option value="rendir">📝 Solo deben rendir</option>
          <option value="incompleto">⏳ Solo sin completar</option>
        </select>
        <button onClick={() => {
          const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
          const materia = filtered[0]?.subject || "Informe";
          doc.setFontSize(14);
          doc.setFont("helvetica","bold");
          doc.text(`Cierre de Notas – ${materia}`, 14, 16);
          doc.setFontSize(9);
          doc.setFont("helvetica","normal");
          doc.text(`* Prom. >= 6.90: aprueba. T3 < 7: debe rendir 3° Trim. aunque el promedio supere 6.90.`, 14, 22);
          let y = 28;
          Object.entries(byGrade).sort(([a],[b])=>a.localeCompare(b)).forEach(([grade, gRows]) => {
            doc.setFontSize(11); doc.setFont("helvetica","bold");
            doc.text(grade, 14, y); y += 5;
            autoTable(doc, {
              startY: y,
              head: [["Alumno","T1","T2","T3","Prom. Final","Resultado"]],
              body: gRows.map(r => [
                r.name,
                r.t[0]!==null ? r.t[0] : "–",
                r.t[1]!==null ? r.t[1] : "–",
                r.t[2]!==null ? r.t[2] : "–",
                r.finalAvg!==null ? r.finalAvg : "–",
                r.status==="aprueba" ? "Aprueba" : r.status==="rendir" ? `Rinde: ${r.rendirTrim}` : "Sin completar",
              ]),
              styles: { fontSize:9, cellPadding:3 },
              headStyles: { fillColor:[30,58,95], textColor:255, fontStyle:"bold" },
              columnStyles: { 0:{ cellWidth:60 }, 1:{halign:"center"}, 2:{halign:"center"}, 3:{halign:"center"}, 4:{halign:"center"} },
              didParseCell: (data) => {
                if (data.section==="body" && data.column.index===5) {
                  const v = data.cell.raw;
                  if (v==="Aprueba") { data.cell.styles.textColor=[21,128,61]; data.cell.styles.fontStyle="bold"; }
                  else if (v.startsWith("Rinde")) { data.cell.styles.textColor=[194,65,12]; data.cell.styles.fontStyle="bold"; }
                }
              },
              margin: { left:14, right:14 },
            });
            y = doc.lastAutoTable.finalY + 8;
          });
          doc.save(`cierre-notas-${materia.replace(/\s+/g,"-")}.pdf`);
        }}
          style={{ padding:"8px 16px", borderRadius:"8px", border:"1px solid #3b82f6", background:"#3b82f6", cursor:"pointer", fontSize:"0.85rem", fontWeight:600, color:"white" }}>
          ⬇️ Descargar PDF
        </button>
      </div>

      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        {[
          { key:"aprueba",   label:"✅ Aprueban",       val:counts.aprueba,    bg:"#f0fdf4", border:"#86efac", color:"#15803d", activeBg:"#dcfce7", activeBorder:"#22c55e" },
          { key:"rendir",    label:"📝 Deben rendir",   val:counts.rendir,     bg:"#fff7ed", border:"#fdba74", color:"#c2410c", activeBg:"#ffedd5", activeBorder:"#f97316" },
          { key:"incompleto",label:"⏳ Sin completar",  val:counts.incompleto, bg:"#f8fafc", border:"#e2e8f0", color:"#94a3b8", activeBg:"#f1f5f9", activeBorder:"#94a3b8" },
        ].map(c => {
          const isActive = filterStatus === c.key;
          return (
            <div key={c.key}
              onClick={() => setFilterStatus(isActive ? "" : c.key)}
              style={{ flex:"1 1 140px", padding:"12px 16px", borderRadius:"10px", cursor:"pointer", userSelect:"none",
                background: isActive ? c.activeBg : c.bg,
                border: `2px solid ${isActive ? c.activeBorder : c.border}`,
                boxShadow: isActive ? `0 0 0 3px ${c.activeBorder}33` : "none",
                transition:"all 0.15s" }}>
              <div style={{ fontSize:"0.72rem", color:c.color, fontWeight:700, textTransform:"uppercase" }}>{c.label}</div>
              <div style={{ fontWeight:800, fontSize:"1.6rem", color:c.color, fontFamily:"'Playfair Display',serif" }}>{c.val}</div>
              {isActive && <div style={{ fontSize:"0.68rem", color:c.color, marginTop:"2px", fontWeight:600 }}>Filtro activo · clic para quitar</div>}
            </div>
          );
        })}
      </div>

      {Object.keys(byGrade).length === 0 ? (
        <div className="card" style={{ padding:"40px", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2.5rem" }}>📋</div>
          <p>No hay datos para los filtros seleccionados.</p>
        </div>
      ) : (
        Object.entries(byGrade).sort(([a],[b])=>a.localeCompare(b)).map(([grade, gradeRows]) => (
          <div key={grade} style={{ marginBottom:"32px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:0, fontSize:"1.15rem" }}>{grade}</h3>
              <span style={{ padding:"3px 10px", borderRadius:"20px", background:"#dbeafe", color:"#1e40af", fontSize:"0.76rem", fontWeight:700 }}>{gradeRows.length} registros</span>
              <span style={{ padding:"3px 10px", borderRadius:"20px", background:"#fee2e2", color:"#dc2626", fontSize:"0.76rem", fontWeight:700 }}>📝 {gradeRows.filter(r=>r.status==="rendir").length} deben rendir</span>
            </div>
            <div className="card" style={{ overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.86rem" }}>
                <thead>
                  <tr style={{ background:"#1e3a5f", color:"white" }}>
                    {["Alumno","T1","T2","T3","Prom. Final","Resultado"].map(h=>(
                      <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:700, fontSize:"0.73rem", textTransform:"uppercase", letterSpacing:"0.4px", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.map((r,i) => {
                    const resultCfg = r.status==="aprueba"
                      ? { label:"✅ Aprueba", bg:"#f0fdf4", color:"#15803d", border:"#86efac" }
                      : r.status==="rendir"
                      ? { label:`📝 ${r.rendirTrim}`, bg:"#fff7ed", color: r.rendirTrim==="Materia completa"?"#7c3aed":"#c2410c", border:"#fdba74" }
                      : { label:"⏳ Sin completar", bg:"#f8fafc", color:"#94a3b8", border:"#e2e8f0" };
                    return (
                      <tr key={`${r.studentId}__${r.subject}`} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafafa" }}>
                        <td style={{ padding:"9px 12px", fontWeight:600, color:"#1e293b" }}>{r.name}</td>
                        {r.t.map((v,ti) => (
                          <td key={ti} style={{ padding:"9px 12px", textAlign:"center" }}>
                            {v!==null ? <span style={{ fontWeight:700, color:scoreColor(v) }}>{v}</span> : <span style={{ color:"#cbd5e1" }}>–</span>}
                          </td>
                        ))}
                        <td style={{ padding:"9px 12px", textAlign:"center" }}>
                          {r.finalAvg!==null
                            ? <span style={{ fontWeight:800, fontSize:"1.05rem", color:scoreColor(r.finalAvg), fontFamily:"'Playfair Display',serif" }}>{r.finalAvg}</span>
                            : <span style={{ color:"#cbd5e1" }}>–</span>}
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ padding:"3px 9px", borderRadius:"20px", background:resultCfg.bg, border:`1px solid ${resultCfg.border}`, color:resultCfg.color, fontWeight:700, fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                            {resultCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      <div style={{ marginTop:"12px", fontSize:"0.76rem", color:"#94a3b8" }}>
        * Prom. ≥ 6.90 → aprueba (redondea a 7). T3 {"<"} 7 → debe rendir 3° Trimestre aunque el promedio anual supere 6.90. Las notas de ingreso de otros colegios se usan como promedio del trimestre correspondiente.
      </div>
    </div>
  );
}
