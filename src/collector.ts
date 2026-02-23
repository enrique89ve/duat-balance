import { fetchDuatState } from "./lib/duatNode.ts";
import { fetchAllClaimOperations, summarizeClaims } from "./lib/hafsql.ts";
import { fetchJson, isRecord, toInteger, formatAmount, DEFAULT_PRECISION } from "./lib/utils.ts";
import type { SnapshotData, HolderEntry, ClaimAnalysis, TokenStats } from "./lib/types.ts";

const DUAT_NODE = "http://121.99.241.161:5306";
const HAFSQL_BASE = "https://api.syncad.com";
const OUTPUT_PATH = "data/duat-snapshot.json";
const RESERVED_ACCOUNTS = new Set(["ra", "rc", "rd", "ri", "rn", "rm"]);

const fetchTokenPrecision = async (): Promise<{ symbol: string; precision: number }> => {
	const payload = await fetchJson(`${DUAT_NODE}/api/coin_detail`);
	if (!isRecord(payload) || !Array.isArray(payload["coins"])) {
		return { symbol: "DUAT", precision: DEFAULT_PRECISION };
	}

	for (const coin of payload["coins"]) {
		if (!isRecord(coin)) continue;
		const symbol = typeof coin["symbol"] === "string" ? coin["symbol"].trim().toUpperCase() : "";
		if (symbol.length === 0 || symbol === "HIVE" || symbol === "HBD") continue;

		let precision = toInteger(coin["precision"]);
		if (precision === null && isRecord(coin["incirc"])) {
			precision = toInteger(coin["incirc"]["precision"]);
		}
		return {
			symbol,
			precision: precision !== null && precision >= 0 && precision <= 12
				? precision
				: DEFAULT_PRECISION,
		};
	}

	return { symbol: "DUAT", precision: DEFAULT_PRECISION };
};

const buildHolderEntries = (
	state: Awaited<ReturnType<typeof fetchDuatState>>,
	claimsMap: ReturnType<typeof summarizeClaims>,
): HolderEntry[] => {
	const allAccounts = new Set<string>();

	for (const account of Object.keys(state.balances)) allAccounts.add(account);
	for (const account of Object.keys(state.gov)) allAccounts.add(account);
	for (const account of Object.keys(state.pow)) allAccounts.add(account);
	for (const account of Object.keys(state.snap)) allAccounts.add(account);
	for (const account of claimsMap.keys()) allAccounts.add(account);

	const entries: HolderEntry[] = [];

	for (const account of allAccounts) {
		if (RESERVED_ACCOUNTS.has(account)) continue;

		const balance = state.balances[account] ?? 0;
		const poweredUp = state.pow[account] ?? 0;
		const gov = state.gov[account] ?? 0;
		const snapBalance = state.snap[account] ?? 0;
		const total = balance + poweredUp + gov;
		const claim = claimsMap.get(account);

		const hasBalance = total > 0;
		const hasClaim = claim !== undefined;
		const hasSnap = snapBalance > 0;

		if (!hasBalance && !hasClaim && !hasSnap) continue;

		entries.push({
			account,
			balance,
			poweredUp,
			gov,
			total,
			claimed: hasClaim,
			claimCount: claim?.claimCount ?? 0,
			firstClaim: claim ? String(claim.firstBlock) : null,
			lastClaim: claim ? String(claim.lastBlock) : null,
			snapBalance,
			acquiredViaDex: hasBalance && !hasClaim && !hasSnap,
		});
	}

	entries.sort((a, b) => b.total - a.total);
	return entries;
};

const computeClaimAnalysis = (
	holders: readonly HolderEntry[],
	totalClaimOps: number,
	claimsMap: ReturnType<typeof summarizeClaims>,
): ClaimAnalysis => {
	let claimersStillHolding = 0;
	let claimersZeroBalance = 0;
	let holdersNoClaim = 0;
	let snapEligible = 0;
	let snapNeverClaimed = 0;
	let unclaimedRaw = 0;

	for (const h of holders) {
		if (h.snapBalance > 0) snapEligible++;

		if (h.claimed && h.total > 0) claimersStillHolding++;
		if (h.claimed && h.total === 0) claimersZeroBalance++;
		if (!h.claimed && h.total > 0) holdersNoClaim++;
		if (h.snapBalance > 0 && !h.claimed) {
			snapNeverClaimed++;
			unclaimedRaw += h.snapBalance;
		}
	}

	let firstBlock = Infinity;
	let lastBlock = 0;
	for (const summary of claimsMap.values()) {
		if (summary.firstBlock < firstBlock) firstBlock = summary.firstBlock;
		if (summary.lastBlock > lastBlock) lastBlock = summary.lastBlock;
	}

	return {
		totalOperations: totalClaimOps,
		uniqueClaimers: claimsMap.size,
		claimersStillHolding,
		claimersZeroBalance,
		holdersNoClaim,
		snapEligible,
		snapNeverClaimed,
		unclaimedRaw,
		dateRange: {
			firstBlock: firstBlock === Infinity ? 0 : firstBlock,
			lastBlock,
		},
	};
};

