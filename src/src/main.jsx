// src/main.jsx (ou index.js)
import React from 'react';
import ReactDOM from 'react-dom/client';
import RessonaApp from './RessonaApp.jsx';
import './index.css'; // Importa o CSS de entrada do Tailwind

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RessonaApp />
  </React.StrictMode>,
);
