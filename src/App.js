import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';

function App() {
  const [reportes, setReportes] = useState([]);
  const [catalogos, setCatalogos] = useState({ provincias: [], vehiculos: [], operarios: [] });
  const [formData, setFormData] = useState({ dia: '', contrato: '', provincia: '', moviles: '', operarios_cuil: '', horas_k2: 0 });

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = () => {
    axios.get('http://localhost:3001/reporte-completo').then(res => setReportes(res.data));
    axios.get('http://localhost:3001/catalogos').then(res => setCatalogos(res.data));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:3001/guardar-tarea', formData);
    alert("Guardado");
    cargarDatos();
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Sistema de Tareas</h1>
      <form onSubmit={handleSubmit} style={{ padding: '20px', border: '1px solid #ccc' }}>
        <input type="date" onChange={e => setFormData({...formData, dia: e.target.value})} required />
        <select onChange={e => setFormData({...formData, provincia: e.target.value})}>
          <option>Provincia</option>
          {catalogos.provincias.map(p => <option key={p.id} value={p.id}>{p.provincia}</option>)}
        </select>
        <select onChange={e => setFormData({...formData, moviles: e.target.value})}>
          <option>Vehículo</option>
          {catalogos.vehiculos.map(v => <option key={v.id} value={v.id}>{v.patente}</option>)}
        </select>
        <Select
          isMulti
          options={catalogos.operarios.map(o => ({ value: o.cuil, label: o.apellido_nombre }))}
          onChange={opt => setFormData({...formData, operarios_cuil: opt.map(o => o.value).join(',')})}
        />
        <input type="number" placeholder="Horas" onChange={e => setFormData({...formData, horas_k2: e.target.value})} />
        <button type="submit">Guardar</button>
      </form>
      <table border="1" style={{ width: '100%', marginTop: '20px' }}>
        <thead><tr><th>Fecha</th><th>Contrato</th><th>Operarios</th></tr></thead>
        <tbody>
          {reportes.map((r, i) => <tr key={i}><td>{r.dia}</td><td>{r.contrato}</td><td>{r.operarios_nombres}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default App;