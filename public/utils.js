/**
 * Shared formatting utilities for DUAT Snapshot.
 */

const MILLION = 1_000_000;
const THOUSAND = 1_000;

/**
 * Format a raw integer balance into a full decimal string (US locale).
 * @param {number} raw - Raw integer balance
 * @param {number} precision - Decimal places for the token
 * @returns {string} Formatted string, e.g. "9,896,316.000"
 */
export const formatAmount = (raw, precision) => {
	const factor = 10 ** precision;
	return (raw / factor).toLocaleString("en-US", {
		minimumFractionDigits: precision,
		maximumFractionDigits: precision,
	});
};

/**
 * Format a raw integer balance into a compact abbreviated string.
 * >= 1M  → "9.89M"  (2 decimals)
 * >= 1K  → "523.1K" (1 decimal)
 * < 1K   → full precision via formatAmount
 * @param {number} raw - Raw integer balance
 * @param {number} precision - Decimal places for the token
 * @returns {string} Compact string
 */
export const formatCompact = (raw, precision) => {
	const value = raw / 10 ** precision;

	if (value >= MILLION) {
		return `${(value / MILLION).toFixed(2)}M`;
	}
	if (value >= THOUSAND) {
		return `${(value / THOUSAND).toFixed(1)}K`;
	}
	return formatAmount(raw, precision);
};

/**
 * Format a number with US locale grouping (no decimals).
 * @param {number} value
 * @returns {string}
 */
export const formatNum = (value) => {
	if (typeof value !== "number") return String(value);
	return value.toLocaleString("en-US");
};

/**
 * Create a green dot element indicating an airdrop claim.
 * @returns {HTMLSpanElement}
 */
export const createClaimedDot = () => {
	const dot = document.createElement("span");
	dot.className = "claimed-dot";
	dot.title = "Airdrop claimed";
	dot.setAttribute("role", "img");
	dot.setAttribute("aria-label", "Airdrop claimed");
	return dot;
};

/**
 * Create a Hive avatar image element.
 * @param {string} username - Hive account name
 * @returns {HTMLImageElement}
 */
export const createAvatar = (username) => {
	const img = document.createElement("img");
	img.src = `https://images.hive.blog/u/${username}/avatar/small`;
	img.alt = "";
	img.className = "avatar";
	img.loading = "lazy";
	return img;
};
