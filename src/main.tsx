import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import { StartupError } from './ui/app/StartupError';
import './ui/styles/global.css';

// Composition root: the only module allowed to wire every layer together.
async function bootstrap(rootElement: HTMLElement): Promise<void> {
  const root = createRoot(rootElement);
  try {
    // Loaded lazily so the mock layer ships as its own chunk.
    const { startMocking } = await import('./mocks/browser');
    await startMocking();
  } catch (error) {
    console.error('Failed to start the mock backend', error);
    root.render(<StartupError message="the mock backend is unavailable." />);
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element in index.html');
}
void bootstrap(rootElement);
