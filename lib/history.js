export const HISTORY_STORAGE_KEY = "resultHistory";
export const HISTORY_LIMIT = 50;

const VALID_MODES = new Set(["translate", "summarize", "reply"]);
const VALID_SOURCE_TYPES = new Set(["page", "selection", "gmail-thread", "gmail-latest"]);

export function createHistoryEntry({ mode, page, output }, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const id = options.id || createId();

  return normalizeHistoryEntry({
    id,
    mode,
    createdAt,
    title: page && page.title,
    sourceType: page && page.sourceType,
    sourceLength: page && page.content ? page.content.length : 0,
    messageCount: page && page.messageCount,
    truncated: page && page.truncated,
    output
  });
}

export function normalizeHistoryEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeHistoryEntry)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, HISTORY_LIMIT);
}

export async function loadHistory(storageArea) {
  const stored = await storageArea.get(HISTORY_STORAGE_KEY);
  return normalizeHistoryEntries(stored[HISTORY_STORAGE_KEY]);
}

export async function addHistoryEntry(storageArea, data, options = {}) {
  const entries = await loadHistory(storageArea);
  const entry = createHistoryEntry(data, options);
  if (!entry) {
    throw new Error("The history entry is invalid.");
  }

  const nextEntries = [entry, ...entries.filter((item) => item.id !== entry.id)]
    .slice(0, HISTORY_LIMIT);
  await storageArea.set({ [HISTORY_STORAGE_KEY]: nextEntries });
  return nextEntries;
}

export async function deleteHistoryEntry(storageArea, id) {
  const entries = await loadHistory(storageArea);
  const nextEntries = entries.filter((entry) => entry.id !== id);
  await storageArea.set({ [HISTORY_STORAGE_KEY]: nextEntries });
  return nextEntries;
}

export async function clearHistory(storageArea) {
  await storageArea.remove(HISTORY_STORAGE_KEY);
  return [];
}

function normalizeHistoryEntry(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = cleanText(value.id, 200);
  const output = cleanText(value.output, 40000);
  const createdAt = cleanText(value.createdAt, 100);
  if (!id || !output || !VALID_MODES.has(value.mode) || !Number.isFinite(Date.parse(createdAt))) {
    return null;
  }

  return {
    id,
    mode: value.mode,
    createdAt: new Date(createdAt).toISOString(),
    title: cleanText(value.title, 500) || "タイトルなし",
    sourceType: VALID_SOURCE_TYPES.has(value.sourceType) ? value.sourceType : "page",
    sourceLength: toNonNegativeInteger(value.sourceLength),
    messageCount: toNonNegativeInteger(value.messageCount),
    truncated: value.truncated === true,
    output
  };
}

function cleanText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
