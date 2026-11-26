import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import './estilo/estilo.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { PrototipoCalendario } from './prototipo-calendario/PrototipoCalendario';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    {/* PROTÓTIPO (ticket 50): o Calendário abre fora do roteador, sem login nem backend. */}
    {location.pathname.startsWith('/prototipo/calendario') ? <PrototipoCalendario /> : <App />}
  </StrictMode>,
);
