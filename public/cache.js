const CACHE_KEY = "duat_snapshot_data";
const CACHE_ETAG_KEY = "duat_snapshot_etag";

export const fetchSnapshotData = async () => {
	const cachedEtag = localStorage.getItem(CACHE_ETAG_KEY);
	const headers = {};

	if (cachedEtag) {
		headers["If-None-Match"] = cachedEtag;
	}

	const response = await fetch("/api/snapshot-data", { headers });

	if (response.status === 304) {
		const cached = localStorage.getItem(CACHE_KEY);
		if (cached) {
			return JSON.parse(cached);
		}
		localStorage.removeItem(CACHE_ETAG_KEY);
		return fetchSnapshotData();
	}

	if (!response.ok) {
		const body = await response.json();
		const message = typeof body.error === "string"
			? body.error
			: "Failed to load snapshot data";
		throw new Error(message);
	}

	const data = await response.json();

	const etag = response.headers.get("ETag");
	if (etag) {
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify(data));
			localStorage.setItem(CACHE_ETAG_KEY, etag);
		} catch {
			// localStorage unavailable or quota exceeded
		}
	}

	return data;
};
