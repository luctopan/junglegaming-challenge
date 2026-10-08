import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from './api/ApiProvider';
import { apiTimeoutMs } from './api/client';
import { createApi } from './api/createApi';
import { isTestMode } from './platform/testMode';
import { App } from './ui/app/App';
import { StartupError } from './ui/app/StartupError';
import '@fontsource-variable/archivo/wght.css';
import './ui/styles/global.css';

// Composition root: the only module allowed to wire every layer together.
async function bootstrap(rootElement: HTMLElement): Promise<void> {
  const { search } = window.location;
  const testMode = isTestMode(search);
  if (testMode) {
    // Loaded on demand: the hook pulls in the game runtime, which the menu does not need.
    const { installTestHook } = await import('./game/runtime/testHook');
    installTestHook(window, search);
  }
  const root = createRoot(rootElement);
  try {
    // Loaded lazily so the mock layer ships as its own chunk.
    const { startMocking } = await import('./mocks/browser');
    await startMocking(search);
  } catch (error) {
    console.error('Failed to start the mock backend', error);
    root.render(<StartupError message="the mock backend is unavailable." />);
    return;
  }
  const api = createApi(apiTimeoutMs(search, testMode, import.meta.env.VITE_API_TIMEOUT_MS));
  // Matches left unconfirmed by an earlier visit are sent again on start and
  // whenever the browser comes back online.
  void api.submissions.flush();
  window.addEventListener('online', () => {
    void api.submissions.flush();
  });
  root.render(
    <StrictMode>
      <ApiProvider api={api}>
        <App />
      </ApiProvider>
    </StrictMode>,
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element in index.html');
}
void bootstrap(rootElement);
