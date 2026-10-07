import { http, HttpResponse } from 'msw';

/** Liveness probe used by the smoke test to prove requests are intercepted. */
export const healthHandlers = [http.get('/api/health', () => HttpResponse.json({ status: 'ok' }))];