const main = async () => {
	console.log("DUAT Snapshot Collector");
	console.log("======================\n");

	console.log("1. Fetching DUAT node state and token metadata...");
	const [state, tokenMeta] = await Promise.all([
		fetchDuatState(DUAT_NODE),
		fetchTokenPrecision(),
	]);

	console.log(`   Node: ${state.node} (${state.version ?? "unknown version"})`);
	console.log(`   Balances: ${Object.keys(state.balances).length} accounts`);
	console.log(`   Gov: ${Object.keys(state.gov).length} accounts`);
	console.log(`   Pow: ${Object.keys(state.pow).length} accounts`);
	console.log(`   Snap: ${Object.keys(state.snap).length} accounts`);
	console.log(`   Token: ${tokenMeta.symbol} (precision=${tokenMeta.precision})\n`);

	console.log("2. Fetching all claim operations from HafSQL...");
	const claimOps = await fetchAllClaimOperations();
	console.log(`   Total claim operations: ${claimOps.length}\n`);

	const claimsMap = summarizeClaims(claimOps);
	console.log(`   Unique claimers: ${claimsMap.size}\n`);

	console.log("3. Building holder entries...");
	const holders = buildHolderEntries(state, claimsMap);
	console.log(`   Total entries: ${holders.length}\n`);

	console.log("4. Computing claim analysis...");
	const claimAnalysis = computeClaimAnalysis(holders, claimOps.length, claimsMap);

	const totalLiquid = Object.values(state.balances).reduce((s, v) => s + v, 0);
	const totalPow = Object.values(state.pow).reduce((s, v) => s + v, 0);
	const totalGov = Object.values(state.gov).reduce((s, v) => s + v, 0);

	const tokenStats: TokenStats = {
		symbol: tokenMeta.symbol,
		precision: tokenMeta.precision,
		tokenSupply: state.tokenSupply,
		totalLiquid,
		totalPoweredUp: totalPow,
		totalGov,
		holderCount: Object.keys(state.balances).length,
		node: state.node,
		version: state.version,
	};

	const snapshotData: SnapshotData = {
		meta: {
			collectedAt: new Date().toISOString(),
			duatNodeUrl: DUAT_NODE,
			hafsqlUrl: HAFSQL_BASE,
		},
		tokenStats,
		holders,
		claimAnalysis,
	};

	console.log("5. Writing snapshot to disk...");
	await Bun.write(OUTPUT_PATH, JSON.stringify(snapshotData, null, 2));

	const p = tokenMeta.precision;
	console.log(`\nDone! Wrote ${OUTPUT_PATH}`);
	console.log("\nSummary:");
	console.log(`  Holders with balance: ${tokenStats.holderCount}`);
	console.log(`  Total entries (incl. snap/claims): ${holders.length}`);
	console.log(`  Supply: ${formatAmount(tokenStats.tokenSupply, p)} ${tokenMeta.symbol}`);
	console.log(`  Liquid: ${formatAmount(totalLiquid, p)}`);
	console.log(`  Powered Up: ${formatAmount(totalPow, p)}`);
	console.log(`  Governance: ${formatAmount(totalGov, p)}`);
	console.log(`  Claim ops: ${claimAnalysis.totalOperations}`);
	console.log(`  Unique claimers: ${claimAnalysis.uniqueClaimers}`);
	console.log(`  Still holding: ${claimAnalysis.claimersStillHolding}`);
	console.log(`  Zero balance: ${claimAnalysis.claimersZeroBalance}`);
	console.log(`  No claim record: ${claimAnalysis.holdersNoClaim}`);
	console.log(`  Snap eligible: ${claimAnalysis.snapEligible}`);
	console.log(`  Never claimed: ${claimAnalysis.snapNeverClaimed}`);
	console.log(`  Unclaimed raw: ${formatAmount(claimAnalysis.unclaimedRaw, p)}`);
};

main().catch((error: unknown) => {
	console.error("Collector failed:", error);
	process.exit(1);
});
