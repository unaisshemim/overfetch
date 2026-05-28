import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/styles/globals.css';
import DashboardApp from './App';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>,
  );
}
