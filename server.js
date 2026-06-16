const express = require('express');
const path = require('path');
const app = express();

// Servir archivos estáticos de la carpeta build
app.use(express.static(path.join(__dirname, 'build')));

// Para todas las rutas no encontradas, servir index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PWA server corriendo en http://0.0.0.0:${PORT}`);
  console.log(`Accede desde tu celular: http://192.168.1.81:${PORT}`);
});
