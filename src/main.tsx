import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

// Al tocar una notificación con la app abierta, ir a la pantalla que corresponde
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'open' && typeof e.data.url === 'string') window.location.href = e.data.url;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
