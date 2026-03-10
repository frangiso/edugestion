export const trimNames = ["1er Trimestre", "2do Trimestre", "3er Trimestre"];

export const avg = (scores) =>
  scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "–";

export const scoreColor = (s) => {
  if (s >= 8) return "#10b981";
  if (s >= 6) return "#f59e0b";
  return "#ef4444";
};

export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800&family=Source+Sans+3:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  input, select, textarea { font-family: 'Source Sans 3', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #e2e8f0; }
  ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
  .card { background: white; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.07); }
  .btn-primary { background: #1e3a5f; color: white; border: none; border-radius: 10px; padding: 10px 20px; cursor: pointer; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; font-weight: 600; transition: background 0.2s; }
  .btn-primary:hover { background: #2d5282; }
  .btn-danger { background: #fee2e2; color: #dc2626; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.8rem; font-weight: 600; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="date"], select, textarea {
    border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; width: 100%; font-size: 0.9rem; outline: none; transition: border 0.2s; background: #f8fafc;
  }
  input:focus, select:focus, textarea:focus { border-color: #1e3a5f; background: white; }
  label { font-size: 0.82rem; font-weight: 600; color: #475569; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .tab { padding: 8px 18px; border: none; background: none; cursor: pointer; font-family: 'Source Sans 3', sans-serif; font-size: 0.85rem; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .tab.active { color: #1e3a5f; border-bottom-color: #1e3a5f; }
  .tab:hover { color: #1e3a5f; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .fade { animation: fadeIn 0.3s ease; }
`;

export function TopBar({ profile, saving, logout, subtitle }) {
  return (
    <div style={{ background:"#1e3a5f", padding:"0 24px", height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 12px rgba(0,0,0,0.15)", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <span style={{ fontSize:"1.4rem" }}>🎓</span>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", color:"white", fontWeight:700, fontSize:"1.05rem", lineHeight:1 }}>EduGestión</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.7rem", letterSpacing:"1px", textTransform:"uppercase" }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
        {saving && <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.75rem" }}>💾 Guardando...</span>}
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"white", fontSize:"0.85rem", fontWeight:600 }}>{profile?.name}</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.7rem" }}>{profile?.email}</div>
        </div>
        <button onClick={logout} style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"white", borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"0.8rem" }}>Salir</button>
      </div>
    </div>
  );
}
