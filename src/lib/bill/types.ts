import type { Answer, Bill, History } from "./schema";

/** Everything read from one bill: Level 1 fields plus the monthly history table. */
export type Analysis = { bill: Bill; history: History };

export type Question = { id: string; text: string };

export type { Answer, Bill, History };
