import { fetchSnapshotData } from "./cache.js";
import { formatAmount, formatCompact, formatNum, createClaimedDot } from "./utils.js";

const overviewGrid = document.querySelector("#overviewGrid");
const claimsBody = document.querySelector("#claimsBody");
const claimsEmpty = document.querySelector("#claimsEmpty");
const findingsList = document.querySelector("#findingsList");
const holdersBody = document.querySelector("#holdersBody");
const holdersEmpty = document.querySelector("#holdersEmpty");
const holdersMeta = document.querySelector("#holdersMeta");

const TOP_HOLDERS_LIMIT = 100;


const createCard = (label, value) => {
	const card = document.createElement("div");
	card.className = "info-card";

	const labelEl = document.createElement("p");
	labelEl.className = "label";
	labelEl.textContent = label;

	const valueEl = document.createElement("p");
	valueEl.className = "value";
	valueEl.textContent = value;

	card.append(labelEl, valueEl);
	return card;
};

const renderOverview = (stats, meta) => {
	overviewGrid.replaceChildren();
	const p = stats.precision;

	overviewGrid.append(
		createCard("Token", stats.symbol),
		createCard("Total Supply", `${formatAmount(stats.tokenSupply, p)} ${stats.symbol}`),
		createCard("Liquid Balance", formatAmount(stats.totalLiquid, p)),
		createCard("Staked (Powered Up)", formatAmount(stats.totalPoweredUp, p)),
		createCard("Governance Locked", formatAmount(stats.totalGov, p)),
		createCard("Active Holders", formatNum(stats.holderCount)),
		createCard("Honeycomb Node", stats.node),
		createCard("Protocol Version", stats.version ?? "unknown"),
		createCard("Snapshot Date", new Date(meta.collectedAt).toLocaleDateString("en-US")),
	);
};

const addClaimRow = (label, value) => {
	const row = document.createElement("tr");
	const labelCell = document.createElement("td");
	const valueCell = document.createElement("td");
	valueCell.className = "number";

	labelCell.textContent = label;
	valueCell.textContent = typeof value === "number" ? formatNum(value) : String(value);

	row.append(labelCell, valueCell);
	claimsBody.append(row);
};

const renderClaims = (analysis, precision) => {
	claimsBody.replaceChildren();
	claimsEmpty.classList.add("hidden");

	addClaimRow("Total airdrop claim transactions", analysis.totalOperations);
	addClaimRow("Unique accounts that claimed", analysis.uniqueClaimers);
	addClaimRow("Claimers still holding DUAT", analysis.claimersStillHolding);
	addClaimRow("Claimers who sold or transferred all", analysis.claimersZeroBalance);
	addClaimRow("Holders who acquired via trades", analysis.holdersNoClaim);
	addClaimRow("Accounts eligible for airdrop", analysis.snapEligible);
	addClaimRow("Eligible accounts that never claimed", analysis.snapNeverClaimed);
	addClaimRow("Unclaimed DUAT tokens", formatAmount(analysis.unclaimedRaw, precision));
	addClaimRow("First claim (Hive block)", formatNum(analysis.dateRange.firstBlock));
	addClaimRow("Last claim (Hive block)", formatNum(analysis.dateRange.lastBlock));
};

const renderFindings = (analysis, stats) => {
	findingsList.replaceChildren();

	const retentionRate = analysis.uniqueClaimers > 0
		? ((analysis.claimersStillHolding / analysis.uniqueClaimers) * 100).toFixed(1)
		: "0";

	const sellRate = analysis.uniqueClaimers > 0
		? ((analysis.claimersZeroBalance / analysis.uniqueClaimers) * 100).toFixed(1)
		: "0";

	const findings = [
		`${formatNum(analysis.uniqueClaimers)} unique accounts claimed the DUAT airdrop across ${formatNum(analysis.totalOperations)} operations.`,
		`${retentionRate}% of claimers still hold DUAT tokens (${formatNum(analysis.claimersStillHolding)} accounts).`,
		`${sellRate}% of claimers have fully sold or transferred their tokens (${formatNum(analysis.claimersZeroBalance)} accounts).`,
		`${formatNum(analysis.holdersNoClaim)} current holders acquired DUAT through decentralized exchange (DEX) trades or direct transfers, with no airdrop claim on record.`,
		`${formatNum(analysis.snapNeverClaimed)} airdrop-eligible account(s) never claimed their tokens.`,
		`${formatNum(stats.holderCount)} accounts currently hold a liquid DUAT balance.`,
	];

	for (const text of findings) {
		const li = document.createElement("li");
		li.textContent = text;
		findingsList.append(li);
	}
};

const renderHolders = (holders, precision, symbol) => {
	holdersBody.replaceChildren();

	const topHolders = holders
		.filter((h) => h.total > 0)
		.slice(0, TOP_HOLDERS_LIMIT);

	if (topHolders.length === 0) {
		holdersEmpty.classList.remove("hidden");
		return;
	}

	holdersEmpty.classList.add("hidden");
	holdersMeta.textContent = `Top ${topHolders.length} by total balance`;

	for (let i = 0; i < topHolders.length; i++) {
		const h = topHolders[i];
		const row = document.createElement("tr");

		const rankCell = document.createElement("td");
		const accountCell = document.createElement("td");
		const balanceCell = document.createElement("td");
		const powCell = document.createElement("td");
		const govCell = document.createElement("td");
		const totalCell = document.createElement("td");

		rankCell.textContent = String(i + 1);
		rankCell.className = "rank";
		accountCell.textContent = h.account;
		if (h.claimed) {
			accountCell.append(createClaimedDot());
		}
		balanceCell.className = "number col-balance";
		balanceCell.textContent = formatAmount(h.balance, precision);
		powCell.className = "number col-powered";
		powCell.textContent = formatAmount(h.poweredUp, precision);
		govCell.className = "number col-gov";
		govCell.textContent = formatAmount(h.gov, precision);
		totalCell.className = "number total";
		const fullValue = document.createElement("span");
		fullValue.className = "full-value";
		fullValue.textContent = formatAmount(h.total, precision);
		const compactValue = document.createElement("span");
		compactValue.className = "compact-value";
		compactValue.textContent = formatCompact(h.total, precision);
		totalCell.append(fullValue, compactValue);

		row.append(rankCell, accountCell, balanceCell, powCell, govCell, totalCell);
		holdersBody.append(row);
	}
};

const loadSnapshot = async () => {
	try {
		const data = await fetchSnapshotData();

		const { meta, tokenStats, holders, claimAnalysis } = data;

		renderOverview(tokenStats, meta);
		renderClaims(claimAnalysis, tokenStats.precision);
		renderFindings(claimAnalysis, tokenStats);
		renderHolders(holders, tokenStats.precision, tokenStats.symbol);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const errorMsg = document.createElement("p");
		errorMsg.className = "placeholder";
		errorMsg.textContent = message;
		overviewGrid.replaceChildren(errorMsg);
	}
};

loadSnapshot();
