import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getChildrenByIds, getGradesByStudent, getObservationsByStudent, getAttitudesByStudent, ATTITUDE_VALUES, ATTITUDE_LABELS, ATTITUDE_COLORS, getAnnouncements } from "../db";

// Convierte valor actitudinal a número para promediar
const ATTITUDE_NUM = { PD:1, DB:2, DM:3, DA:4 };
function numToAttitude(n) {
  if (n <= 1.5) return "PD";
  if (n <= 2.5) return "DB";
  if (n <= 3.5) return "DM";
  return "DA";
}

export default function ParentScreen({ user, profile, logout }) {
  const [students, setStudents] = useState([]);
  const [gradesMap, setGradesMap] = useState({});
  const [observationsMap, setObservationsMap] = useState({});
  const [attitudesMap, setAttitudesMap] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [trim, setTrim] = useState(0);
  const [tab, setTab] = useState("grades");
  const [loading, setLoading] = useState(true);

  // ── Lazy: rastrear qué hijos ya tienen obs y actitudinales cargadas ──
  const [obsLoaded, setObsLoaded] = useState({});     // { [childId]: true }
  const [attLoaded, setAttLoaded] = useState({});     // { [childId]: true }
  const [tabLoading, setTabLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoaded, setAnnLoaded] = useState(false);

  useEffect(() => { loadData(); }, []);

  // Al montar: solo carga alumnos y notas de cada hijo
  async function loadData() {
    setLoading(true);
    const myChildren = await getChildrenByIds(profile.childIds || [], profile.email);
    setStudents(myChildren);
    if (myChildren.length > 0) {
      setSelectedChild(myChildren[0]);
      const gMap = {};
      await Promise.all(myChildren.map(async c => {
        gMap[c.id] = await getGradesByStudent(c.id);
      }));
      setGradesMap(gMap);
    }
    setLoading(false);
  }

  // Carga lazy de observaciones para un hijo específico
  async function ensureObsLoaded(childId) {
    if (obsLoaded[childId]) return;
    setTabLoading(true);
    const obs = await getObservationsByStudent(childId);
    setObservationsMap(prev => ({ ...prev, [childId]: obs }));
    setObsLoaded(prev => ({ ...prev, [childId]: true }));
    setTabLoading(false);
  }

  // Carga lazy de actitudinales para un hijo específico
  async function ensureAttLoaded(childId) {
    if (attLoaded[childId]) return;
    setTabLoading(true);
    const att = await getAttitudesByStudent(childId);
    setAttitudesMap(prev => ({ ...prev, [childId]: att }));
    setAttLoaded(prev => ({ ...prev, [childId]: true }));
    setTabLoading(false);
  }

  // Carga lazy de avisos (no depende del hijo)
  async function ensureAnnLoaded() {
    if (annLoaded) return;
    setTabLoading(true);
    const list = await getAnnouncements();
    setAnnouncements(list);
    setAnnLoaded(true);
    setTabLoading(false);
  }

  // Cambio de pestaña con lazy loading
  function handleTabChange(newTab) {
    setTab(newTab);
    if (newTab === "announcements") { ensureAnnLoaded(); return; }
    if (!selectedChild) return;
    if (newTab === "observations") ensureObsLoaded(selectedChild.id);
    if (newTab === "attitudes") ensureAttLoaded(selectedChild.id);
  }

  // Cambio de hijo: notas ya están, lazy para obs y att si corresponde
  function handleChildChange(c) {
    setSelectedChild(c);
    setTab("grades");
    setTrim(0);
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
          <div style={{ fontSize:"4rem", marginBottom:"16px" }}>🏫</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f" }}>Sin alumnos vinculados</h2>
          <p style={{ color:"#64748b" }}>Tu cuenta ({profile.email}) no tiene hijos asignados. Comunicate con la dirección escolar.</p>
        </div>
      </div>
    </div>
  );

  const child = selectedChild;
  const allChildGrades = child ? (gradesMap[child.id]||[]) : [];
  const childGrades = allChildGrades.filter(g => trim===0 || g.trimester===trim);
  const childObs = child ? (observationsMap[child.id]||[]) : [];
  const childAtt = child ? (attitudesMap[child.id]||[]) : [];
  const globalAvg = avg(allChildGrades.map(g=>g.score));

  const subjectMap = {};
  childGrades.forEach(g => { if (!subjectMap[g.subject]) subjectMap[g.subject]=[]; subjectMap[g.subject].push(g); });

  // Calcular promedio actitudinal por trimestre
  function calcAttitudeSummary(trimesterFilter) {
    const attFiltered = trimesterFilter ? childAtt.filter(a=>a.trimester===trimesterFilter) : childAtt;
    if (attFiltered.length===0) return null;
    const nums = attFiltered.map(a=>ATTITUDE_NUM[a.value]).filter(n=>n!==undefined);
    if (nums.length===0) return null;
    const numAvg = nums.reduce((a,b)=>a+b,0)/nums.length;
    return { value: numToAttitude(numAvg), numAvg: parseFloat(numAvg.toFixed(2)), count: attFiltered.length };
  }

  // Por materia en cada trimestre
  function getAttitudesBySubjectAndTrimester(triNum) {
    const attFiltered = childAtt.filter(a=>a.trimester===triNum);
    const bySubject = {};
    attFiltered.forEach(a => {
      if (!bySubject[a.subject]) bySubject[a.subject] = [];
      bySubject[a.subject].push(a);
    });
    return bySubject;
  }

  // Resumen actitudinal global (solo si ya cargó)
  const attLoadedForChild = child ? !!attLoaded[child.id] : false;
  const globalAttSummary = attLoadedForChild ? calcAttitudeSummary(0) : null;

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {/* Selector de hijo */}
        {students.length > 1 && (
          <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
            {students.map(c => (
              <button key={c.id} onClick={()=>handleChildChange(c)} style={{ padding:"10px 20px", borderRadius:"12px", border:`2px solid ${child?.id===c.id?"#1e3a5f":"#e2e8f0"}`, background:child?.id===c.id?"#1e3a5f":"white", color:child?.id===c.id?"white":"#475569", cursor:"pointer", fontWeight:600, fontSize:"0.9rem" }}>
                {c.name} <span style={{ opacity:0.6, fontSize:"0.8rem" }}>({c.grade})</span>
              </button>
            ))}
          </div>
        )}

        {child && (
          <>
            {/* Header */}
            <div className="card" style={{ padding:"24px 28px", marginBottom:"24px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f", flexWrap:"wrap", gap:"16px" }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 4px", fontSize:"1.6rem" }}>{child.name}</h2>
                <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{child.grade}</span>
              </div>
              <div style={{ display:"flex", gap:"24px", textAlign:"center", flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:globalAvg==="–"?"#94a3b8":scoreColor(parseFloat(globalAvg)), fontFamily:"'Playfair Display',serif" }}>{globalAvg}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Promedio notas</div>
                </div>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#1e3a5f", fontFamily:"'Playfair Display',serif" }}>{allChildGrades.length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Evaluaciones</div>
                </div>
                {/* Actitudinal global solo si ya cargó */}
                {globalAttSummary && (
                  <div>
                    <div style={{ fontSize:"2rem", fontWeight:800, color:ATTITUDE_COLORS[globalAttSummary.value], fontFamily:"'Playfair Display',serif" }}>{globalAttSummary.value}</div>
                    <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Actitudinal</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#7c3aed", fontFamily:"'Playfair Display',serif" }}>{childObs.length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Observaciones</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"20px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
              {[["grades","📊 Notas"],["attitudes","🎯 Actitudinales"],["observations","💬 Observaciones"],["announcements","📢 Avisos"]].map(([k,l])=>(
                <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>handleTabChange(k)}>{l}</button>
              ))}
            </div>

            {/* Spinner de carga lazy entre pestañas */}
            {tabLoading ? (
              <div style={{ textAlign:"center", padding:"60px", color:"#94a3b8" }}>Cargando...</div>
            ) : (
              <>
                {/* ── NOTAS ─────────────────────────────────────────── */}
                {tab==="grades" && (
                  <>
                    <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
                      {[["📅 Todas",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
                        <button key={v} onClick={()=>setTrim(v)} style={{ padding:"7px 16px", borderRadius:"20px", background:trim===v?"#1e3a5f":"white", color:trim===v?"white":"#64748b", border:`1px solid ${trim===v?"#1e3a5f":"#e2e8f0"}`, cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
                      ))}
                    </div>
                    {Object.keys(subjectMap).length===0 ? (
                      <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                        <div style={{ fontSize:"3rem" }}>📚</div>
                        <p>No hay evaluaciones para este período</p>
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                        {Object.entries(subjectMap).map(([subject, sGrades]) => {
                          const sAvg = parseFloat(avg(sGrades.map(g=>g.score)));
                          return (
                            <div key={subject} className="card" style={{ overflow:"hidden" }}>
                              <div style={{ padding:"16px 20px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <h3 style={{ margin:0, color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1.05rem" }}>{subject}</h3>
                                <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
                                  <div style={{ textAlign:"right" }}>
                                    <div style={{ fontWeight:800, fontSize:"1.4rem", color:scoreColor(sAvg), fontFamily:"'Playfair Display',serif" }}>{avg(sGrades.map(g=>g.score))}</div>
                                    <div style={{ fontSize:"0.7rem", color:"#94a3b8" }}>promedio</div>
                                  </div>
                                  <div style={{ width:"48px", height:"48px", borderRadius:"50%", background:`${scoreColor(sAvg)}20`, border:`3px solid ${scoreColor(sAvg)}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    <span style={{ fontSize:"1.1rem" }}>{sAvg>=8?"🟢":sAvg>=6?"🟡":"🔴"}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                {sGrades.map(g=>(
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ── ACTITUDINALES ──────────────────────────────────── */}
                {tab==="attitudes" && (
                  <div>
                    {childAtt.length===0 ? (
                      <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                        <div style={{ fontSize:"3rem" }}>🎯</div>
                        <p>No hay actitudinales registradas para {child.name}</p>
                      </div>
                    ) : (
                      <>
                        {/* Leyenda */}
                        <div style={{ display:"flex", gap:"10px", marginBottom:"24px", flexWrap:"wrap" }}>
                          {ATTITUDE_VALUES.map(v=>(
                            <div key={v} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 14px", borderRadius:"20px", background:`${ATTITUDE_COLORS[v]}15`, border:`1px solid ${ATTITUDE_COLORS[v]}` }}>
                              <span style={{ fontWeight:800, color:ATTITUDE_COLORS[v] }}>{v}</span>
                              <span style={{ fontSize:"0.78rem", color:"#475569" }}>{ATTITUDE_LABELS[v]}</span>
                            </div>
                          ))}
                        </div>

                        {/* Resumen por trimestre */}
                        {[1,2,3].map(triNum => {
                          const summary = calcAttitudeSummary(triNum);
                          const bySubject = getAttitudesBySubjectAndTrimester(triNum);
                          if (!summary && Object.keys(bySubject).length===0) return null;
                          return (
                            <div key={triNum} style={{ marginBottom:"28px" }}>
                              <div className="card" style={{ padding:"20px 24px", marginBottom:"12px", background:"#1e3a5f", color:"white", borderRadius:"16px" }}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
                                  <h3 style={{ fontFamily:"'Playfair Display',serif", margin:0, fontSize:"1.15rem" }}>{trimNames[triNum-1]}</h3>
                                  {summary && (
                                    <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                                      <div style={{ textAlign:"right" }}>
                                        <div style={{ fontSize:"0.72rem", opacity:0.6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Promedio actitudinal</div>
                                        <div style={{ fontSize:"1.8rem", fontWeight:800, color:ATTITUDE_COLORS[summary.value], fontFamily:"'Playfair Display',serif" }}>{summary.value}</div>
                                      </div>
                                      <div style={{ background:`${ATTITUDE_COLORS[summary.value]}25`, border:`3px solid ${ATTITUDE_COLORS[summary.value]}`, borderRadius:"12px", padding:"8px 16px", textAlign:"center" }}>
                                        <div style={{ fontWeight:700, color:ATTITUDE_COLORS[summary.value], fontSize:"0.85rem" }}>{ATTITUDE_LABELS[summary.value]}</div>
                                        <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.5)" }}>{summary.count} registro{summary.count!==1?"s":""}</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Detalle por materia y profesor */}
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"12px" }}>
                                {Object.entries(bySubject).map(([subject, atts]) => {
                                  const nums = atts.map(a=>ATTITUDE_NUM[a.value]).filter(n=>n);
                                  const subAvgNum = nums.reduce((a,b)=>a+b,0)/nums.length;
                                  const subAvgVal = numToAttitude(subAvgNum);
                                  return (
                                    <div key={subject} className="card" style={{ padding:"16px 20px" }}>
                                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
                                        <div style={{ fontWeight:700, color:"#1e293b", fontSize:"0.95rem", flex:1 }}>{subject}</div>
                                        <span style={{ padding:"4px 12px", borderRadius:"20px", background:`${ATTITUDE_COLORS[subAvgVal]}15`, border:`2px solid ${ATTITUDE_COLORS[subAvgVal]}`, fontWeight:800, color:ATTITUDE_COLORS[subAvgVal], fontSize:"0.9rem", marginLeft:"8px", whiteSpace:"nowrap" }}>{subAvgVal}</span>
                                      </div>
                                      {/* Detalle por cada profesor */}
                                      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                                        {atts.map((a,i)=>(
                                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid #f1f5f9" }}>
                                            <span style={{ fontSize:"0.78rem", color:"#64748b" }}>Prof. {a.teacherName}</span>
                                            <span style={{ padding:"2px 10px", borderRadius:"20px", background:`${ATTITUDE_COLORS[a.value]}15`, border:`1px solid ${ATTITUDE_COLORS[a.value]}`, fontWeight:700, color:ATTITUDE_COLORS[a.value], fontSize:"0.78rem" }}>{a.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                      {atts.length>1 && (
                                        <div style={{ marginTop:"8px", display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:"6px", borderTop:"1px solid #e2e8f0" }}>
                                          <span style={{ fontSize:"0.75rem", color:"#94a3b8" }}>Promedio {atts.length} profesores</span>
                                          <span style={{ fontWeight:800, color:ATTITUDE_COLORS[subAvgVal], fontSize:"0.85rem" }}>{subAvgVal} — {ATTITUDE_LABELS[subAvgVal]}</span>
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

                {/* ── OBSERVACIONES ─────────────────────────────────── */}
                {tab==="observations" && (
                  <div>
                    {childObs.length===0 ? (
                      <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                        <div style={{ fontSize:"3rem" }}>💬</div>
                        <p>No hay observaciones registradas para {child.name}</p>
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                        {childObs.map(o=>(
                          <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                              <div>
                                <span style={{ fontWeight:600, color:"#7c3aed", fontSize:"0.85rem" }}>Prof. {o.teacherName}</span>
                                {o.subjects&&o.subjects.length>0&&<span style={{ fontSize:"0.78rem", color:"#94a3b8", marginLeft:"8px" }}>· {o.subjects.join(", ")}</span>}
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

                {/* ── AVISOS ────────────────────────────────────────── */}
                {tab==="announcements" && (() => {
                  const childGradesList = students.map(s => s.grade);
                  const filtered = announcements.filter(a => !a.targetGrade || childGradesList.includes(a.targetGrade));
                  return (
                    <div>
                      {filtered.length===0 ? (
                        <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                          <div style={{ fontSize:"3rem" }}>📢</div>
                          <p>No hay avisos publicados por el momento</p>
                        </div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                          {filtered.map(a=>(
                            <div key={a.id} className="card" style={{ padding:"20px 24px", borderLeft:`5px solid ${a.targetGrade?"#7c3aed":"#059669"}` }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
                                <h3 style={{ margin:0, color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1.05rem" }}>{a.title}</h3>
                                <span style={{ padding:"3px 10px", borderRadius:"20px", fontSize:"0.75rem", fontWeight:700, background:a.targetGrade?"#ede9fe":"#d1fae5", color:a.targetGrade?"#7c3aed":"#059669" }}>
                                  {a.targetGrade ? `Curso ${a.targetGrade}` : "Comunicado general"}
                                </span>
                              </div>
                              <p style={{ margin:"0 0 10px", color:"#475569", lineHeight:1.6, fontSize:"0.92rem", whiteSpace:"pre-wrap" }}>{a.text}</p>
                              <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>
                                {a.date} · {a.authorName}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
