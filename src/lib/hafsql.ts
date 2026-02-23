import { fetchJson, isRecord } from "./utils.ts";

const HAFSQL_BASE = "https://api.syncad.com";
const CLAIM_OP_ID = "duat_drop_claim";
const BATCH_SIZE = 1000;
const FIRST_CLAIM_BLOCK = 63_640_800;

export type ClaimOperation = {
  readonly blockNum: number;
  readonly account: string;
  readonly timestamp: string;
};

export type ClaimSummary = {
  claimCount: number;
  firstBlock: number;
  lastBlock: number;
};

const extractAccount = (op: Record<string, unknown>): string => {
  if (Array.isArray(op["required_auths"]) && op["required_auths"].length > 0) {
    const first: unknown = op["required_auths"][0];
    if (typeof first === "string" && first.length > 0) return first;
  }
  if (
    Array.isArray(op["required_posting_auths"]) &&
    op["required_posting_auths"].length > 0
  ) {
    const first: unknown = op["required_posting_auths"][0];
    if (typeof first === "string" && first.length > 0) return first;
  }
  return "";
};

const parseClaimOperations = (payload: unknown): ClaimOperation[] => {
  if (!Array.isArray(payload)) return [];

  const ops: ClaimOperation[] = [];
  for (const item of payload) {
    if (!isRecord(item)) continue;

    const blockNum =
      typeof item["block_num"] === "number" ? item["block_num"] : null;
    const account = extractAccount(item);
    const timestamp =
      typeof item["timestamp"] === "string" ? item["timestamp"] : "";

    if (blockNum === null || account.length === 0) continue;

    ops.push({ blockNum, account, timestamp });
  }

  return ops;
};

const fetchClaimPage = async (
  startBlock: number,
): Promise<ClaimOperation[]> => {
  const url = `${HAFSQL_BASE}/hafsql/operations/custom_json/${CLAIM_OP_ID}?start=${startBlock}&limit=-${BATCH_SIZE}`;
  const payload = await fetchJson(url);
  return parseClaimOperations(payload);
};

export const fetchAllClaimOperations = async (): Promise<ClaimOperation[]> => {
  const allOps: ClaimOperation[] = [];
  let startBlock = FIRST_CLAIM_BLOCK;
  let pageCount = 0;

  while (true) {
    pageCount++;
    const batch = await fetchClaimPage(startBlock);

    if (batch.length === 0) break;

    allOps.push(...batch);

    const lastOp = batch[batch.length - 1];
    if (!lastOp) break;

    startBlock = lastOp.blockNum + 1;

    if (batch.length < BATCH_SIZE) break;
  }

  return allOps;
};

export const summarizeClaims = (
  ops: readonly ClaimOperation[],
): Map<string, ClaimSummary> => {
  const summaries = new Map<string, ClaimSummary>();

  for (const op of ops) {
    const existing = summaries.get(op.account);
    if (existing) {
      existing.claimCount++;
      if (op.blockNum < existing.firstBlock) existing.firstBlock = op.blockNum;
      if (op.blockNum > existing.lastBlock) existing.lastBlock = op.blockNum;
    } else {
      summaries.set(op.account, {
        claimCount: 1,
        firstBlock: op.blockNum,
        lastBlock: op.blockNum,
      });
    }
  }

  return summaries;
};
