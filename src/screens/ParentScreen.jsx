import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getChildrenByIds, getGradesByStudent, getObservationsByStudent } from "../db";

export default function ParentScreen({ user, profile, logout }) {
  const [students, setStudents] = useState([]);
  const [gradesMap, setGradesMap] = useState({});
  const [observationsMap, setObservationsMap] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [trim, setTrim] = useState(0);
  const [tab, setTab] = useState("grades");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const myChildren = await getChildrenByIds(profile.childIds || [], profile.email);
    setStudents(myChildren);
    if (myChildren.length > 0) {
      setSelectedChild(myChildren[0]);
      const gMap = {};
      const oMap = {};
      await Promise.all(myChildren.map(async c => {
        const [grades, obs] = await Promise.all([getGradesByStudent(c.id), getObservationsByStudent(c.id)]);
        gMap[c.id] = grades;
        oMap[c.id] = obs;
      }));
      setGradesMap(gMap);
      setObservationsMap(oMap);
    }
    setLoading(false);
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
  const allChildGrades = child ? (gradesMap[child.id]||[]) : [];
  const childGrades = allChildGrades.filter(g => trim===0 || g.trimester===trim);
  const childObs = child ? (observationsMap[child.id]||[]) : [];
  const globalAvg = avg(allChildGrades.map(g=>g.score));
  const totalMaterias = Object.keys(allChildGrades.reduce((a,g)=>({...a,[g.subject]:1}),{})).length;

  // Promedios por trimestre
  const trimAvgs = [1,2,3].map(t => {
    const tg = allChildGrades.filter(g => g.trimester === t);
    return { t, avg: avg(tg.map(g=>g.score)), count: tg.length };
  });

  const subjectMap = {};
  childGrades.forEach(g => { if (!subjectMap[g.subject]) subjectMap[g.subject]=[]; subjectMap[g.subject].push(g); });

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {students.length > 1 && (
          <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
            {students.map(c => (
              <button key={c.id} onClick={()=>{ setSelectedChild(c); setTab("grades"); setTrim(0); }} style={{ padding:"10px 20px", borderRadius:"12px", border:`2px solid ${child?.id===c.id?"#1e3a5f":"#e2e8f0"}`, background:child?.id===c.id?"#1e3a5f":"white", color:child?.id===c.id?"white":"#475569", cursor:"pointer", fontWeight:600, fontSize:"0.9rem" }}>
                {c.name} <span style={{ opacity:0.6, fontSize:"0.8rem" }}>({c.grade})</span>
              </button>
            ))}
          </div>
        )}

        {child && (
          <>
            {/* Header */}
            <div className="card" style={{ padding:"24px 28px", marginBottom:"20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f", flexWrap:"wrap", gap:"16px" }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 4px", fontSize:"1.6rem" }}>{child.name}</h2>
                <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{child.grade}</span>
              </div>
              <div style={{ display:"flex", gap:"24px", textAlign:"center", flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color: globalAvg==="–"?"#94a3b8":scoreColor(parseFloat(globalAvg)), fontFamily:"'Playfair Display',serif" }}>{globalAvg}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Promedio general</div>
                </div>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#1e3a5f", fontFamily:"'Playfair Display',serif" }}>{allChildGrades.length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Evaluaciones</div>
                </div>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#7c3aed", fontFamily:"'Playfair Display',serif" }}>{childObs.length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase" }}>Observaciones</div>
                </div>
              </div>
            </div>

            {/* Promedios por trimestre */}
            <div className="card" style={{ padding:"20px 24px", marginBottom:"20px" }}>
              <h3 style={{ margin:"0 0 14px", color:"#1e3a5f", fontFamily:"'Playfair Display',serif", fontSize:"1rem" }}>Promedio por trimestre</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px" }}>
                {trimAvgs.map(({ t, avg: ta, count }) => (
                  <div key={t} style={{ textAlign:"center", padding:"12px", background:"#f8fafc", borderRadius:"12px", border:`2px solid ${ta==="–"?"#e2e8f0":scoreColor(parseFloat(ta))}` }}>
                    <div style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:600, textTransform:"uppercase", marginBottom:"4px" }}>{trimNames[t-1]}</div>
                    <div style={{ fontSize:"1.8rem", fontWeight:800, color: ta==="–"?"#94a3b8":scoreColor(parseFloat(ta)), fontFamily:"'Playfair Display',serif" }}>{ta}</div>
                    <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"2px" }}>{count} evaluaciones</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom:"2px solid #e2e8f0", marginBottom:"20px", display:"flex", gap:"4px" }}>
              {[["grades","📊 Notas"],["observations","💬 Observaciones"]].map(([k,l])=>(
                <button key={k} className={`tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === "grades" && (
              <>
                <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
                  {[["📅 Todas",0],...trimNames.map((n,i)=>[n,i+1])].map(([l,v])=>(
                    <button key={v} onClick={()=>setTrim(v)} style={{ padding:"7px 16px", borderRadius:"20px", background:trim===v?"#1e3a5f":"white", color:trim===v?"white":"#64748b", border:`1px solid ${trim===v?"#1e3a5f":"#e2e8f0"}`, cursor:"pointer", fontSize:"0.82rem", fontWeight:600 }}>{l}</button>
                  ))}
                </div>
                {Object.keys(subjectMap).length===0 ? (
                  <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📚</div>
                    <p>No hay evaluaciones para este período</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                    {Object.entries(subjectMap).map(([subject, sGrades]) => {
                      const sAvg = parseFloat(avg(sGrades.map(g=>g.score)));
                      // Promedio por trimestre de esta materia
                      const allSubjectGrades = allChildGrades.filter(g=>g.subject===subject);
                      const subTrimAvgs = [1,2,3].map(t => {
                        const tg = allSubjectGrades.filter(g=>g.trimester===t);
                        return { t, avg: avg(tg.map(g=>g.score)) };
                      });
                      return (
                        <div key={subject} className="card" style={{ overflow:"hidden" }}>
                          <div style={{ padding:"16px 20px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
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
                            {/* Promedios por trimestre de la materia */}
                            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                              {subTrimAvgs.map(({ t, avg: ta }) => ta !== "–" && (
                                <span key={t} style={{ fontSize:"0.75rem", padding:"3px 10px", borderRadius:"20px", background:`${scoreColor(parseFloat(ta))}15`, color:scoreColor(parseFloat(ta)), fontWeight:600, border:`1px solid ${scoreColor(parseFloat(ta))}30` }}>
                                  {trimNames[t-1]}: {ta}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {tab === "observations" && (
              <div>
                {childObs.length === 0 ? (
                  <div className="card" style={{ padding:"48px", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:"3rem", marginBottom:"12px" }}>💬</div>
                    <p>No hay observaciones registradas para {child.name}</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                    {childObs.map(o => (
                      <div key={o.id} className="card" style={{ padding:"16px 20px", borderLeft:"4px solid #7c3aed" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                          <div>
                            <span style={{ fontWeight:600, color:"#7c3aed", fontSize:"0.85rem" }}>Prof. {o.teacherName}</span>
                            {o.subjects && o.subjects.length > 0 && (
                              <span style={{ fontSize:"0.78rem", color:"#94a3b8", marginLeft:"8px" }}>· {o.subjects.join(", ")}</span>
                            )}
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
