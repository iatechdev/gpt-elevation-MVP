// HU-045 + HU-060 + HU-077 — User management + matching requests + plan requests

import { useState, useEffect } from 'react';

type Role = 'user' | 'therapist' | 'admin' | 'superadmin' | 'board';

interface Usuario {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  therapistId: number | null;
  createdAt: string;
  sesiones: number;
  ratingPromedio: number | null;
  moodPromedio: number | null;
  plan: { id: number; slug: string; name_es: string; name_en: string } | null;
}

interface Terapeuta {
  id: number;
  name: string;
  email: string;
}

interface MatchingRequest {
  id: number;
  user: { id: number; name: string; email: string };
  chosenTherapist: { id: number; name: string };
  answers: { area?: string; style?: string; language?: string };
  createdAt: string;
}

// HU-077
interface PlanRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  requester: { id: number; name: string; email: string };
  plan: { id: number; slug: string; name_es: string; name_en: string; price: number; currency: string };
}

const API = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080';
const getToken = () => localStorage.getItem('elevation_token') ?? '';

const getRoleBadgeStyle = (role: Role): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '999px',
    fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', letterSpacing: '0.03em',
  };
  const colors: Record<Role, React.CSSProperties> = {
    user:       { background: '#EAF0E6', color: '#4A6741' },
    therapist:  { background: '#E0F2FE', color: '#0369A1' },
    admin:      { background: '#FEF3C7', color: '#92400E' },
    superadmin: { background: '#FCE7F3', color: '#9D174D' },
    board:      { background: '#F0FDF4', color: '#166534' },
  };
  return { ...base, ...colors[role] };
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

