import { fetchSnapshotData } from "./cache.js";
import { formatAmount, formatCompact, createClaimedDot, createAvatar } from "./utils.js";

const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const searchResults = document.querySelector("#searchResults");
const snapshotMeta = document.querySelector("#snapshotMeta");
const holdersBody = document.querySelector("#holdersBody");
const holdersEmpty = document.querySelector("#holdersEmpty");
const pagination = document.querySelector("#pagination");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const pageIndicator = document.querySelector("#pageIndicator");

const ITEMS_PER_PAGE = 100;

let allHolders = [];
let precision = 3;
let symbol = "DUAT";
let currentPage = 1;
let totalPages = 1;

const handleExpandToggle = (event) => {
	const btn = event.currentTarget;
	const row = btn.closest("tr");
	const existingExpanded = holdersBody.querySelector(".detail-row.expanded");

	if (existingExpanded && existingExpanded.previousElementSibling !== row) {
		existingExpanded.classList.remove("expanded");
		const prevBtn = existingExpanded.previousElementSibling.querySelector(".expand-toggle");
		if (prevBtn) {
			prevBtn.textContent = "\u25BE";
			prevBtn.setAttribute("aria-expanded", "false");
			prevBtn.setAttribute("aria-label", "Show details");
		}
	}

	let detailRow = row.nextElementSibling;
	if (detailRow && detailRow.classList.contains("detail-row")) {
		detailRow.classList.toggle("expanded");
		const isExpanded = detailRow.classList.contains("expanded");
		btn.textContent = isExpanded ? "\u25B4" : "\u25BE";
		btn.setAttribute("aria-expanded", String(isExpanded));
		btn.setAttribute("aria-label", isExpanded ? "Hide details" : "Show details");
		return;
	}

	detailRow = document.createElement("tr");
	detailRow.className = "detail-row expanded";
	const detailCell = document.createElement("td");
	detailCell.className = "detail-content";
	detailCell.colSpan = 4;

	const dl = document.createElement("dl");
	dl.className = "detail-list";

	const fields = [
		["Balance", row.dataset.balance],
		["Powered Up", row.dataset.powered],
		["Gov", row.dataset.gov],
	];

	for (const [label, value] of fields) {
		const wrapper = document.createElement("div");
		const dt = document.createElement("dt");
		dt.textContent = label;
		const dd = document.createElement("dd");
		dd.textContent = value;
		wrapper.append(dt, dd);
		dl.append(wrapper);
	}

	detailCell.append(dl);
	detailRow.append(detailCell);
	row.after(detailRow);

	btn.textContent = "\u25B4";
	btn.setAttribute("aria-expanded", "true");
	btn.setAttribute("aria-label", "Hide details");
};

const renderHoldersPage = () => {
	holdersBody.replaceChildren();

	if (allHolders.length === 0) {
		holdersEmpty.classList.remove("hidden");
		pagination.classList.add("hidden");
		return;
	}

	holdersEmpty.classList.add("hidden");
	pagination.classList.remove("hidden");

	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allHolders.length);
	const pageHolders = allHolders.slice(startIndex, endIndex);

	for (let i = 0; i < pageHolders.length; i++) {
		const h = pageHolders[i];
		const row = document.createElement("tr");

		const rankCell = document.createElement("td");
		const accountCell = document.createElement("td");
		const balanceCell = document.createElement("td");
		const powCell = document.createElement("td");
		const govCell = document.createElement("td");
		const totalCell = document.createElement("td");

		rankCell.textContent = String(startIndex + i + 1);
		rankCell.className = "rank";
		accountCell.className = "account-cell";
		accountCell.append(createAvatar(h.account));
		accountCell.append(document.createTextNode(h.account));
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

		row.dataset.balance = formatAmount(h.balance, precision);
		row.dataset.powered = formatAmount(h.poweredUp, precision);
		row.dataset.gov = formatAmount(h.gov, precision);

		const expandCell = document.createElement("td");
		expandCell.className = "col-expand";
		const expandBtn = document.createElement("button");
		expandBtn.className = "expand-toggle";
		expandBtn.textContent = "\u25BE";
		expandBtn.setAttribute("aria-expanded", "false");
		expandBtn.setAttribute("aria-label", "Show details");
		expandBtn.addEventListener("click", handleExpandToggle);
		expandCell.append(expandBtn);

		row.append(rankCell, accountCell, balanceCell, powCell, govCell, totalCell, expandCell);
		holdersBody.append(row);
	}

	updatePaginationControls();
};

const updatePaginationControls = () => {
	totalPages = Math.max(1, Math.ceil(allHolders.length / ITEMS_PER_PAGE));
	pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
	prevButton.disabled = currentPage <= 1;
	nextButton.disabled = currentPage >= totalPages;
};

const goToPage = (page) => {
	currentPage = Math.max(1, Math.min(page, totalPages));
	renderHoldersPage();
	window.scrollTo({ top: holdersBody.closest(".panel").offsetTop - 16, behavior: "smooth" });
};

const renderSearchResults = (query) => {
	const term = query.trim().toLowerCase();
	if (term.length === 0) {
		searchResults.classList.add("hidden");
		searchResults.replaceChildren();
		return;
	}

	const matches = allHolders.filter((h) => h.account.includes(term)).slice(0, 20);

	if (matches.length === 0) {
		searchResults.classList.remove("hidden");
		const noResultsMsg = document.createElement("p");
		noResultsMsg.className = "placeholder";
		noResultsMsg.textContent = `No accounts found matching "${term}".`;
		searchResults.replaceChildren(noResultsMsg);
		return;
	}

	searchResults.classList.remove("hidden");
	searchResults.replaceChildren();

	for (const h of matches) {
		const card = document.createElement("div");
		card.className = "search-card";

		const header = document.createElement("div");
		header.className = "search-card-header";
		header.append(createAvatar(h.account));
		const account = document.createElement("strong");
		account.textContent = `@${h.account}`;
		header.append(account);
		if (h.claimed) {
			header.append(createClaimedDot());
		}

		const details = document.createElement("div");
		details.className = "search-details";

		const detailEntries = [
			["Balance", formatAmount(h.balance, precision)],
			["Powered Up", formatAmount(h.poweredUp, precision)],
			["Gov", formatAmount(h.gov, precision)],
			["Total", formatAmount(h.total, precision)],
		];

		for (const [label, value] of detailEntries) {
			const span = document.createElement("span");
			span.textContent = `${label}: ${value}`;
			details.append(span);
		}

		card.append(header, details);
		searchResults.append(card);
	}
};

const loadSnapshot = async () => {
	try {
		const data = await fetchSnapshotData();

		const { meta, tokenStats, holders } = data;
		precision = tokenStats.precision;
		symbol = tokenStats.symbol;

		// Data arrives pre-sorted by total descending from collector
		allHolders = holders.filter((h) => h.total > 0);

		const collectedDate = new Date(meta.collectedAt).toLocaleDateString("en-US");
		snapshotMeta.textContent = `${symbol} | ${allHolders.length} active holders | Snapshot: ${collectedDate}`;

		currentPage = 1;
		renderHoldersPage();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		snapshotMeta.textContent = message;
		holdersEmpty.textContent = message;
	}
};

searchButton.addEventListener("click", () => {
	renderSearchResults(searchInput.value);
});

searchInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		renderSearchResults(searchInput.value);
	}
});

prevButton.addEventListener("click", () => {
	goToPage(currentPage - 1);
});

nextButton.addEventListener("click", () => {
	goToPage(currentPage + 1);
});

loadSnapshot();
