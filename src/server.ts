import type { SnapshotData, HolderEntry } from "./lib/types.ts";
import { formatAmount, isRecord } from "./lib/utils.ts";

const DEFAULT_PORT = 7321;
const PUBLIC_ROOT = new URL("../public/", import.meta.url);
const SNAPSHOT_PATH = new URL("../data/duat-snapshot.json", import.meta.url);

type HolderView = {
	readonly account: string;
	readonly balance: string;
	readonly poweredUp: string;
	readonly gov: string;
	readonly total: string;
};

type SnapshotCache = {
	readonly data: SnapshotData;
	readonly holdersIndex: ReadonlyMap<string, HolderEntry>;
};

const validateHolderEntry = (entry: unknown, index: number): void => {
	if (!isRecord(entry)) {
		throw new Error(`Snapshot: holders[${index}] no es un objeto valido.`);
	}
	if (typeof entry["account"] !== "string" || entry["account"].length === 0) {
		throw new Error(`Snapshot: holders[${index}].account debe ser un string no vacio.`);
	}
	const numericFields = ["balance", "poweredUp", "gov", "total", "snapBalance", "claimCount"] as const;
	for (const field of numericFields) {
		if (typeof entry[field] !== "number" || !Number.isFinite(entry[field] as number)) {
			throw new Error(`Snapshot: holders[${index}].${field} debe ser un numero finito.`);
		}
	}
	if (typeof entry["claimed"] !== "boolean") {
		throw new Error(`Snapshot: holders[${index}].claimed debe ser un booleano.`);
	}
	if (typeof entry["acquiredViaDex"] !== "boolean") {
		throw new Error(`Snapshot: holders[${index}].acquiredViaDex debe ser un booleano.`);
	}
	const nullableStringFields = ["firstClaim", "lastClaim"] as const;
	for (const field of nullableStringFields) {
		if (entry[field] !== null && typeof entry[field] !== "string") {
			throw new Error(`Snapshot: holders[${index}].${field} debe ser string o null.`);
		}
	}
};

const validateTokenStats = (stats: Record<string, unknown>): void => {
	if (typeof stats["symbol"] !== "string" || stats["symbol"].length === 0) {
		throw new Error("Snapshot: tokenStats.symbol debe ser un string no vacio.");
	}
	if (typeof stats["precision"] !== "number" || !Number.isInteger(stats["precision"]) || stats["precision"] < 0) {
		throw new Error("Snapshot: tokenStats.precision debe ser un entero no negativo.");
	}
	const numericFields = ["tokenSupply", "totalLiquid", "totalPoweredUp", "totalGov", "holderCount"] as const;
	for (const field of numericFields) {
		if (typeof stats[field] !== "number" || !Number.isFinite(stats[field] as number)) {
			throw new Error(`Snapshot: tokenStats.${field} debe ser un numero finito.`);
		}
	}
	if (typeof stats["node"] !== "string") {
		throw new Error("Snapshot: tokenStats.node debe ser un string.");
	}
	if (stats["version"] !== null && typeof stats["version"] !== "string") {
		throw new Error("Snapshot: tokenStats.version debe ser string o null.");
	}
};

const validateClaimAnalysis = (analysis: Record<string, unknown>): void => {
	const numericFields = [
		"totalOperations", "uniqueClaimers", "claimersStillHolding",
		"claimersZeroBalance", "holdersNoClaim", "snapEligible",
		"snapNeverClaimed", "unclaimedRaw",
	] as const;
	for (const field of numericFields) {
		if (typeof analysis[field] !== "number" || !Number.isFinite(analysis[field] as number)) {
			throw new Error(`Snapshot: claimAnalysis.${field} debe ser un numero finito.`);
		}
	}
	if (!isRecord(analysis["dateRange"])) {
		throw new Error("Snapshot: claimAnalysis.dateRange debe ser un objeto.");
	}
	const dateRange = analysis["dateRange"];
	if (typeof dateRange["firstBlock"] !== "number" || !Number.isFinite(dateRange["firstBlock"])) {
		throw new Error("Snapshot: claimAnalysis.dateRange.firstBlock debe ser un numero finito.");
	}
	if (typeof dateRange["lastBlock"] !== "number" || !Number.isFinite(dateRange["lastBlock"])) {
		throw new Error("Snapshot: claimAnalysis.dateRange.lastBlock debe ser un numero finito.");
	}
};

