import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';

const API = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:3001`;

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function App() {
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [esJefe, setEsJefe] = useState(false);
  const [grupoJefe, setGrupoJefe] = useState(null);
  
  const [tab, setTab] = useState('CARGA'); // CARGA | HORAS | JEFATURA
  
  const [catalogos, setCatalogos] = useState({ provincias: [], vehiculos: [], operarios: [] });
  const [contratosDisponibles, setContratosDisponibles] = useState([]); 
  const [reportes, setReportes] = useState([]);

  // Campos comunes
  const [dia, setDia] = useState(new Date().toISOString().split('T')[0]);
  const [provincia, setProvincia] = useState('');
  const [moviles, setMoviles] = useState('');
  const [operariosCuil, setOperariosCuil] = useState('');

  // Contratos seleccionados (multi)
  const [contratosElegidos, setContratosElegidos] = useState([]);
  const [detalles, setDetalles] = useState({});

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Filtros de horas
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState(new Date().getDate() <= 15 ? 1 : 2);
  const [resumenHoras, setResumenHoras] = useState(null);
  const [feriadosQ, setFeriadosQ] = useState({}); // { "2026-06-15": true }

  // Jefatura
  const [pendientesJefatura, setPendientesJefatura] = useState([]);
  const [correccionesJefatura, setCorreccionesJefatura] = useState({});

  // Detalle Modal
  const [tareaDetalle, setTareaDetalle] = useState(null);

  useEffect(() => {
    if (usuarioEmail) {
      verificarPerfil();
      cargarDatos();
      cargarHoras();
    }
  }, [usuarioEmail]);

  useEffect(() => {
    if (usuarioEmail) {
      if (tab === 'HORAS') cargarHoras();
      if (tab === 'JEFATURA' && esJefe) cargarPendientesJefatura();
    }
  }, [anioSeleccionado, mesSeleccionado, quincenaSeleccionada, tab, usuarioEmail, esJefe]);

  const verificarPerfil = () => {
    axios.get(`${API}/auth/perfil?email=${usuarioEmail}`)
      .then(r => {
        setEsJefe(r.data.esJefe);
        setGrupoJefe(r.data.grupo);
      })
      .catch(e => console.error('Error perfil:', e));
  };

  const cargarDatos = () => {
    axios.get(`${API}/catalogos`).then(r => setCatalogos(r.data)).catch(e => console.error(e));
    axios.get(`${API}/contratos-tareas`).then(r => setContratosDisponibles(r.data)).catch(e => console.error(e));
    axios.get(`${API}/reporte-completo?email=${usuarioEmail}`).then(r => setReportes(r.data)).catch(e => console.error(e));
  };

  const cargarHoras = () => {
    axios.get(`${API}/reporte-horas?email=${usuarioEmail}&anio=${anioSeleccionado}&mes=${mesSeleccionado}&quincena=${quincenaSeleccionada}`)
      .then(r => setResumenHoras(r.data)).catch(e => console.error(e));
  };

  const cargarPendientesJefatura = () => {
    axios.get(`${API}/jefatura/pendientes?email=${usuarioEmail}`)
      .then(r => {
        setPendientesJefatura(r.data);
        // Inicializar estado de correcciones con las horas actuales
        const ini = {};
        r.data.forEach(t => {
          ini[t.id] = {
            K2: t.horas_k2||0, K5: t.horas_k5||0, K6: t.horas_k6||0, K8: t.horas_k8||0,
            K9: t.horas_k9||0, K10: t.horas_k10||0, K11: t.horas_k11||0, K12: t.horas_k12||0, OTROS: t.horas_otros||0
          };
        });
        setCorreccionesJefatura(ini);
      }).catch(e => console.error(e));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (emailInput.trim() !== '') setUsuarioEmail(emailInput.trim().toLowerCase());
  };

  const handleLogout = () => {
    setUsuarioEmail('');
    setEmailInput('');
    setReportes([]);
    setResumenHoras(null);
    setEsJefe(false);
    setTab('CARGA');
  };

  const handleContratosChange = (opts) => {
    const seleccionados = (opts || []).map(o => o.value);
    setContratosElegidos(seleccionados);
    setDetalles(prev => {
      const nuevo = {};
      seleccionados.forEach(k => { nuevo[k] = prev[k] || { tareasElegidas: '', horas: '' }; });
      return nuevo;
    });
  };

  const setTareasContrato = (contrato, opts) => {
    const tareasStr = (opts || []).map(o => o.label).join(',');
    setDetalles(prev => ({ ...prev, [contrato]: { ...prev[contrato], tareasElegidas: tareasStr } }));
  };

  const setHorasContrato = (contrato, valor) => {
    setDetalles(prev => ({ ...prev, [contrato]: { ...prev[contrato], horas: valor } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validaciones antes de enviar
    if (contratosElegidos.length === 0) {
      setMensaje({ tipo: 'error', texto: '✗ Seleccioná al menos un contrato' });
      setTimeout(() => setMensaje(null), 4000);
      return;
    }
    if ((operariosCuil || '').toString().trim() === '') {
      setMensaje({ tipo: 'error', texto: '✗ Seleccioná al menos un operario' });
      setTimeout(() => setMensaje(null), 4000);
      return;
    }

    const totalHoras = Object.values(detalles).reduce((sum, d) => sum + (parseFloat(d.horas) || 0), 0);
    if (totalHoras <= 0) {
      setMensaje({ tipo: 'error', texto: '✗ No podés guardar una tarea con 0 horas' });
      setTimeout(() => setMensaje(null), 4000);
      return;
    }

    for (const k of contratosElegidos) {
      const det = detalles[k] || {};
      if (!(det.tareasElegidas || '').toString().trim()) {
        setMensaje({ tipo: 'error', texto: `✗ Completá las tareas para el contrato ${k}` });
        setTimeout(() => setMensaje(null), 4000);
        return;
      }
      if (!((parseFloat(det.horas) || 0) > 0)) {
        setMensaje({ tipo: 'error', texto: `✗ Ingresá horas mayores a 0 para el contrato ${k}` });
        setTimeout(() => setMensaje(null), 4000);
        return;
      }
    }

    setGuardando(true);
    try {
      const contratosData = {};
      contratosElegidos.forEach(k => {
        contratosData[k] = { tareas: detalles[k]?.tareasElegidas || '', horas: detalles[k]?.horas || 0 };
      });

      const r = await axios.post(`${API}/guardar-tarea`, {
        email: usuarioEmail, dia, provincia, moviles, operarios_cuil: operariosCuil,
        contrato: contratosElegidos.join(','), contratos_data: contratosData
      });

      if (r.data.alerta) {
        setMensaje({ tipo: 'warning', texto: `⚠️ ${r.data.mensaje}` });
      } else {
        setMensaje({ tipo: 'ok', texto: '✓ Tarea guardada correctamente' });
      }
      
      setDia(new Date().toISOString().split('T')[0]);
      setProvincia(''); setMoviles(''); setOperariosCuil('');
      setContratosElegidos([]); setDetalles({});
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: '✗ Error al guardar: ' + (err.response?.data?.error || err.message) });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensaje(null), 5000);
    }
  };

  const handleValidarTarea = async (tareaId, accion) => {
    try {
      const payload = { email: usuarioEmail, tarea_id: tareaId, accion };
      if (accion === 'APROBADO') {
        payload.horas_corregidas = correccionesJefatura[tareaId];
      }
      await axios.post(`${API}/jefatura/validar`, payload);
      setMensaje({ tipo: 'ok', texto: `✓ Tarea ${accion.toLowerCase()} con éxito` });
      cargarPendientesJefatura();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: '✗ Error al validar' });
    }
    setTimeout(() => setMensaje(null), 4000);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Seguro que querés eliminar este registro?')) return;
    try {
      await axios.delete(`${API}/eliminar-tarea/${id}?email=${usuarioEmail}`);
      setMensaje({ tipo: 'ok', texto: '✓ Registro eliminado' });
      cargarDatos();
      if (tab === 'HORAS') cargarHoras();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: '✗ ' + (err.response?.data?.error || 'Error al eliminar') });
    }
    setTimeout(() => setMensaje(null), 4000);
  };

  const getTareasOpts = (contratoNombre) => {
    const found = contratosDisponibles.find(c => c.contrato === contratoNombre);
    return found ? found.tareas.map(t => ({ value: t.id, label: t.tarea })) : [];
  };

  const filtradosReportes = reportes.filter(r => {
    if (!r.dia) return false;
    const fechaStr = r.dia.split('T')[0];
    const [y, m, dNum] = fechaStr.split('-');
    const q = parseInt(dNum, 10) <= 15 ? 1 : 2;
    return parseInt(y, 10) === parseInt(anioSeleccionado, 10)
      && parseInt(m, 10) === parseInt(mesSeleccionado, 10)
      && q === parseInt(quincenaSeleccionada, 10);
  });

  // Validaciones derivadas del formulario
  const totalHorasForm = Object.values(detalles).reduce((sum, d) => sum + (parseFloat(d.horas) || 0), 0);
  const formValido = contratosElegidos.length > 0 && (operariosCuil || '').toString().trim() !== '' && totalHorasForm > 0 && contratosElegidos.every(k => {
    const det = detalles[k] || {};
    return (det.tareasElegidas || '').toString().trim() !== '' && (parseFloat(det.horas) || 0) > 0;
  });

  if (!usuarioEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 50%, #111827 100%)'}}>
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10" style={{backgroundColor: '#eeb537', filter: 'blur(60px)'}}></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10" style={{backgroundColor: '#eeb537', filter: 'blur(60px)'}}></div>
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10 border border-slate-100">
          <div className="flex justify-center mb-6">
            <img src="/sertec-logotipo.png" alt="SER&TEC" className="h-16 w-16 rounded-full shadow-lg" style={{boxShadow: '0 0 20px rgba(238, 181, 55, 0.3)'}} />
          </div>
          <h1 className="text-center text-3xl font-black" style={{color: '#111827'}}>SER&TEC</h1>
          <h2 className="text-center text-lg font-semibold text-slate-600 mt-1">Sistema de Tareas</h2>
          <p className="text-slate-500 text-sm text-center mt-4 mb-6">Ingresá tu correo electrónico para continuar.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email" required placeholder="Ej: tu-email@gmail.com"
              value={emailInput} onChange={e => setEmailInput(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:outline-none transition bg-slate-50"
              style={{focusColor: '#eeb537', focusRingColor: '#eeb537'}}
            />
            <button type="submit" className="w-full text-white font-bold py-3 rounded-lg transition hover:shadow-lg transform hover:scale-105" style={{background: 'linear-gradient(135deg, #eeb537 0%, #d4a035 100%)', boxShadow: '0 4px 15px rgba(238, 181, 55, 0.3)'}}>
              Entrar al Sistema →
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-6">© 2026 SER&TEC • Todos los derechos reservados</p>
        </div>
      </div>
    );
  }

  const BadgeEstado = ({ estado, grupo }) => {
    if (!estado || estado === 'NO APLICA') return null;
    let colors = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (estado === 'APROBADO') colors = 'bg-green-100 text-green-800 border-green-200';
    if (estado === 'RECHAZADO') colors = 'bg-red-100 text-red-800 border-red-200';
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors} whitespace-nowrap`}>
        G{grupo}: {estado}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <nav className="shadow-lg sticky top-0 z-40" style={{background: 'linear-gradient(to right, #111827, #1f2937)', borderBottomWidth: '4px', borderBottomColor: '#eeb537'}}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src="/sertec-logotipo.png" alt="SER&TEC" className="h-14 w-14 rounded-full shadow-md" style={{boxShadow: '0 0 15px rgba(238, 181, 55, 0.2)'}} />
              <div className="absolute inset-0 rounded-full" style={{background: 'radial-gradient(circle, rgba(238, 181, 55, 0.1) 0%, transparent 70%)'}}></div>
            </div>
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">SER&TEC</h1>
              <p className="text-yellow-300 text-xs font-semibold mt-0.5">Sistema de Tareas {usuarioEmail && `• ${usuarioEmail}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 justify-between w-full sm:w-auto">
            {esJefe && (
              <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-200 bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/50 px-4 py-2 rounded-full shadow-sm" style={{textShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>
                👤 JEFE G{grupoJefe}
              </span>
            )}
            <button onClick={handleLogout} className="rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-5 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-500/25 hover:border-amber-400 transform hover:scale-105">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="bg-white border-b-2 sticky top-16 z-30 shadow-sm" style={{borderBottomColor: '#eeb537'}}>
        <div className="hidden sm:flex max-w-6xl mx-auto px-4 gap-1 overflow-x-auto">
          <button
            onClick={() => setTab('CARGA')}
            className={`py-4 px-6 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${tab === 'CARGA' ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            style={{borderBottomColor: tab === 'CARGA' ? '#eeb537' : 'transparent', backgroundColor: tab === 'CARGA' ? '#f5f3ff' : 'transparent', color: tab === 'CARGA' ? '#eeb537' : undefined}}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6 0h-6m0 0H6" />
            </svg>
            Carga de Tareas
          </button>
          <button
            onClick={() => setTab('HORAS')}
            className={`py-4 px-6 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${tab === 'HORAS' ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            style={{borderBottomColor: tab === 'HORAS' ? '#eeb537' : 'transparent', backgroundColor: tab === 'HORAS' ? '#f5f3ff' : 'transparent', color: tab === 'HORAS' ? '#eeb537' : undefined}}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Mis Horas
          </button>
          {esJefe && (
            <button
              onClick={() => setTab('JEFATURA')}
              className={`py-4 px-6 text-sm font-bold border-b-4 transition-all whitespace-nowrap flex items-center gap-2 ${tab === 'JEFATURA' ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              style={{borderBottomColor: tab === 'JEFATURA' ? '#eeb537' : 'transparent', backgroundColor: tab === 'JEFATURA' ? '#f5f3ff' : 'transparent', color: tab === 'JEFATURA' ? '#eeb537' : undefined}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Validación
              {pendientesJefatura.length > 0 && <span className="text-white text-xs font-black px-2 py-0.5 rounded-full ml-1" style={{backgroundColor: '#eeb537'}}>{pendientesJefatura.length}</span>}
            </button>
          )}
        </div>
        <div className="sm:hidden max-w-6xl mx-auto px-4 py-3">
          <label htmlFor="mobile-tab" className="sr-only">Seleccionar sección</label>
          <select
            id="mobile-tab"
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-700 bg-white font-semibold focus:ring-2 focus:ring-yellow-400 outline-none"
          >
            <option value="CARGA">📝 Carga de Tareas</option>
            <option value="HORAS">📅 Mis Horas por Quincena</option>
            {esJefe && <option value="JEFATURA">✓ Validación Jefatura</option>}
          </select>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8 min-h-screen">
        {mensaje && (
          <div className={`rounded-2xl px-5 py-4 text-sm font-bold shadow-lg transition-all transform animate-pulse ${
            mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-300' : 
            mensaje.tipo === 'warning' ? 'bg-amber-100 text-amber-900 border-2 border-amber-400' :
            'bg-red-50 text-red-800 border-2 border-red-300'
          }`}>
            {mensaje.tipo === 'ok' ? '✅' : mensaje.tipo === 'warning' ? '⚠️' : '❌'} {mensaje.texto}
          </div>
        )}

        {/* ===================== TAB: CARGA ===================== */}
        {tab === 'CARGA' && (
          <>
            <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
              <div className="px-6 py-5" style={{background: 'linear-gradient(135deg, #eeb537 0%, #d4a035 100%)', borderBottomWidth: '0px'}}>
                <h2 className="text-white font-black text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.3A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                  </svg>
                  Nueva Tarea
                </h2>
                <p className="text-yellow-50 text-xs mt-1 font-semibold">Completa los datos del día y guarda</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha *</label>
                    <input
                      type="date" required value={dia} onChange={e => setDia(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Provincia</label>
                    <select
                      value={provincia} onChange={e => setProvincia(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
                    >
                      <option value="">— Seleccionar —</option>
                      {catalogos.provincias?.map(p => (<option key={p.id} value={p.id}>{p.provincia}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehículos</label>
                    <Select
                      isMulti placeholder="Buscar vehículos..." classNamePrefix="react-select"
                      options={catalogos.vehiculos?.map(v => ({ value: v.id, label: v.patente })) || []}
                      onChange={opts => setMoviles((opts || []).map(o => o.value).join(','))}
                      noOptionsMessage={() => 'Sin resultados'}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Operarios</label>
                    <Select
                      isMulti placeholder="Buscar operarios..." classNamePrefix="react-select"
                      options={catalogos.operarios?.map(o => ({ value: o.cuil, label: o.apellido_nombre })) || []}
                      onChange={opts => setOperariosCuil((opts || []).map(o => o.value).join(','))}
                      noOptionsMessage={() => 'Sin resultados'}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contratos *</label>
                  {contratosDisponibles.length === 0 ? (
                    <p className="text-sm text-slate-400">Cargando contratos...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {contratosDisponibles.map(c => {
                        const activo = contratosElegidos.includes(c.contrato);
                        return (
                          <button
                            key={c.contrato} type="button"
                            onClick={() => {
                              const nuevos = activo ? contratosElegidos.filter(k => k !== c.contrato) : [...contratosElegidos, c.contrato];
                              handleContratosChange(nuevos.map(k => ({ value: k })));
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                              activo ? 'bg-blue-700 border-blue-700 text-white shadow-md scale-105' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
                            }`}
                          >
                            {c.contrato}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {contratosElegidos.length > 0 && (
                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Detalle por contrato</p>
                    <div className="space-y-4">
                      {contratosElegidos.map(k => (
                        <div key={k} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <span className="text-white text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block" style={{backgroundColor: '#7c8082'}}>{k}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-500">Tareas</label>
                              <Select
                                isMulti placeholder={`Tareas de ${k}...`} classNamePrefix="react-select"
                                options={getTareasOpts(k)}
                                onChange={opts => setTareasContrato(k, opts)}
                                noOptionsMessage={() => 'Sin tareas disponibles'}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-slate-500">Horas</label>
                              <input
                                type="number" min="0" step="0.5" placeholder="0"
                                value={detalles[k]?.horas || ''}
                                onChange={e => setHorasContrato(k, e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const horasEnForm = Object.values(detalles).reduce((sum, d) => sum + (parseFloat(d.horas) || 0), 0);
                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
                      {horasEnForm > 11 ? (
                        <div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-lg text-xs font-semibold border border-amber-200 flex-1 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Estás sumando {horasEnForm}hs. Recuerda que no deberías cargar más de 11hs diarias sin un motivo justificado.
                        </div>
                      ) : <div className="flex-1"></div>}
                      
                      <button type="submit" disabled={!formValido || guardando} className="disabled:opacity-60 text-white font-semibold px-8 py-2.5 rounded-lg text-sm transition-colors flex-shrink-0 w-full sm:w-auto hover:shadow-lg" style={{backgroundColor: '#eeb537'}}>
                        {guardando ? 'Guardando...' : 'Guardar Tarea'}
                      </button>
                    </div>
                  );
                })()}
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-700">Tus Registros de Tareas</h2>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide px-2">Filtro:</span>
                  <select
                    value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white"
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  <select
                    value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('es', { month: 'short' }).toUpperCase()}</option>
                    ))}
                  </select>
                  <select
                    value={quincenaSeleccionada} onChange={(e) => setQuincenaSeleccionada(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 bg-white"
                  >
                    <option value="1">1ra Quinc.</option>
                    <option value="2">2da Quinc.</option>
                  </select>
                </div>
              </div>
              <div className="sm:hidden space-y-4 p-4">
                {filtradosReportes.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                    No hay registros para este período
                  </div>
                ) : filtradosReportes.map((r, i) => {
                  const totalHs = Number(r.horas_k2||0) + Number(r.horas_k5||0) + Number(r.horas_k6||0) +
                                  Number(r.horas_k8||0) + Number(r.horas_k9||0) + Number(r.horas_k10||0) +
                                  Number(r.horas_k11||0) + Number(r.horas_k12||0) + Number(r.horas_otros||0);
                  const bloqueado = r.estado_g1 === 'APROBADO' || r.estado_g2 === 'APROBADO' || r.estado_g3 === 'APROBADO';
                  return (
                    <article key={i} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Fecha</p>
                          <p className="text-sm font-semibold text-slate-800">{formatFecha(r.dia)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Horas</p>
                          <p className="text-sm font-semibold" style={{color: '#eeb537'}}>{totalHs}h</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Contratos</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.contrato ? r.contrato.split(',').map((c, j) => (
                              <span key={j} className="px-2 py-0.5 rounded text-[10px] text-white" style={{backgroundColor: '#7c8082'}}>{c.trim()}</span>
                            )) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Estados</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <BadgeEstado estado={r.estado_g1} grupo={1} />
                            <BadgeEstado estado={r.estado_g2} grupo={2} />
                            <BadgeEstado estado={r.estado_g3} grupo={3} />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Operarios</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.operarios_nombres ? r.operarios_nombres.split(',').map((op, j) => (
                              <span key={j} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">{op.trim()}</span>
                            )) : <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTareaDetalle(r)}
                          className="flex-1 text-white text-sm font-semibold px-4 py-2 rounded-lg transition hover:shadow-md"
                          style={{backgroundColor: '#7c8082'}}
                        >
                          Ver detalle
                        </button>
                        {!bloqueado && (
                          <button
                            type="button"
                            onClick={() => handleEliminar(r.id)}
                            className="flex-1 bg-red-100 text-red-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-200 transition"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden sm:overflow-x-auto sm:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contratos</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Hs</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estados Validación</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Operarios</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtradosReportes.length === 0 ? (
                      <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-400">No hay registros para este período</td></tr>
                    ) : filtradosReportes.map((r, i) => {
                      const totalHs = Number(r.horas_k2||0) + Number(r.horas_k5||0) + Number(r.horas_k6||0) +
                                      Number(r.horas_k8||0) + Number(r.horas_k9||0) + Number(r.horas_k10||0) +
                                      Number(r.horas_k11||0) + Number(r.horas_k12||0) + Number(r.horas_otros||0);
                      const bloqueado = r.estado_g1 === 'APROBADO' || r.estado_g2 === 'APROBADO' || r.estado_g3 === 'APROBADO';
                      return (
                        <tr key={i} className="transition-colors" style={{backgroundColor: i % 2 === 0 ? '#f9f7f2' : 'white'}}>
                          <td className="px-5 py-3 text-slate-700 font-medium whitespace-nowrap">{formatFecha(r.dia)}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {r.contrato ? r.contrato.split(',').map((c, j) => (<span key={j} className="font-semibold px-2 py-0.5 rounded text-xs text-white" style={{backgroundColor: '#7c8082'}}>{c.trim()}</span>)) : <span className="text-slate-400">—</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => setTareaDetalle(r)}
                              className="flex items-center gap-1 text-slate-700 transition-colors group"
                              style={{color: '#7c8082'}}
                              title="Ver detalle"
                            >
                              <span className="font-bold">{totalHs}h</span>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              <BadgeEstado estado={r.estado_g1} grupo={1} />
                              <BadgeEstado estado={r.estado_g2} grupo={2} />
                              <BadgeEstado estado={r.estado_g3} grupo={3} />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {r.operarios_nombres ? r.operarios_nombres.split(',').map((op, j) => (<span key={j} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{op.trim()}</span>)) : <span className="text-slate-400">—</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {!bloqueado && (
                              <button onClick={() => handleEliminar(r.id)} className="text-red-500 hover:text-red-700 transition p-1" title="Eliminar">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===================== MODAL DE DETALLE ===================== */}
        {tareaDetalle && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setTareaDetalle(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-700">Detalle del Registro</h3>
                <button onClick={() => setTareaDetalle(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 mb-1">FECHA</span>
                    <span className="font-medium text-slate-800">{formatFecha(tareaDetalle.dia)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 mb-1">TOTAL HORAS</span>
                    <span className="font-bold" style={{color: '#eeb537'}}>
                      {Number(tareaDetalle.horas_k2||0)+Number(tareaDetalle.horas_k5||0)+Number(tareaDetalle.horas_k6||0)+
                       Number(tareaDetalle.horas_k8||0)+Number(tareaDetalle.horas_k9||0)+Number(tareaDetalle.horas_k10||0)+
                       Number(tareaDetalle.horas_k11||0)+Number(tareaDetalle.horas_k12||0)+Number(tareaDetalle.horas_otros||0)}h
                    </span>
                  </div>
                </div>
                
                <div className="border-t border-slate-100 pt-4">
                  <span className="block text-xs font-semibold text-slate-500 mb-3">DESGLOSE POR CONTRATO</span>
                  <div className="space-y-2">
                    {['k2','k5','k6','k8','k9','k10','k11','k12','otros'].map(k => {
                      const horas = Number(tareaDetalle[`horas_${k}`]||0);
                      if (horas === 0) return null;
                      return (
                        <div key={k} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                          <span className="text-xs font-bold text-slate-600 uppercase">{k}</span>
                          <span className="text-sm font-semibold text-slate-800">{horas}h</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <span className="block text-xs font-semibold text-slate-500 mb-2">OPERARIOS INVOLUCRADOS</span>
                  <div className="flex flex-wrap gap-1">
                    {tareaDetalle.operarios_nombres ? tareaDetalle.operarios_nombres.split(',').map((op, j) => (
                      <span key={j} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] uppercase font-bold">{op.trim()}</span>
                    )) : <span className="text-sm text-slate-500">Ninguno</span>}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={() => setTareaDetalle(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: HORAS ===================== */}
        {tab === 'HORAS' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Filtrar por Quincena</h2>
              <div className="flex gap-4 items-end">
                <div className="flex flex-col gap-1 w-32">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Año</label>
                  <select
                    value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mes</label>
                  <select
                    value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-48">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quincena</label>
                  <select
                    value={quincenaSeleccionada} onChange={(e) => setQuincenaSeleccionada(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
                  >
                    <option value="1">1ra (Del 1 al 15)</option>
                    <option value="2">2da (Del 16 a fin de mes)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h3 className="font-semibold text-slate-700">Calendario de Horas - Quincena {quincenaSeleccionada === 1 ? '1ª (1-15)' : '2ª (16-fin)'} {mesSeleccionado}/{anioSeleccionado}</h3>
              </div>
              <div className="p-6 space-y-6">
                {(() => {
                  const y = parseInt(anioSeleccionado, 10);
                  const m = parseInt(mesSeleccionado, 10);
                  const q = parseInt(quincenaSeleccionada, 10);
                  
                  const diasEnMes = new Date(y, m, 0).getDate();
                  const inicio = q === 1 ? 1 : 16;
                  const fin = q === 1 ? 15 : diasEnMes;
                  
                  const diasConHoras = {};
                  reportes.forEach(r => {
                    if (r.dia) {
                      const fechaStr = r.dia.split('T')[0];
                      const [ry, rm, rd] = fechaStr.split('-');
                      if (parseInt(ry) === y && parseInt(rm) === m) {
                        const totalHs = Number(r.horas_k2||0) + Number(r.horas_k5||0) + Number(r.horas_k6||0) +
                                        Number(r.horas_k8||0) + Number(r.horas_k9||0) + Number(r.horas_k10||0) +
                                        Number(r.horas_k11||0) + Number(r.horas_k12||0) + Number(r.horas_otros||0);
                        if (totalHs > 0) {
                          diasConHoras[`${y}-${String(m).padStart(2, '0')}-${String(rd).padStart(2, '0')}`] = totalHs;
                        }
                      }
                    }
                  });
                  
                  const diasDelMes = [];
                  for (let d = inicio; d <= fin; d++) {
                    const fechaObj = new Date(y, m - 1, d);
                    const diaSemana = fechaObj.getDay();
                    const fechaStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const tieneHoras = diasConHoras[fechaStr] || 0;
                    const esFeriado = feriadosQ[fechaStr] || false;
                    const esDomingoOFeriado = diaSemana === 0 || esFeriado;
                    
                    diasDelMes.push({
                      dia: d,
                      fechaStr,
                      diaSemana,
                      tieneHoras,
                      esFeriado,
                      esDomingoOFeriado,
                      fechaObj
                    });
                  }
                  
                  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-7 gap-2 text-center">
                        {diasSemana.map(ds => (
                          <div key={ds} className="text-xs font-bold text-slate-500 py-2">{ds}</div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 gap-2">
                        {diasDelMes.map(d => {
                          let bgColor = 'bg-white border-slate-200';
                          let textColor = 'text-slate-700';
                          let horasColor = 'text-blue-700';
                          
                          if (d.esFeriado) {
                            bgColor = 'bg-purple-50 border-purple-300';
                            textColor = 'text-purple-700';
                          } else if (d.tieneHoras > 0) {
                            bgColor = 'bg-green-50 border-green-300';
                            textColor = 'text-green-700';
                            horasColor = 'text-green-600';
                          } else if (d.esDomingoOFeriado) {
                            bgColor = 'bg-slate-50 border-slate-200';
                            textColor = 'text-slate-500';
                          }
                          
                          return (
                            <button
                              key={d.dia}
                              onClick={() => {
                                setFeriadosQ(prev => ({
                                  ...prev,
                                  [d.fechaStr]: !prev[d.fechaStr]
                                }));
                              }}
                              title={`${d.tieneHoras > 0 ? d.tieneHoras + ' hs cargadas' : 'Click para marcar como feriado'}`}
                              className={`border-2 rounded-lg p-3 flex flex-col items-center justify-center text-sm font-semibold transition ${bgColor} ${textColor} hover:shadow-md`}
                            >
                              <span className="text-lg">{d.dia}</span>
                              {d.tieneHoras > 0 && <span className={`text-[10px] font-bold ${horasColor}`}>{d.tieneHoras}h</span>}
                              {d.esFeriado && <span className="text-[10px] font-bold">FERIADO</span>}
                            </button>
                          );
                        })}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {resumenHoras ? Object.entries(resumenHoras).map(([contrato, horas]) => {
                            if (horas === null) return null;
                            return (
                              <div key={contrato} className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50">
                                <span className="text-xs font-bold text-slate-500 mb-1">{contrato}</span>
                                <span className="text-2xl font-black text-blue-700">{horas}</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Horas</span>
                              </div>
                            );
                          }) : <p className="text-center text-slate-400 col-span-4">Cargando horas...</p>}
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                        <p><span className="inline-block w-4 h-4 bg-green-50 border-2 border-green-300 rounded mr-2"></span>Días con horas cargadas</p>
                        <p><span className="inline-block w-4 h-4 bg-purple-50 border-2 border-purple-300 rounded mr-2"></span>Feriados (click para marcar/desmarcar)</p>
                        <p><span className="inline-block w-4 h-4 bg-slate-50 border-2 border-slate-200 rounded mr-2"></span>Domingos (no laboral)</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: JEFATURA ===================== */}
        {tab === 'JEFATURA' && esJefe && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-white font-semibold text-base">Panel de Validación</h2>
                <p className="text-amber-100 text-xs mt-0.5">Revisá y aprobá las horas de tu grupo (G{grupoJefe})</p>
              </div>
              <span className="bg-white text-amber-700 font-bold px-3 py-1 rounded-full text-xs shadow-sm">
                {pendientesJefatura.length} PENDIENTES
              </span>
            </div>
            
            <div className="sm:hidden space-y-4 p-4">
              {pendientesJefatura.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-700">
                  ¡Estás al día! No hay tareas pendientes de validación.
                </div>
              ) : pendientesJefatura.map((r) => {
                const actualizarHoras = (contrato, val) => {
                  setCorreccionesJefatura(prev => ({
                    ...prev, [r.id]: { ...prev[r.id], [contrato]: val }
                  }));
                };

                const renderInputHora = (contratoKey) => {
                  const val = correccionesJefatura[r.id]?.[contratoKey] ?? 0;
                  if (val === 0 && r[`horas_${contratoKey.toLowerCase()}`] === 0) return null;
                  return (
                    <div key={contratoKey} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-14">{contratoKey}:</span>
                      <input
                        type="number" min="0" step="0.5"
                        className="w-20 px-2 py-1 text-xs border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                        value={val}
                        onChange={(e) => actualizarHoras(contratoKey, e.target.value)}
                      />
                      <span className="text-[10px] text-slate-400">hs</span>
                    </div>
                  );
                };

                let contratosAMostrar = [];
                if (grupoJefe === 1) contratosAMostrar = ['K2','K6','K12'];
                if (grupoJefe === 2) contratosAMostrar = ['K5','K8','K11'];
                if (grupoJefe === 3) contratosAMostrar = ['K9','K10','OTROS'];

                return (
                  <article key={r.id} className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Fecha</p>
                        <p className="text-sm font-semibold text-slate-800">{formatFecha(r.dia)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Operario</p>
                        <p className="text-sm font-semibold text-blue-700">{r.operario_email}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Contrato</p>
                      <p className="mt-1 font-semibold text-slate-700">{r.contrato}</p>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {contratosAMostrar.map(c => renderInputHora(c))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => handleValidarTarea(r.id, 'APROBADO')} className="flex-1 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white px-4 py-2 rounded text-sm font-bold transition">
                        ✓ APROBAR
                      </button>
                      <button onClick={() => handleValidarTarea(r.id, 'RECHAZADO')} className="flex-1 bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-4 py-2 rounded text-sm font-bold transition">
                        ✗ RECHAZAR
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden sm:overflow-x-auto sm:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cargado Por</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contratos</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Horas (Tu Grupo)</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendientesJefatura.length === 0 ? (
                    <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500 font-medium">¡Estás al día! No hay tareas pendientes de validación.</td></tr>
                  ) : pendientesJefatura.map((r) => {
                    const actualizarHoras = (contrato, val) => {
                      setCorreccionesJefatura(prev => ({
                        ...prev, [r.id]: { ...prev[r.id], [contrato]: val }
                      }));
                    };

                    const renderInputHora = (contratoKey) => {
                      const val = correccionesJefatura[r.id]?.[contratoKey] ?? 0;
                      if (val === 0 && r[`horas_${contratoKey.toLowerCase()}`] === 0) return null; // No cargó horas de esto
                      return (
                        <div key={contratoKey} className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500 w-12">{contratoKey}:</span>
                          <input 
                            type="number" min="0" step="0.5" 
                            className="w-16 px-2 py-1 text-xs border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                            value={val}
                            onChange={(e) => actualizarHoras(contratoKey, e.target.value)}
                          />
                          <span className="text-[10px] text-slate-400">hs</span>
                        </div>
                      );
                    };

                    let contratosAMostrar = [];
                    if (grupoJefe === 1) contratosAMostrar = ['K2','K6','K12'];
                    if (grupoJefe === 2) contratosAMostrar = ['K5','K8','K11'];
                    if (grupoJefe === 3) contratosAMostrar = ['K9','K10','OTROS'];

                    return (
                      <tr key={r.id}>
                        <td className="px-5 py-4 text-slate-700 font-medium whitespace-nowrap">{formatFecha(r.dia)}</td>
                        <td className="px-5 py-4 text-slate-600">{r.operario_email}</td>
                        <td className="px-5 py-4 font-bold text-blue-700">{r.contrato}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            {contratosAMostrar.map(c => renderInputHora(c))}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => handleValidarTarea(r.id, 'APROBADO')} className="bg-green-100 text-green-700 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition">
                              ✓ APROBAR
                            </button>
                            <button onClick={() => handleValidarTarea(r.id, 'RECHAZADO')} className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition">
                              ✗ RECHAZAR
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;