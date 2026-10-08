import { delay, http, HttpResponse } from 'msw';
import type { MatchRecord } from '../../api/contracts';
import { configKeyOf, PAGE_SIZE, parseConfigKey } from '../../api/contracts';
import { parseMatchSubmission } from '../../api/matchSubmission';
import type { MockStatus } from '../../api/scenarios';
import { isScenarioName } from '../../api/scenarios';
import type { MockDb } from '../db';
import { BULK_RECORDS, FIXTURE_RECORDS } from '../fixtures';
import { historyOf, paginate, rankedConfigsOf, rankingOf } from '../ranking';
import type { Endpoint, RequestPlan, ScenarioState } from '../scenario';

const MAX_PAGE_SIZE = 50;

interface Backend {
  readonly db: MockDb;
  readonly scenario: ScenarioState;
  /** Clock of `recordedAt` (the only non-fixed date of the mock). */
  readonly now: () => Date;
}

const positiveInt = (raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, max) : fallback;
};

/** Applies a plan's latency and failure; null means "go on and answer". */
async function applyPlan(plan: RequestPlan): Promise<Response | null> {
  await delay(plan.latencyMs);
  if (plan.failure === 'network') return HttpResponse.error();
  if (plan.failure !== null) {
    return HttpResponse.json({ error: 'Scenario failure' }, { status: plan.failure.status });
  }
  return null;
}

/**
 * The ranking/history API (docs/PLAN.md §3.1) over the persisted mock db,
 * shaped by the active network scenario. `/api/__mock/*` (dev panel) is never
 * affected by scenarios.
 */
export function recordHandlers({ db, scenario, now }: Backend) {
  const allRecords = (): readonly MatchRecord[] => {
    const own = db.records();
    switch (scenario.dataset()) {
      case 'empty':
        return own;
      case 'bulk':
        return [...FIXTURE_RECORDS, ...BULK_RECORDS, ...own];
      case 'fixtures':
        return [...FIXTURE_RECORDS, ...own];
    }
  };

  const read = async (endpoint: Endpoint, answer: () => Response): Promise<Response> =>
    (await applyPlan(scenario.plan(endpoint))) ?? answer();

  const status = (): MockStatus => ({
    scenario: scenario.scenario,
    recovered: scenario.recovered,
    records: db.records().length,
  });

  return [
    http.get('/api/ranking/configs', () =>
      read('configs', () => HttpResponse.json(rankedConfigsOf(allRecords()))),
    ),

    http.get('/api/ranking', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const configKey = params.get('configKey') ?? '';
      const config = parseConfigKey(configKey);
      if (config === null) {
        return HttpResponse.json({ error: 'Invalid configKey' }, { status: 400 });
      }
      const page = positiveInt(params.get('page'), 1);
      const pageSize = positiveInt(params.get('pageSize'), PAGE_SIZE, MAX_PAGE_SIZE);
      return read('ranking', () => {
        // The revision is read with the data it describes.
        const revision = db.revision();
        const ranking = rankingOf(allRecords(), configKeyOf(config));
        return HttpResponse.json(paginate(ranking, page, pageSize, revision));
      });
    }),

    http.get('/api/players/:playerId/matches', ({ request, params }) => {
      const search = new URL(request.url).searchParams;
      const playerId = String(params.playerId);
      const page = positiveInt(search.get('page'), 1);
      const pageSize = positiveInt(search.get('pageSize'), PAGE_SIZE, MAX_PAGE_SIZE);
      return read('history', () => {
        const revision = db.revision();
        return HttpResponse.json(
          paginate(historyOf(allRecords(), playerId), page, pageSize, revision),
        );
      });
    }),

    http.put('/api/matches/:matchId', async ({ request, params }) => {
      const matchId = String(params.matchId);
      const plan = scenario.plan('write', matchId);
      const body: unknown = await request.json().catch(() => null);
      const match = parseMatchSubmission(body);
      if (plan.hangAfterCommit) {
        if (match?.matchId === matchId) db.put(match, now());
        // The record is stored, but the answer never arrives: the client times out.
        await delay('infinite');
      }
      const failed = await applyPlan(plan);
      if (failed !== null) return failed;
      if (match?.matchId !== matchId) {
        return HttpResponse.json({ error: 'Invalid match' }, { status: 422 });
      }
      const result = db.put(match, now());
      switch (result.kind) {
        case 'created':
          return HttpResponse.json(result.record, { status: 201 });
        case 'existing':
          return HttpResponse.json(result.record, { status: 200 });
        case 'conflict':
          return HttpResponse.json({ error: 'Another match has this id' }, { status: 409 });
      }
    }),

    http.get('/api/__mock/status', () => HttpResponse.json(status())),
    http.put('/api/__mock/scenario', async ({ request }) => {
      const body: unknown = await request.json().catch(() => null);
      const name =
        typeof body === 'object' && body !== null
          ? (body as { scenario?: unknown }).scenario
          : null;
      if (!isScenarioName(name)) {
        return HttpResponse.json({ error: 'Unknown scenario' }, { status: 422 });
      }
      scenario.set(name);
      return HttpResponse.json(status());
    }),
    http.post('/api/__mock/recover', () => {
      scenario.recover();
      return HttpResponse.json(status());
    }),
    http.post('/api/__mock/reset', () => {
      db.reset();
      scenario.set('success');
      return HttpResponse.json(status());
    }),
  ];
}
