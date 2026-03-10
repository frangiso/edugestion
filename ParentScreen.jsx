import { useState, useEffect } from "react";
import { TopBar, GLOBAL_STYLES, trimNames, avg, scoreColor } from "../components";
import { getAllStudents, getGradesByStudent } from "../db";

export default function ParentScreen({ user, profile, logout }) {
  const [students, setStudents] = useState([]);
  const [gradesMap, setGradesMap] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [trim, setTrim] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const allStudents = await getAllStudents();
    const myChildren = allStudents.filter(s =>
      (profile.childIds||[]).includes(s.id) || s.tutorEmail === profile.email
    );
    setStudents(myChildren);
    if (myChildren.length > 0) {
      setSelectedChild(myChildren[0]);
      const map = {};
      await Promise.all(myChildren.map(async c => {
        map[c.id] = await getGradesByStudent(c.id);
      }));
      setGradesMap(map);
    }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ textAlign:"center", padding:"80px", color:"#94a3b8" }}>Cargando notas...</div>
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
  const childGrades = child ? (gradesMap[child.id]||[]).filter(g => trim===0 || g.trimester===trim) : [];
  const subjectMap = {};
  childGrades.forEach(g => { if (!subjectMap[g.subject]) subjectMap[g.subject]=[]; subjectMap[g.subject].push(g); });
  const allChildGrades = child ? (gradesMap[child.id]||[]) : [];
  const globalAvg = avg(allChildGrades.map(g=>g.score));

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'Source Sans 3',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <TopBar profile={profile} saving={false} logout={logout} subtitle="Portal de Familias" />
      <div style={{ maxWidth:"960px", margin:"0 auto", padding:"24px 20px" }}>

        {students.length > 1 && (
          <div style={{ display:"flex", gap:"12px", marginBottom:"24px" }}>
            {students.map(c => (
              <button key={c.id} onClick={()=>setSelectedChild(c)} style={{ padding:"10px 20px", borderRadius:"12px", border:`2px solid ${child?.id===c.id?"#1e3a5f":"#e2e8f0"}`, background:child?.id===c.id?"#1e3a5f":"white", color:child?.id===c.id?"white":"#475569", cursor:"pointer", fontWeight:600, fontSize:"0.9rem" }}>
                {c.name} <span style={{ opacity:0.6, fontSize:"0.8rem" }}>({c.grade})</span>
              </button>
            ))}
          </div>
        )}

        {child && (
          <>
            <div className="card" style={{ padding:"24px 28px", marginBottom:"24px", display:"flex", justifyContent:"space-between", alignItems:"center", borderLeft:"5px solid #1e3a5f" }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", color:"#1e3a5f", margin:"0 0 4px", fontSize:"1.6rem" }}>{child.name}</h2>
                <span className="badge" style={{ background:"#dbeafe", color:"#1e40af" }}>{child.grade}</span>
              </div>
              <div style={{ display:"flex", gap:"28px", textAlign:"center" }}>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color: globalAvg==="–"?"#94a3b8":scoreColor(parseFloat(globalAvg)), fontFamily:"'Playfair Display',serif" }}>{globalAvg}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Promedio general</div>
                </div>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#1e3a5f", fontFamily:"'Playfair Display',serif" }}>{allChildGrades.length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Evaluaciones</div>
                </div>
                <div>
                  <div style={{ fontSize:"2rem", fontWeight:800, color:"#1e3a5f", fontFamily:"'Playfair Display',serif" }}>{Object.keys(subjectMap).length || Object.keys((gradesMap[child.id]||[]).reduce((a,g)=>({...a,[g.subject]:1}),{})).length}</div>
                  <div style={{ fontSize:"0.72rem", color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.5px" }}>Materias</div>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
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
      </div>
    </div>
  );
}
