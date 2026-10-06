import React from 'react';
import ReactDOM from 'react-dom/client';
import posthog from 'posthog-js';
import App from './App';

posthog.init(process.env.REACT_APP_POSTHOG_KEY, {
  api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

