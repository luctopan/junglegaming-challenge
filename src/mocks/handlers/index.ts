import { browserStorage } from '../../platform/storage';
import { createMockDb } from '../db';
import { ScenarioState } from '../scenario';
import { healthHandlers } from './health';
import { recordHandlers } from './records';

const sessionStore = () => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
};

/** Every mock handler; `search` is the page URL's query (`?scenario=`, `?seed=`). */
export function createHandlers(search: string) {
  const db = createMockDb(browserStorage);
  const scenario = new ScenarioState(search, sessionStore);
  return [...healthHandlers, ...recordHandlers({ db, scenario, now: () => new Date() })];
}