export function AdminUsers() {
  const [usuarios,            setUsuarios]            = useState<Usuario[]>([]);
  const [terapeutas,          setTerapeutas]          = useState<Terapeuta[]>([]);
  const [cargando,            setCargando]            = useState(true);
  const [error,               setError]               = useState('');
  const [filtroRol,           setFiltroRol]           = useState('');
  const [filtroEstado,        setFiltroEstado]        = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [mostrarModal,        setMostrarModal]        = useState(false);
  const [nuevoUsuario,        setNuevoUsuario]        = useState({ name: '', email: '', password: '', role: 'user' as Role });
  const [creando,             setCreando]             = useState(false);
  const [errorModal,          setErrorModal]          = useState('');
  const [exitoModal,          setExitoModal]          = useState('');

  // HU-060 — Matching requests
  const [matchingRequests, setMatchingRequests] = useState<MatchingRequest[]>([]);
  const [showMatching,     setShowMatching]     = useState(false);
  const [confirmingId,     setConfirmingId]     = useState<number | null>(null);

  // HU-077 — Plan requests
  const [planRequests,     setPlanRequests]     = useState<PlanRequest[]>([]);
  const [showPlanRequests, setShowPlanRequests] = useState(false);
  const [planActionId,     setPlanActionId]     = useState<number | null>(null);
  const [planRejectNote,   setPlanRejectNote]   = useState('');
  const [showRejectModal,  setShowRejectModal]  = useState<PlanRequest | null>(null);
  const [planMsg,          setPlanMsg]          = useState('');

  const role         = localStorage.getItem('elevation_role') ?? 'admin';
  const esSuperAdmin = role === 'superadmin';

  const fetchUsuarios = async () => {
    setCargando(true); setError('');
    try {
      const params = new URLSearchParams();
      if (filtroRol)    params.append('role',   filtroRol);
      if (filtroEstado) params.append('active', filtroEstado);
      const res = await fetch(`${API}/api/admin/usuarios?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsuarios(data);
      setTerapeutas(data.filter((u: Usuario) => u.role === 'therapist' && u.active));
    } catch { setError('No se pudo cargar la lista de usuarios.'); }
    finally   { setCargando(false); }
  };

  const fetchMatching = async () => {
    try {
      const res = await fetch(`${API}/api/admin/matching/pending`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMatchingRequests(data);
    } catch { /* silent */ }
  };

  // HU-077
  const fetchPlanRequests = async () => {
    try {
      const res = await fetch(`${API}/api/admin/plan-requests/admin?status=pending`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPlanRequests(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchMatching();
    fetchPlanRequests();
  }, [filtroRol, filtroEstado]);

  const confirmMatching = async (requestId: number) => {
    setConfirmingId(requestId);
    try {
      const res = await fetch(`${API}/api/admin/matching/${requestId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return; }
      await fetchMatching();
      await fetchUsuarios();
    } catch { alert('Connection error'); }
    finally { setConfirmingId(null); }
  };

  // HU-077 — Aprobar solicitud de plan
  const approvePlanRequest = async (req: PlanRequest) => {
    setPlanActionId(req.id);
    setPlanMsg('');
    try {
      const res = await fetch(`${API}/api/admin/plan-requests/admin/${req.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ adminNote: '' }),
      });
      const data = await res.json();
      if (!res.ok) { setPlanMsg(data.error ?? 'Error al aprobar.'); return; }
      setPlanMsg(`✓ Plan ${req.plan.name_es} activado para ${req.requester.name}.`);
      await fetchPlanRequests();
      await fetchUsuarios();
    } catch { setPlanMsg('Error de conexión.'); }
    finally { setPlanActionId(null); }
  };

  // HU-077 — Rechazar solicitud de plan
  const rejectPlanRequest = async (req: PlanRequest) => {
    if (!planRejectNote.trim()) return;
    setPlanActionId(req.id);
    try {
      const res = await fetch(`${API}/api/admin/plan-requests/admin/${req.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ adminNote: planRejectNote }),
      });
      const data = await res.json();
      if (!res.ok) { setPlanMsg(data.error ?? 'Error al rechazar.'); return; }
      setPlanMsg(`Solicitud de ${req.requester.name} rechazada.`);
      setShowRejectModal(null);
      setPlanRejectNote('');
      await fetchPlanRequests();
    } catch { setPlanMsg('Error de conexión.'); }
    finally { setPlanActionId(null); }
  };

  const toggleActivo = async (usuario: Usuario) => {
    const res = await fetch(`${API}/api/admin/usuarios/${usuario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ active: !usuario.active }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return; }
    await fetchUsuarios();
    setUsuarioSeleccionado(prev => prev ? { ...prev, active: !prev.active } : null);
  };

  const cambiarRol = async (usuario: Usuario, nuevoRol: Role) => {
    const res = await fetch(`${API}/api/admin/usuarios/${usuario.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ role: nuevoRol }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return; }
    await fetchUsuarios();
    setUsuarioSeleccionado(prev => prev ? { ...prev, role: nuevoRol } : null);
  };

  const asignarTerapeuta = async (usuarioId: number, therapistId: number | null) => {
    try {
      const res = await fetch(`${API}/api/admin/usuarios/${usuarioId}/asignar-terapeuta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ therapistId }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Error al asignar terapeuta'); return; }
      await fetchUsuarios();
      setUsuarioSeleccionado(prev =>
        prev?.id === usuarioId ? { ...prev, therapistId } : prev
      );
    } catch { alert('Connection error'); }
  };

  const crearUsuario = async () => {
    setErrorModal(''); setExitoModal('');
    if (!nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password) {
      setErrorModal('Todos los campos son obligatorios.'); return;
    }
    setCreando(true);
    try {
      const res = await fetch(`${API}/api/admin/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(nuevoUsuario),
      });
      const data = await res.json();
      if (!res.ok) { setErrorModal(data.error || 'Error al crear usuario'); return; }
      setExitoModal(`Usuario ${data.usuario.name} creado exitosamente.`);
      setNuevoUsuario({ name: '', email: '', password: '', role: 'user' });
      await fetchUsuarios();
      setTimeout(() => { setMostrarModal(false); setExitoModal(''); }, 2000);
    } catch { setErrorModal('Error de conexión.'); }
    finally { setCreando(false); }
  };

  const sel = {
    padding: '0.45rem 0.85rem', borderRadius: '0.65rem', border: '0.5px solid #E7E5E4',
    background: '#fff', fontSize: '0.875rem', color: '#1C1917',
    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
  } as React.CSSProperties;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, fontSize: '1.8rem', color: '#1C1917', margin: 0 }}>Usuarios</h1>
          <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Botón plan requests — HU-077 */}
          {planRequests.length > 0 && (
            <button
              onClick={() => setShowPlanRequests(!showPlanRequests)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.2rem', background: '#EEF2FF',
                color: '#4F46E5', border: '0.5px solid #A5B4FC',
                borderRadius: '0.85rem', fontSize: '0.875rem',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              💳 {planRequests.length} plan request{planRequests.length !== 1 ? 's' : ''}
            </button>
          )}

          {matchingRequests.length > 0 && (
            <button
              onClick={() => setShowMatching(!showMatching)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.2rem', background: '#FEF3C7',
                color: '#92400E', border: '0.5px solid #FCD34D',
                borderRadius: '0.85rem', fontSize: '0.875rem',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              🤝 {matchingRequests.length} matching pending
            </button>
          )}

          <button onClick={() => setMostrarModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem',
            background: '#6B7D5C', color: '#fff', border: 'none', borderRadius: '0.85rem',
            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            + Crear usuario
          </button>
        </div>
      </div>

      {/* PLAN REQUESTS PANEL — HU-077 */}
      {showPlanRequests && (
        <div style={{
          background: '#fff', borderRadius: '1rem', border: '0.5px solid #A5B4FC',
          boxShadow: '0 2px 12px rgba(26,28,27,0.06)', padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1rem' }}>
            💳 Solicitudes de plan pendientes
          </h2>

          {planMsg && (
            <div style={{
              padding: '0.65rem 1rem', borderRadius: '0.65rem', marginBottom: '1rem', fontSize: '0.875rem',
              background: planMsg.startsWith('✓') ? '#EAF0E6' : '#FEE2E2',
              color: planMsg.startsWith('✓') ? '#4A6741' : '#DC2626',
            }}>
              {planMsg}
            </div>
          )}

          {planRequests.length === 0 ? (
            <p style={{ color: '#78716C', fontSize: '0.875rem', margin: 0 }}>No hay solicitudes pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {planRequests.map(req => (
                <div key={req.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem', background: '#F5F7FF', borderRadius: '0.75rem',
                  border: '0.5px solid #A5B4FC', flexWrap: 'wrap', gap: '0.75rem',
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1C1917' }}>
                      {req.requester.name}
                      <span style={{ fontWeight: 400, color: '#78716C' }}> → </span>
                      <span style={{ color: '#4F46E5', fontWeight: 600 }}>{req.plan.name_es}</span>
                      <span style={{ fontSize: '0.78rem', color: '#78716C', marginLeft: 6 }}>
                        ${req.plan.price} {req.plan.currency}/mes
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#78716C', marginTop: '0.2rem' }}>
                      {req.requester.email} · {formatDate(req.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => void approvePlanRequest(req)}
                      disabled={planActionId === req.id}
                      style={{
                        padding: '0.45rem 1rem',
                        background: planActionId === req.id ? '#A8B5A2' : '#6B7D5C',
                        color: '#fff', border: 'none', borderRadius: '0.65rem',
                        fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {planActionId === req.id ? 'Procesando...' : '✓ Aprobar'}
                    </button>
                    <button
                      onClick={() => { setShowRejectModal(req); setPlanRejectNote(''); setPlanMsg(''); }}
                      disabled={planActionId === req.id}
                      style={{
                        padding: '0.45rem 1rem',
                        background: 'transparent', color: '#DC2626',
                        border: '0.5px solid #DC2626', borderRadius: '0.65rem',
                        fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MATCHING REQUESTS PANEL */}
      {showMatching && matchingRequests.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '1rem', border: '0.5px solid #FCD34D',
          boxShadow: '0 2px 12px rgba(26,28,27,0.06)', padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: '0 0 1rem' }}>
            🤝 Pending matching requests
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {matchingRequests.map(req => (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1rem', background: '#FFFBEB', borderRadius: '0.75rem',
                border: '0.5px solid #FCD34D', flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1C1917' }}>
                    {req.user?.name} → {req.chosenTherapist?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#78716C', marginTop: '0.2rem' }}>
                    Area: {req.answers?.area ?? '—'} · Style: {req.answers?.style ?? '—'} · {formatDate(req.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => confirmMatching(req.id)}
                  disabled={confirmingId === req.id}
                  style={{
                    padding: '0.45rem 1rem', background: confirmingId === req.id ? '#A8B5A2' : '#6B7D5C',
                    color: '#fff', border: 'none', borderRadius: '0.65rem',
                    fontSize: '0.82rem', fontWeight: 500,
                    cursor: confirmingId === req.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {confirmingId === req.id ? 'Confirming...' : 'Confirm assignment'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select style={sel} value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          <option value="user">User</option>
          <option value="therapist">Therapist</option>
          <option value="admin">Admin</option>
          {esSuperAdmin && <option value="superadmin">Superadmin</option>}
          {esSuperAdmin && <option value="board">Board</option>}
        </select>
        <select style={sel} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {cargando && <p style={{ color: '#78716C', fontSize: '0.875rem' }}>Cargando usuarios...</p>}
      {error    && <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>}

      {!cargando && !error && (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

          {/* TABLA */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,28,27,0.06)', border: '0.5px solid #E7E5E4' }}>
              <thead>
                <tr>
                  {['Usuario', 'Rol', 'Plan', 'Sesiones', 'Mood prom.', 'Rating prom.', 'Estado', 'Acción'].map(h => (
                    <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#78716C', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '0.5px solid #E7E5E4', background: '#F5F3EF' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#78716C', fontSize: '0.875rem' }}>No hay usuarios con los filtros seleccionados.</td></tr>
                ) : usuarios.map(u => (
                  <tr key={u.id} style={{ background: usuarioSeleccionado?.id === u.id ? '#EAF0E6' : 'transparent', transition: 'background 0.15s' }}>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1C1917', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#78716C' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>
                      <span style={getRoleBadgeStyle(u.role)}>{u.role}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>
                      {u.plan ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: '#EEF2FF', color: '#4F46E5' }}>
                          {u.plan.name_es}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#A8A29E' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1C1917', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>{u.sesiones ?? '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1C1917', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>{u.moodPromedio != null ? u.moodPromedio : '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1C1917', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>{u.ratingPromedio != null ? `${u.ratingPromedio} ★` : '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#1C1917', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: u.active ? '#22C55E' : '#EF4444', marginRight: '0.4rem' }} />
                      {u.active ? 'Activo' : 'Inactivo'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #F5F3EF', verticalAlign: 'middle' }}>
                      <button onClick={() => setUsuarioSeleccionado(usuarioSeleccionado?.id === u.id ? null : u)}
                        style={{ background: 'none', border: '0.5px solid #E7E5E4', borderRadius: '0.5rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.875rem', color: '#78716C' }}>
                        {usuarioSeleccionado?.id === u.id ? '✕' : '···'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PANEL LATERAL */}
          {usuarioSeleccionado && (
            <div style={{ width: 280, flexShrink: 0, background: '#fff', borderRadius: '1rem', border: '0.5px solid #E7E5E4', boxShadow: '0 2px 12px rgba(26,28,27,0.06)', padding: '1.25rem' }}>
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #F5F3EF' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1C1917', marginBottom: '0.2rem' }}>{usuarioSeleccionado.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#78716C' }}>{usuarioSeleccionado.email}</div>
                <div style={{ fontSize: '0.75rem', color: '#A8B5A2', marginTop: '0.35rem' }}>Desde {formatDate(usuarioSeleccionado.createdAt)}</div>
              </div>
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #F5F3EF' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>Estadísticas</div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {[
                    { label: 'Sesiones', value: usuarioSeleccionado.sesiones ?? '—' },
                    { label: 'Mood',     value: usuarioSeleccionado.moodPromedio ?? '—' },
                    { label: 'Rating',   value: usuarioSeleccionado.ratingPromedio ? `${usuarioSeleccionado.ratingPromedio}★` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, textAlign: 'center', background: '#F5F3EF', borderRadius: '0.65rem', padding: '0.5rem 0.25rem' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1C1917' }}>{s.value}</div>
                      <div style={{ fontSize: '0.68rem', color: '#78716C' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Rol</div>
                <select style={{ ...sel, width: '100%' }} value={usuarioSeleccionado.role} onChange={e => cambiarRol(usuarioSeleccionado, e.target.value as Role)}>
                  <option value="user">user</option>
                  <option value="therapist">therapist</option>
                  {esSuperAdmin && <option value="admin">admin</option>}
                  {esSuperAdmin && <option value="superadmin">superadmin</option>}
                  {esSuperAdmin && <option value="board">board</option>}
                </select>
              </div>
              {usuarioSeleccionado.role === 'user' && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Terapeuta asignado</div>
                  <select style={{ ...sel, width: '100%' }} value={usuarioSeleccionado.therapistId ?? ''}
                    onChange={e => asignarTerapeuta(usuarioSeleccionado.id, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sin asignar</option>
                    {terapeutas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={() => toggleActivo(usuarioSeleccionado)} style={{
                width: '100%', padding: '0.6rem', borderRadius: '0.85rem', border: 'none',
                background: usuarioSeleccionado.active ? '#FEE2E2' : '#EAF0E6',
                color: usuarioSeleccionado.active ? '#DC2626' : '#4A6741',
                fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                {usuarioSeleccionado.active ? 'Desactivar usuario' : 'Activar usuario'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL RECHAZO PLAN — HU-077 */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(26,28,27,0.12)' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.2rem', color: '#1C1917', margin: '0 0 0.5rem' }}>
              ✕ Rechazar solicitud
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0 0 1.25rem' }}>
              Explicá por qué rechazás la solicitud de <strong>{showRejectModal.requester.name}</strong> para el plan <strong>{showRejectModal.plan.name_es}</strong>.
            </p>
            <textarea
              value={planRejectNote}
              onChange={e => setPlanRejectNote(e.target.value)}
              placeholder="Ej: El plan seleccionado no está disponible actualmente..."
              rows={3}
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.65rem', border: '0.5px solid #D6D2C4', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => { setShowRejectModal(null); setPlanRejectNote(''); }}
                style={{ padding: '0.6rem 1.25rem', background: 'transparent', color: '#78716C', border: '0.5px solid #E7E5E4', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
                Cancelar
              </button>
              <button
                onClick={() => void rejectPlanRequest(showRejectModal)}
                disabled={!planRejectNote.trim() || planActionId === showRejectModal.id}
                style={{ padding: '0.6rem 1.25rem', background: !planRejectNote.trim() ? '#E7E5E4' : '#DC2626', color: !planRejectNote.trim() ? '#A8A29E' : '#fff', border: 'none', borderRadius: '0.75rem', cursor: planRejectNote.trim() ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                {planActionId === showRejectModal.id ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREACIÓN USUARIO */}
      {mostrarModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(26,28,27,0.12)', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>Crear usuario</h2>
              <button onClick={() => { setMostrarModal(false); setErrorModal(''); setExitoModal(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C' }}>✕</button>
            </div>
            {errorModal && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{errorModal}</div>}
            {exitoModal && <div style={{ background: '#EAF0E6', color: '#4A6741', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>{exitoModal}</div>}
            {[
              { label: 'Nombre completo',     key: 'name',     type: 'text',     placeholder: 'Ana García' },
              { label: 'Email',               key: 'email',    type: 'email',    placeholder: 'ana@example.com' },
              { label: 'Contraseña temporal', key: 'password', type: 'password', placeholder: 'Mínimo 8 caracteres' },
            ].map(campo => (
              <div key={campo.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>{campo.label}</label>
                <input type={campo.type} placeholder={campo.placeholder}
                  value={nuevoUsuario[campo.key as keyof typeof nuevoUsuario]}
                  onChange={e => setNuevoUsuario(prev => ({ ...prev, [campo.key]: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.65rem', border: '0.5px solid #E7E5E4', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', color: '#1C1917', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Rol</label>
              <select style={{ ...sel, width: '100%' }} value={nuevoUsuario.role} onChange={e => setNuevoUsuario(prev => ({ ...prev, role: e.target.value as Role }))}>
                <option value="user">user</option>
                <option value="therapist">therapist</option>
                {esSuperAdmin && <option value="admin">admin</option>}
                {esSuperAdmin && <option value="superadmin">superadmin</option>}
                {esSuperAdmin && <option value="board">board</option>}
              </select>
            </div>
            <button onClick={crearUsuario} disabled={creando} style={{
              width: '100%', padding: '0.75rem', background: creando ? '#A8B5A2' : '#6B7D5C',
              color: '#fff', border: 'none', borderRadius: '0.85rem', fontSize: '0.9rem',
              fontWeight: 500, cursor: creando ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}