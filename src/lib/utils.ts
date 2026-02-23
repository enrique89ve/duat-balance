export const REQUEST_TIMEOUT_MS = 20_000;
export const DEFAULT_PRECISION = 3;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const toErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	return String(error);
};

export const toInteger = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.trunc(value);
	}
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return Math.trunc(parsed);
	}
	return null;
};

export const formatAmount = (rawAmount: number, precision: number): string => {
	const factor = 10 ** precision;
	return (rawAmount / factor).toFixed(precision);
};

export const fetchJson = async (url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: "application/json" },
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} en ${url}`);
		}
		return await response.json();
	} catch (error: unknown) {
		if (error instanceof Error && error.message.startsWith("HTTP ")) throw error;
		throw new Error(`Fetch fallido: ${url}`, { cause: error });
	} finally {
		clearTimeout(timeout);
	}
};
