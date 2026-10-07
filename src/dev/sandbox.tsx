import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sandbox } from './SandboxApp';

// Entry of the dev-server-only sandbox.html (see SandboxApp.tsx).
const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Missing #root element in sandbox.html');
createRoot(rootElement).render(
  <StrictMode>
    <Sandbox />
  </StrictMode>,
);
