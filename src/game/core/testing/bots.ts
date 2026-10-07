import type { PlayerInput, World } from '../types';
import { naiveBotInput } from './naiveBot';
import { skilledBotInput } from './skilledBot';

/** Scripted players for headless tests and `pnpm balance` (never bundled into the app). */
export const BOT_PROFILES = {
  naive: naiveBotInput,
  skilled: skilledBotInput,
} as const satisfies Record<string, (world: World) => PlayerInput>;

export type BotProfile = keyof typeof BOT_PROFILES;

export const BOT_PROFILE_NAMES = Object.keys(BOT_PROFILES) as readonly BotProfile[];