const validateSnapshotData = (raw: unknown): SnapshotData => {
	if (!isRecord(raw)) {
		throw new Error("Snapshot JSON no es un objeto valido.");
	}
	if (!isRecord(raw["meta"]) || typeof raw["meta"]["collectedAt"] !== "string") {
		throw new Error("Snapshot: campo 'meta' invalido.");
	}
	if (!isRecord(raw["tokenStats"])) {
		throw new Error("Snapshot: campo 'tokenStats' invalido.");
	}
	validateTokenStats(raw["tokenStats"]);
	if (!Array.isArray(raw["holders"])) {
		throw new Error("Snapshot: campo 'holders' no es un array.");
	}
	for (let i = 0; i < raw["holders"].length; i++) {
		validateHolderEntry(raw["holders"][i], i);
	}
	if (!isRecord(raw["claimAnalysis"])) {
		throw new Error("Snapshot: campo 'claimAnalysis' invalido.");
	}
	validateClaimAnalysis(raw["claimAnalysis"]);
	return raw as SnapshotData;
};

const loadSnapshot = async (): Promise<SnapshotCache | null> => {
	const file = Bun.file(SNAPSHOT_PATH);
	if (!(await file.exists())) return null;

	const raw: unknown = await file.json();
	const data = validateSnapshotData(raw);

	const holdersIndex = new Map(data.holders.map((h) => [h.account, h]));

	return { data, holdersIndex };
};

const formatHolder = (entry: HolderEntry, precision: number): HolderView => ({
	account: entry.account,
	balance: formatAmount(entry.balance, precision),
	poweredUp: formatAmount(entry.poweredUp, precision),
	gov: formatAmount(entry.gov, precision),
	total: formatAmount(entry.total, precision),
});

type PageConfig = {
	readonly bodyFile: string;
	readonly script: string;
	readonly title: string;
	readonly description: string;
	readonly ogTitle: string;
	readonly ogDescription: string;
};

const PAGES = new Map<string, PageConfig>([
	["/", {
		bodyFile: "pages/index.html",
		script: "/app.js",
		title: "DUAT Balance Tracker",
		description: "Browse DUAT token holder balances and staking data from the Ragnarok game on Hive blockchain.",
		ogTitle: "DUAT Balance Tracker",
		ogDescription: "Browse DUAT token holder balances and staking data from the Ragnarok game on Hive.",
	}],
	["/info", {
		bodyFile: "pages/info.html",
		script: "/info.js",
		title: "DUAT Snapshot Analytics",
		description: "DUAT token analytics: airdrop claims analysis, holder retention, supply distribution, and top holders on Hive.",
		ogTitle: "DUAT Snapshot Analytics",
		ogDescription: "Airdrop claims analysis, holder retention, and supply distribution for the DUAT token on Hive.",
	}],
]);

const compileTemplate = (template: string, page: PageConfig, body: string): string =>
	template
		.replace("{{title}}", page.title)
		.replace("{{description}}", page.description)
		.replace("{{ogTitle}}", page.ogTitle)
		.replace("{{ogDescription}}", page.ogDescription)
		.replace("{{script}}", page.script)
		.replace("{{body}}", body);

const buildPages = async (): Promise<Map<string, string>> => {
	const baseTemplate = await Bun.file(new URL("base.html", PUBLIC_ROOT)).text();
	const compiled = new Map<string, string>();

	for (const [route, config] of PAGES) {
		const bodyHtml = await Bun.file(new URL(config.bodyFile, PUBLIC_ROOT)).text();
		compiled.set(route, compileTemplate(baseTemplate, config, bodyHtml));
	}

	return compiled;
};

const staticFiles = new Map<string, { fileName: string; contentType: string }>([
	["/styles.css", { fileName: "styles.css", contentType: "text/css; charset=utf-8" }],
	["/app.js", { fileName: "app.js", contentType: "application/javascript; charset=utf-8" }],
	["/cache.js", { fileName: "cache.js", contentType: "application/javascript; charset=utf-8" }],
	["/utils.js", { fileName: "utils.js", contentType: "application/javascript; charset=utf-8" }],
	["/info.js", { fileName: "info.js", contentType: "application/javascript; charset=utf-8" }],
	["/ico.png", { fileName: "ico.png", contentType: "image/png" }],
	["/coin.png", { fileName: "coin.png", contentType: "image/png" }],
]);

