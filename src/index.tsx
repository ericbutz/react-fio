/**
 * Template that uses the material-ui react component library and emotion styles
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './style/main.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

