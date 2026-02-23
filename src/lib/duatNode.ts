import { fetchJson, isRecord, toInteger } from "./utils.ts";

const DEFAULT_DUAT_NODE = "http://121.99.241.161:5306";

export type DuatState = {
	readonly balances: Record<string, number>;
	readonly gov: Record<string, number>;
	readonly pow: Record<string, number>;
	readonly snap: Record<string, number>;
	readonly tokenSupply: number;
	readonly node: string;
	readonly version: string | null;
};

export type DuatTotals = {
	readonly gov: number;
	readonly poweredUp: number;
	readonly tick: string | null;
};

const parseIntMap = (obj: unknown): Record<string, number> => {
	if (!isRecord(obj)) return {};

	const result: Record<string, number> = {};
	for (const [key, value] of Object.entries(obj)) {
		const parsed = toInteger(value);
		if (parsed !== null) {
			result[key] = parsed;
		}
	}
	return result;
};

export const fetchDuatState = async (baseUrl = DEFAULT_DUAT_NODE): Promise<DuatState> => {
	const STATE_TIMEOUT_MS = 60_000;
	const payload = await fetchJson(`${baseUrl}/state`, STATE_TIMEOUT_MS);

	if (!isRecord(payload) || !isRecord(payload["state"])) {
		throw new Error("Respuesta /state invalida del nodo DUAT.");
	}

	const state = payload["state"];
	if (!isRecord(state)) {
		throw new Error("Campo state no es un objeto valido.");
	}

	const balances = parseIntMap(state["balances"]);
	const gov = parseIntMap(state["gov"]);
	const pow = parseIntMap(state["pow"]);
	const snap = parseIntMap(state["snap"]);

	let tokenSupply = 0;
	if (isRecord(state["stats"])) {
		tokenSupply = toInteger(state["stats"]["tokenSupply"]) ?? 0;
	}

	const node = typeof payload["node"] === "string" ? payload["node"] : "unknown";
	const version = typeof payload["VERSION"] === "string" ? payload["VERSION"] : null;

	return { balances, gov, pow, snap, tokenSupply, node, version };
};

export const fetchDuatTotals = async (baseUrl = DEFAULT_DUAT_NODE): Promise<DuatTotals> => {
	const payload = await fetchJson(`${baseUrl}/@t`);

	if (!isRecord(payload)) {
		throw new Error("Respuesta /@t invalida del nodo DUAT.");
	}

	return {
		gov: toInteger(payload["gov"]) ?? 0,
		poweredUp: toInteger(payload["poweredUp"]) ?? 0,
		tick: typeof payload["tick"] === "string" ? payload["tick"] : null,
	};
};