const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy":
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://images.hive.blog; connect-src 'self'; frame-ancestors 'none'",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const withSecurityHeaders = (response: Response): Response => {
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
};

const CACHE_POLICY: Record<string, string> = {
	"text/html": "no-cache",
	"text/css": "max-age=3600",
	"application/javascript": "max-age=3600",
	"image/png": "max-age=86400",
};

const jsonResponse = (payload: unknown, status = 200): Response =>
	withSecurityHeaders(
		new Response(JSON.stringify(payload, null, 2), {
			status,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		}),
	);

const sendStaticFile = async (pathname: string): Promise<Response> => {
	const entry = staticFiles.get(pathname);
	if (!entry) return withSecurityHeaders(new Response("Not Found", { status: 404 }));

	const file = Bun.file(new URL(entry.fileName, PUBLIC_ROOT));
	if (!(await file.exists())) return withSecurityHeaders(new Response("Not Found", { status: 404 }));

	const baseType = entry.contentType.split(";")[0]?.trim() ?? "";
	const cacheControl = CACHE_POLICY[baseType] ?? "no-store";

	return withSecurityHeaders(
		new Response(file, {
			headers: {
				"Content-Type": entry.contentType,
				"Cache-Control": cacheControl,
			},
		}),
	);
};

const pages = await buildPages();
const snapshot = await loadSnapshot();

const snapshotJson: string | null = snapshot
	? JSON.stringify(snapshot.data)
	: null;

const snapshotGzip: Uint8Array | null = snapshotJson
	? Bun.gzipSync(Buffer.from(snapshotJson))
	: null;

const snapshotFile = Bun.file(SNAPSHOT_PATH);
const snapshotMtime = (await snapshotFile.exists())
	? new Date(snapshotFile.lastModified)
	: null;

const snapshotEtag = snapshotMtime
	? `"duat-${snapshotMtime.getTime()}"`
	: null;

const snapshotLastModified = snapshotMtime
	? snapshotMtime.toUTCString()
	: null;

const server = Bun.serve({
	port: Number(process.env["PORT"] ?? DEFAULT_PORT),
	idleTimeout: 120,
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		if (pathname === "/api/snapshot-data") {
			if (!snapshotJson || !snapshotGzip || !snapshotEtag || !snapshotLastModified) {
				return jsonResponse({ error: "Snapshot no recolectado. Ejecuta: bun run collect" }, 404);
			}

			const ifNoneMatch = request.headers.get("If-None-Match");
			if (ifNoneMatch === snapshotEtag) {
				return withSecurityHeaders(
					new Response(null, {
						status: 304,
						headers: {
							"ETag": snapshotEtag,
							"Cache-Control": "no-cache",
						},
					}),
				);
			}

			const acceptsGzip = request.headers.get("Accept-Encoding")?.includes("gzip") ?? false;
			const body = acceptsGzip ? snapshotGzip : snapshotJson;
			const headers: Record<string, string> = {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
				"ETag": snapshotEtag,
				"Last-Modified": snapshotLastModified,
			};
			if (acceptsGzip) {
				headers["Content-Encoding"] = "gzip";
			}

			return withSecurityHeaders(new Response(body, { headers }));
		}

		if (pathname.startsWith("/api/user/")) {
			if (!snapshot) {
				return jsonResponse({ error: "Snapshot no disponible." }, 404);
			}

			const username = pathname.slice("/api/user/".length).trim().toLowerCase();
			if (username.length === 0) {
				return jsonResponse({ error: "Falta el nombre de usuario." }, 400);
			}

			const entry = snapshot.holdersIndex.get(username);
			if (!entry) {
				return jsonResponse({ error: `Usuario @${username} no encontrado en el snapshot.` }, 404);
			}

			const precision = snapshot.data.tokenStats.precision;
			return jsonResponse({ user: formatHolder(entry, precision) });
		}

		const pageHtml = pages.get(pathname);
		if (pageHtml) {
			return withSecurityHeaders(
				new Response(pageHtml, {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-cache",
					},
				}),
			);
		}

		return sendStaticFile(pathname);
	},
});

console.log(`DUAT snapshot server running on http://localhost:${server.port}`);
