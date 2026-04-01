// frontend/src/pages/admin/AdminUsers.tsx
// HU-045 — Gestión de usuarios desde backoffice

import { useState, useEffect } from 'react';

// ==========================================
// TIPOS
// ==========================================
type Role = 'user' | 'therapist' | 'admin' | 'superadmin';

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
}

interface Terapeuta {
  id: number;
  name: string;
  email: string;
}

// ==========================================
// HELPERS
// ==========================================
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Usa la misma key que AdminLayout y AdminSidebar
const getToken = () => localStorage.getItem('elevation_token') || '';

const getRoleBadgeStyle = (role: Role): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.2rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.03em',
  };
  const colors: Record<Role, React.CSSProperties> = {
    user:       { background: '#EAF0E6', color: '#4A6741' },
    therapist:  { background: '#E0F2FE', color: '#0369A1' },
    admin:      { background: '#FEF3C7', color: '#92400E' },
    superadmin: { background: '#FCE7F3', color: '#9D174D' },
  };
  return { ...base, ...colors[role] };
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export function AdminUsers() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Panel lateral
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);

  // Modal de creación
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    name: '', email: '', password: '', role: 'user' as Role,
  });
  const [creando, setCreando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [exitoModal, setExitoModal] = useState('');

  // Rol del admin logueado — usa elevation_role igual que AdminSidebar
  const role = localStorage.getItem('elevation_role') ?? 'admin';
  const esSuperAdmin = role === 'superadmin';

  // ==========================================
  // FETCH USUARIOS
  // ==========================================
  const fetchUsuarios = async () => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filtroRol) params.append('role', filtroRol);
      if (filtroEstado !== '') params.append('active', filtroEstado);

      const res = await fetch(`${API}/api/admin/usuarios?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Error obteniendo usuarios');
      const data = await res.json();
      setUsuarios(data);
      setTerapeutas(data.filter((u: Usuario) => u.role === 'therapist' && u.active));
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, [filtroRol, filtroEstado]);

  // ==========================================
  // ACCIONES DEL PANEL LATERAL
  // ==========================================
  const toggleActivo = async (usuario: Usuario) => {
    try {
      const res = await fetch(`${API}/api/admin/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ active: !usuario.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al actualizar usuario');
        return;
      }
      await fetchUsuarios();
      setUsuarioSeleccionado(prev => prev ? { ...prev, active: !prev.active } : null);
    } catch {
      alert('Error de conexión');
    }
  };

  const cambiarRol = async (usuario: Usuario, nuevoRol: Role) => {
    try {
      const res = await fetch(`${API}/api/admin/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role: nuevoRol }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al cambiar rol');
        return;
      }
      await fetchUsuarios();
      setUsuarioSeleccionado(prev => prev ? { ...prev, role: nuevoRol } : null);
    } catch {
      alert('Error de conexión');
    }
  };

  const asignarTerapeuta = async (usuarioId: number, therapistId: number | null) => {
    try {
      const res = await fetch(`${API}/api/admin/usuarios/${usuarioId}/asignar-terapeuta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ therapistId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al asignar terapeuta');
        return;
      }
      await fetchUsuarios();
    } catch {
      alert('Error de conexión');
    }
  };

  // ==========================================
  // CREAR USUARIO
  // ==========================================
  const crearUsuario = async () => {
    setErrorModal('');
    setExitoModal('');
    if (!nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password) {
      setErrorModal('Todos los campos son obligatorios.');
      return;
    }
    setCreando(true);
    try {
      const res = await fetch(`${API}/api/admin/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(nuevoUsuario),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorModal(data.error || 'Error al crear usuario');
        return;
      }
      setExitoModal(`Usuario ${data.usuario.name} creado exitosamente.`);
      setNuevoUsuario({ name: '', email: '', password: '', role: 'user' });
      await fetchUsuarios();
      setTimeout(() => { setMostrarModal(false); setExitoModal(''); }, 2000);
    } catch {
      setErrorModal('Error de conexión.');
    } finally {
      setCreando(false);
    }
  };

  // ==========================================
  // ESTILOS
  // ==========================================
  const styles = {
    container: {
      fontFamily: 'Inter, sans-serif',
    } as React.CSSProperties,

    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1.5rem',
      flexWrap: 'wrap' as const,
      gap: '1rem',
    },

    titulo: {
      fontFamily: 'Playfair Display, serif',
      fontWeight: 300,
      fontSize: '1.8rem',
      color: '#1C1917',
      margin: 0,
    },

    btnCrear: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.6rem 1.2rem',
      background: '#6B7D5C',
      color: '#fff',
      border: 'none',
      borderRadius: '0.85rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
    } as React.CSSProperties,

    filtros: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1.25rem',
      flexWrap: 'wrap' as const,
    },

    select: {
      padding: '0.45rem 0.85rem',
      borderRadius: '0.65rem',
      border: '0.5px solid #E7E5E4',
      background: '#fff',
      fontSize: '0.875rem',
      color: '#1C1917',
      fontFamily: 'Inter, sans-serif',
      cursor: 'pointer',
    } as React.CSSProperties,

    tabla: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      background: '#fff',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
      border: '0.5px solid #E7E5E4',
    },

    th: {
      padding: '0.85rem 1rem',
      textAlign: 'left' as const,
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#78716C',
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      borderBottom: '0.5px solid #E7E5E4',
      background: '#F5F3EF',
    },

    td: {
      padding: '0.85rem 1rem',
      fontSize: '0.875rem',
      color: '#1C1917',
      borderBottom: '0.5px solid #F5F3EF',
      verticalAlign: 'middle' as const,
    },

    btnAccion: {
      background: 'none',
      border: '0.5px solid #E7E5E4',
      borderRadius: '0.5rem',
      padding: '0.3rem 0.65rem',
      cursor: 'pointer',
      fontSize: '0.875rem',
      color: '#78716C',
    } as React.CSSProperties,
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>Usuarios</h1>
          <p style={{ fontSize: '0.875rem', color: '#78716C', margin: '0.25rem 0 0' }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button style={styles.btnCrear} onClick={() => setMostrarModal(true)}>
          + Crear usuario
        </button>
      </div>

      {/* FILTROS */}
      <div style={styles.filtros}>
        <select style={styles.select} value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          <option value="user">User</option>
          <option value="therapist">Therapist</option>
          <option value="admin">Admin</option>
          {esSuperAdmin && <option value="superadmin">Superadmin</option>}
        </select>
        <select style={styles.select} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* CARGA / ERROR */}
      {cargando && (
        <p style={{ color: '#78716C', fontSize: '0.875rem' }}>Cargando usuarios...</p>
      )}
      {error && (
        <p style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</p>
      )}

      {/* LAYOUT: TABLA + PANEL LATERAL */}
      {!cargando && !error && (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

          {/* TABLA */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table style={styles.tabla}>
              <thead>
                <tr>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Rol</th>
                  <th style={styles.th}>Sesiones</th>
                  <th style={styles.th}>Mood prom.</th>
                  <th style={styles.th}>Rating prom.</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#78716C', padding: '2rem' }}>
                      No hay usuarios con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr
                      key={u.id}
                      style={{
                        background: usuarioSeleccionado?.id === u.id ? '#EAF0E6' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#78716C' }}>{u.email}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={getRoleBadgeStyle(u.role)}>{u.role}</span>
                      </td>
                      <td style={styles.td}>{u.sesiones ?? '—'}</td>
                      <td style={styles.td}>{u.moodPromedio != null ? u.moodPromedio : '—'}</td>
                      <td style={styles.td}>{u.ratingPromedio != null ? `${u.ratingPromedio} ★` : '—'}</td>
                      <td style={styles.td}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px', height: '8px',
                          borderRadius: '50%',
                          background: u.active ? '#22C55E' : '#EF4444',
                          marginRight: '0.4rem',
                        }} />
                        {u.active ? 'Activo' : 'Inactivo'}
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.btnAccion}
                          onClick={() => setUsuarioSeleccionado(
                            usuarioSeleccionado?.id === u.id ? null : u
                          )}
                        >
                          {usuarioSeleccionado?.id === u.id ? '✕' : '···'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PANEL LATERAL */}
          {usuarioSeleccionado && (
            <div style={{
              width: '280px',
              flexShrink: 0,
              background: '#fff',
              borderRadius: '1rem',
              border: '0.5px solid #E7E5E4',
              boxShadow: '0 2px 12px rgba(26,28,27,0.06)',
              padding: '1.25rem',
              fontFamily: 'Inter, sans-serif',
            }}>

              {/* Info usuario */}
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #F5F3EF' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1C1917', marginBottom: '0.2rem' }}>
                  {usuarioSeleccionado.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78716C' }}>{usuarioSeleccionado.email}</div>
                <div style={{ fontSize: '0.75rem', color: '#A8B5A2', marginTop: '0.35rem' }}>
                  Desde {formatDate(usuarioSeleccionado.createdAt)}
                </div>
              </div>

              {/* Stats */}
              <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #F5F3EF' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  Estadísticas
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {[
                    { label: 'Sesiones', value: usuarioSeleccionado.sesiones ?? '—' },
                    { label: 'Mood', value: usuarioSeleccionado.moodPromedio ?? '—' },
                    { label: 'Rating', value: usuarioSeleccionado.ratingPromedio ? `${usuarioSeleccionado.ratingPromedio}★` : '—' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      flex: 1, textAlign: 'center',
                      background: '#F5F3EF', borderRadius: '0.65rem', padding: '0.5rem 0.25rem',
                    }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1C1917' }}>{stat.value}</div>
                      <div style={{ fontSize: '0.68rem', color: '#78716C' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cambiar rol */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Rol
                </div>
                <select
                  style={{ ...styles.select, width: '100%' }}
                  value={usuarioSeleccionado.role}
                  onChange={e => cambiarRol(usuarioSeleccionado, e.target.value as Role)}
                >
                  <option value="user">user</option>
                  <option value="therapist">therapist</option>
                  {esSuperAdmin && <option value="admin">admin</option>}
                  {esSuperAdmin && <option value="superadmin">superadmin</option>}
                </select>
              </div>

              {/* Asignar terapeuta (solo para users) */}
              {usuarioSeleccionado.role === 'user' && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Terapeuta asignado
                  </div>
                  <select
                    style={{ ...styles.select, width: '100%' }}
                    value={usuarioSeleccionado.therapistId ?? ''}
                    onChange={e => asignarTerapeuta(
                      usuarioSeleccionado.id,
                      e.target.value ? Number(e.target.value) : null
                    )}
                  >
                    <option value="">Sin asignar</option>
                    {terapeutas.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Activar / Desactivar */}
              <button
                onClick={() => toggleActivo(usuarioSeleccionado)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '0.85rem',
                  border: 'none',
                  background: usuarioSeleccionado.active ? '#FEE2E2' : '#EAF0E6',
                  color: usuarioSeleccionado.active ? '#DC2626' : '#4A6741',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {usuarioSeleccionado.active ? 'Desactivar usuario' : 'Activar usuario'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CREACIÓN */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,25,23,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '1rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 8px 32px rgba(26,28,27,0.12)',
            fontFamily: 'Inter, sans-serif',
          }}>

            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.3rem', color: '#1C1917', margin: 0 }}>
                Crear usuario
              </h2>
              <button
                onClick={() => { setMostrarModal(false); setErrorModal(''); setExitoModal(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#78716C' }}
              >
                ✕
              </button>
            </div>

            {/* Feedback */}
            {errorModal && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {errorModal}
              </div>
            )}
            {exitoModal && (
              <div style={{ background: '#EAF0E6', color: '#4A6741', padding: '0.65rem 1rem', borderRadius: '0.65rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {exitoModal}
              </div>
            )}

            {/* Campos */}
            {[
              { label: 'Nombre completo', key: 'name', type: 'text', placeholder: 'Ana García' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'ana@example.com' },
              { label: 'Contraseña temporal', key: 'password', type: 'password', placeholder: 'Mínimo 8 caracteres' },
            ].map(campo => (
              <div key={campo.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  {campo.label}
                </label>
                <input
                  type={campo.type}
                  placeholder={campo.placeholder}
                  value={nuevoUsuario[campo.key as keyof typeof nuevoUsuario]}
                  onChange={e => setNuevoUsuario(prev => ({ ...prev, [campo.key]: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0.65rem',
                    border: '0.5px solid #E7E5E4',
                    fontSize: '0.875rem',
                    fontFamily: 'Inter, sans-serif',
                    color: '#1C1917',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            ))}

            {/* Rol */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Rol
              </label>
              <select
                style={{ ...styles.select, width: '100%' }}
                value={nuevoUsuario.role}
                onChange={e => setNuevoUsuario(prev => ({ ...prev, role: e.target.value as Role }))}
              >
                <option value="user">user</option>
                <option value="therapist">therapist</option>
                {esSuperAdmin && <option value="admin">admin</option>}
                {esSuperAdmin && <option value="superadmin">superadmin</option>}
              </select>
            </div>

            {/* Botón crear */}
            <button
              onClick={crearUsuario}
              disabled={creando}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: creando ? '#A8B5A2' : '#6B7D5C',
                color: '#fff',
                border: 'none',
                borderRadius: '0.85rem',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: creando ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {creando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
