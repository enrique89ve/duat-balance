export type HolderEntry = {
	readonly account: string;
	readonly balance: number;
	readonly poweredUp: number;
	readonly gov: number;
	readonly total: number;
	readonly claimed: boolean;
	readonly claimCount: number;
	readonly firstClaim: string | null;
	readonly lastClaim: string | null;
	readonly snapBalance: number;
	readonly acquiredViaDex: boolean;
};

export type ClaimAnalysis = {
	readonly totalOperations: number;
	readonly uniqueClaimers: number;
	readonly claimersStillHolding: number;
	readonly claimersZeroBalance: number;
	readonly holdersNoClaim: number;
	readonly snapEligible: number;
	readonly snapNeverClaimed: number;
	readonly unclaimedRaw: number;
	readonly dateRange: {
		readonly firstBlock: number;
		readonly lastBlock: number;
	};
};

export type TokenStats = {
	readonly symbol: string;
	readonly precision: number;
	readonly tokenSupply: number;
	readonly totalLiquid: number;
	readonly totalPoweredUp: number;
	readonly totalGov: number;
	readonly holderCount: number;
	readonly node: string;
	readonly version: string | null;
};

export type SnapshotMeta = {
	readonly collectedAt: string;
	readonly duatNodeUrl: string;
	readonly hafsqlUrl: string;
};

export type SnapshotData = {
	readonly meta: SnapshotMeta;
	readonly tokenStats: TokenStats;
	readonly holders: readonly HolderEntry[];
	readonly claimAnalysis: ClaimAnalysis;
};
