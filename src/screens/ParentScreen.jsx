import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getChildrenByIds, getGradesByStudentFiltered, getGradesByStudent, getObservationsByStudent, getUpcomingFiltered } from "../db";

const SUBJECTS = ["Matemática","Tecnología","Lengua y Literatura","Inglés","Lenguaje de las Artes Visuales","Psicología","Geografía","Política y Ciudadanía","Filosofía","Biología","Producción de las Artes Visuales","Educación Física","Artes Visuales y T.I.C.","Química","Educación Artística","Historia","Física","Economía","Formación para la Vida y el Trabajo","Sociología","Formación Ética","E.O.I.","Arte e Industrias Culturales","Arte Cultura y Sociedades"];
const typeColors = { "Examen":"#dc2626","Recuperatorio":"#ea580c","Trabajo Práctico":"#7c3aed","Exposición":"#0369a1","Proyecto":"#065f46","Parcial":"#9f1239","Cuestionario":"#1d4ed8","Otro":"#475569" };

export default function ParentScreen({ user, profile, logout }) {
  const [students, setStudents] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [loading, setLoading] = useState(true);

  // Notas
  const [subjectFilter, setSubjectFilter] = useState("");
  const [trimFilter, setTrimFilter] = useState(0);
  const [grades, setGrades] = useState([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [gradesSummary, setGradesSummary] = useState([]);

  // Observaciones
  const [observations, setObservations] = useState([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [obsLoaded, setObsLoaded] = useState(false);

  // Próximas evaluaciones — lazy por materia
  const [upcomingSubject, setUpcomingSubject] = useState("");
  const [upcomingResults, setUpcomingResults] = useState([]);
  const [upcomingSearched, setUpcomingSearched] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const myChildren = await getChildrenByIds(profile.childIds || [], profile.email);
    setStudents(myChildren);
    if (myChildren.length > 0) {
      setSelectedChild(myChildren[0]);
      const g = await getGradesByStudent(myChildren[0].id);
      setGradesSummary(g);
    }
    setLoading(false);
  }

  async function selectChild(c) {
    setSelectedChild(c);
    setTab("upcoming");
    setSubjectFilter(""); setTrimFilter(0); setGrades([]);
    setObservations([]); setObsLoaded(false);
    setUpcomingSubject(""); setUpcomingResults([]); setUpcomingSearched(false);
    const g = await getGradesByStudent(c.id);
    setGradesSummary(g);
  }

  async function buscarNotas() {
    if (!selectedChild) return;
    setLoadingGrades(true);
    const g = await getGradesByStudentFiltered(selectedChild.id, { subject: subjectFilter, trimester: trimFilter });
    setGrades(g); setLoadingGrades(false);
  }

  async function cargarObservaciones() {
    if (!selectedChild || obsLoaded) return;
    setLoadingObs(true);
    const o = await getObservationsByStudent(selectedChild.id);
    setObservations(o); setObsLoaded(true); setLoadingObs(false);
  }

  async function buscarUpcoming() {
    if (!selectedChild) return;
    setLoadingUpcoming(true);
    const results = await getUpcomingFiltered({ grade: selectedChild.grade, subject: upcomingSubject });
    setUpcomingResults(results); setUpcomingSearched(true); setLoadingUpcoming(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ textAlign:"center", padding:"80px", color:"#94a3b8" }}>Cargando...</div>
    </div>
  );

  if (students.length === 0) return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ maxWidth:"600px", margin:"80px auto", textAlign:"center", padding:"20px" }}>
        <div className="card" style={{ padding:"48px" }}>
          <div style={{ fontSize:"4rem", marginBottom:"16px" }}>📭</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f" }}>Sin alumnos vinculados</h2>
          <p style={{ color:"#64748b" }}>Tu cuenta ({profile.email}) no tiene hijos asignados. Comunicate con la dirección escolar.</p>
        </div>
      </div>
    </div>
  );

  const child = selectedChild;
  const globalAvg = avg(gradesSummary.map(g=>g.score));
  const trimAvgs = [1,2,3].map(t => { const tg = gradesSummary.filter(g=>g.trimester===t); return { t, avg: avg(tg.map(g=>g.score)), count: tg.length }; });
  const subjectMap = {};
  grades.forEach(g => { if (!subjectMap[g.subject]) subjectMap[g.subject]=[]; subjectMap[g.subject].push(g); });
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {students.length > 1 && (
          <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
            {students.map(c => (
              <button key={c.id} onClick={()=>selectChild(c)} style={{ padding:"10px 20px", borderRadius:"12px", border:`2px solid ${child?.id===c.id?"#1e3a5f":"#e2e8f0"}`, background:child?.id===c.id?"#1e3a5f":"white", color:child?.id===c.id?"white":"#475569", cursor:"pointer", fontWeight:600, fontSize:"0.9rem" }}>
                {c.name} <span style={{ opacity:0.6, fontSize:"0.8rem" }}>({c.grade})</span>
              </button>
            ))}
          </div>
        )}

        {child && (
          <>
            {/* Header */}
            <div className="card" style={{ padding:"24px 28px", marginBottom:"20px", borderLeft:"5px solid #1e3a5f" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 4px", fontSize:"1.6rem" }}>{child.name}</h2>
                  <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{child.grade}</span>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:"2rem", fontWeight:800, color: globalAvg==="–"?"#94a3b8":scoreColor(parseFloat(globalAvg)), fontFamily:"'Playfair Display',serif" }}>{globalAvg}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Promedio general</div>
                </div>
              </div>
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

            {/* Tabs */}
            <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"20px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
              {[["upcoming","📅 Próximas eval."],["grades","📊 Notas"],["observations","💬 Observaciones"]].map(([k,l])=>(
                <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>{ setTab(k); if(k==="observations") cargarObservaciones(); }}>{l}</button>
              ))}
            </div>

            {/* ─── Próximas evaluaciones (lazy por materia) ─── */}
            {tab === "upcoming" && (
              <div>
                {/* Buscador */}
                <div className="card" style={{ padding:"20px", marginBottom:"16px" }}>
                  <h3 style={{ margin:"0 0 14px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar próximas evaluaciones</h3>
                  <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"flex-end" }}>
                    <div style={{ flex:1, minWidth:"200px" }}>
                      <label>Materia (opcional)</label>
                      <select value={upcomingSubject} onChange={e=>setUpcomingSubject(e.target.value)} style={{ marginTop:"4px" }}>
                        <option value="">Todas las materias</option>
                        {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <button className="btn-primary" onClick={buscarUpcoming} disabled={loadingUpcoming} style={{ marginBottom:"0" }}>
                      {loadingUpcoming ? "Buscando..." : "🔍 Ver evaluaciones"}
                    </button>
                  </div>
                  {!upcomingSearched && <p style={{ color:"#94a3b8", fontSize:"0.82rem", margin:"10px 0 0" }}>Seleccioná una materia o buscá todas para ver las evaluaciones programadas.</p>}
                </div>

                {upcomingSearched && upcomingResults.length === 0 && (
                  <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📅</div>
                    <p>No hay evaluaciones próximas publicadas{upcomingSubject ? ` para ${upcomingSubject}` : ""}.</p>
                  </div>
                )}

                {upcomingResults.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                    <p style={{ color:"#64748b", fontSize:"0.85rem", margin:"0 0 4px" }}>{upcomingResults.length} evaluación(es) encontrada(s)</p>
                    {upcomingResults.map(item => {
                      const daysLeft = Math.ceil((new Date(item.dateEnd) - new Date(todayStr)) / 86400000);
                      const color = typeColors[item.type] || "#475569";
                      const urgent = daysLeft <= 3;
                      return (
                        <div key={item.id} className="card" style={{ padding:"16px 20px", borderLeft:`4px solid ${color}`, background:urgent?"#fffbeb":"white" }}>
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
                                <span>Prof. <strong style={{ color:"#475569" }}>{item.teacherName}</strong></span>
                                {item.dateStart && item.dateStart!==item.dateEnd && <span>📅 Inicio: <strong style={{ color:"#475569" }}>{item.dateStart}</strong></span>}
                                <span>⏰ Entrega: <strong style={{ color:"#475569" }}>{item.dateEnd}</strong></span>
                              </div>
                            </div>
                            <div style={{ textAlign:"center", minWidth:"52px", flexShrink:0 }}>
                              <div style={{ fontSize:"1.4rem", fontWeight:800, color:urgent?"#dc2626":daysLeft<=7?"#f59e0b":"#16a34a", fontFamily:"'Playfair Display',serif" }}>
                                {daysLeft===0?"¡Hoy!":daysLeft===1?"Mañana":daysLeft}
                              </div>
                              {daysLeft > 1 && <div style={{ fontSize:"0.68rem", color:"#94a3b8" }}>días</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── Notas ─── */}
            {tab === "grades" && (
              <div>
                <div className="card" style={{ padding:"20px", marginBottom:"16px" }}>
                  <h3 style={{ margin:"0 0 14px", color:"#1e3a5f", fontSize:"1rem" }}>Buscar evaluaciones</h3>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"14px" }}>
                    <div>
                      <label>Materia (opcional)</label>
                      <select value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)} style={{ marginTop:"4px" }}>
                        <option value="">Todas las materias</option>
                        {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Trimestre (opcional)</label>
                      <div style={{ display:"flex", gap:"6px", marginTop:"4px", flexWrap:"wrap" }}>
                        {[["Todos",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
                          <button key={v} onClick={()=>setTrimFilter(v)} style={{ padding:"6px 12px", borderRadius:"20px", background:trimFilter===v?"#1e3a5f":"#f1f5f9", color:trimFilter===v?"white":"#64748b", border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="btn-primary" onClick={buscarNotas} disabled={loadingGrades}>{loadingGrades?"Buscando...":"🔍 Ver evaluaciones"}</button>
                </div>
                {grades.length===0 && !loadingGrades ? (
                  <div className="card" style={{ padding:"40px", textAlign:"center", color:"#94a3b8" }}><div style={{ fontSize:"3rem", marginBottom:"12px" }}>📚</div><p>Seleccioná una materia y/o trimestre y presioná "Ver evaluaciones"</p></div>
                ) : loadingGrades ? (
                  <div className="card" style={{ padding:"40px", textAlign:"center", color:"#94a3b8" }}>Cargando...</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                    {Object.entries(subjectMap).map(([subject, sGrades]) => {
                      const sAvg = parseFloat(avg(sGrades.map(g=>g.score)));
                      const subTrimAvgs = [1,2,3].map(t => { const tg = sGrades.filter(g=>g.trimester===t); return { t, avg: avg(tg.map(g=>g.score)) }; });
                      return (
                        <div key={subject} className="card" style={{ overflow:"hidden" }}>
                          <div style={{ padding:"16px 20px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                              <h3 style={{ margin:0, color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1.05rem" }}>{subject}</h3>
                              <div style={{ textAlign:"right" }}>
                                <div style={{ fontWeight:800, fontSize:"1.4rem", color:scoreColor(sAvg), fontFamily:"'Playfair Display',serif" }}>{avg(sGrades.map(g=>g.score))}</div>
                                <div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>promedio</div>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                              {subTrimAvgs.map(({ t, avg:ta }) => ta!=="–" && (
                                <span key={t} style={{ fontSize:"0.75rem", padding:"3px 10px", borderRadius:"20px", background:`${scoreColor(parseFloat(ta))}15`, color:scoreColor(parseFloat(ta)), fontWeight:600, border:`1px solid ${scoreColor(parseFloat(ta))}30` }}>{trimNames[t-1]}: {ta}</span>
                              ))}
                            </div>
                          </div>
                          {sGrades.map(g => (
                            <div key={g.id} style={{ padding:"12px 20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #f8fafc" }}>
                              <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:scoreColor(g.score), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:"0.9rem", flexShrink:0 }}>{g.score}</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:600, color:"#1e293b", fontSize:"0.9rem" }}>{g.type}</div>
                                <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{trimNames[g.trimester-1]} · {g.date}</div>
                              </div>
                              {g.note && <div style={{ fontSize:"0.78rem", color:"#7c3aed", background:"#f3e8ff", padding:"4px 10px", borderRadius:"20px", maxWidth:"200px" }}>💬 {g.note}</div>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── Observaciones ─── */}
            {tab === "observations" && (
              <div>
                {loadingObs ? (
                  <div className="card" style={{ padding:"40px", textAlign:"center", color:"#94a3b8" }}>Cargando...</div>
                ) : observations.length===0 ? (
                  <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"12px" }}>💬</div>
                    <p>No hay observaciones registradas para {child.name}</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                    {observations.map(o => (
                      <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                          <div>
                            <span style={{ fontWeight:600, color:"#7c3aed", fontSize:"0.85rem" }}>Prof. {o.teacherName}</span>
                            {o.subjects && o.subjects.length>0 && <span style={{ fontSize:"0.78rem", color:"#94a3b8", marginLeft:"8px" }}>· {o.subjects.join(", ")}</span>}
                          </div>
                          <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{o.date}</span>
                        </div>
                        <p style={{ margin:0, color:"#475569", fontSize:"0.9rem", lineHeight:1.5 }}>{o.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
