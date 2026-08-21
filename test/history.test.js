import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  addHistoryEntry,
  clearHistory,
  createHistoryEntry,
  deleteHistoryEntry,
  normalizeHistoryEntries
} from "../lib/history.js";

function createStorage(initialEntries = []) {
  const values = { [HISTORY_STORAGE_KEY]: initialEntries };
  return {
    values,
    async get(key) {
      return { [key]: values[key] };
    },
    async set(nextValues) {
      Object.assign(values, nextValues);
    },
    async remove(key) {
      delete values[key];
    }
  };
}

function makeData(number = 1) {
  return {
    mode: "translate",
    page: {
      title: `Page ${number}`,
      url: `https://example.com/private/${number}`,
      content: `Source content ${number}`,
      sourceType: "page",
      replyNotes: "Private reply requirements"
    },
    output: `Result ${number}`
  };
}

test("history entry stores the result without the source text or URL", () => {
  const entry = createHistoryEntry(makeData(), {
    id: "entry-1",
    createdAt: "2026-08-21T10:00:00.000Z"
  });

  assert.deepEqual(entry, {
    id: "entry-1",
    mode: "translate",
    createdAt: "2026-08-21T10:00:00.000Z",
    title: "Page 1",
    sourceType: "page",
    sourceLength: 16,
    messageCount: 0,
    truncated: false,
    output: "Result 1"
  });
  assert.doesNotMatch(JSON.stringify(entry), /Source content|Private reply|example\.com/);
});

test("history keeps the newest entries up to the configured limit", async () => {
  const storage = createStorage();

  for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) {
    await addHistoryEntry(storage, makeData(index), {
      id: `entry-${index}`,
      createdAt: new Date(Date.UTC(2026, 7, 21, 0, index)).toISOString()
    });
  }

  const entries = storage.values[HISTORY_STORAGE_KEY];
  assert.equal(entries.length, HISTORY_LIMIT);
  assert.equal(entries[0].id, `entry-${HISTORY_LIMIT + 2}`);
  assert.equal(entries.at(-1).id, "entry-3");
});

test("history normalization ignores malformed entries and sorts newest first", () => {
  const entries = normalizeHistoryEntries([
    createHistoryEntry(makeData(1), { id: "older", createdAt: "2026-08-20T10:00:00Z" }),
    { mode: "translate", output: "Missing identity" },
    createHistoryEntry(makeData(2), { id: "newer", createdAt: "2026-08-21T10:00:00Z" })
  ]);

  assert.deepEqual(entries.map((entry) => entry.id), ["newer", "older"]);
});

test("a single history entry can be deleted", async () => {
  const first = createHistoryEntry(makeData(1), { id: "first", createdAt: "2026-08-21T10:00:00Z" });
  const second = createHistoryEntry(makeData(2), { id: "second", createdAt: "2026-08-21T11:00:00Z" });
  const storage = createStorage([first, second]);

  const entries = await deleteHistoryEntry(storage, "first");

  assert.deepEqual(entries.map((entry) => entry.id), ["second"]);
});

test("all history entries can be cleared", async () => {
  const storage = createStorage([
    createHistoryEntry(makeData(), { id: "entry", createdAt: "2026-08-21T10:00:00Z" })
  ]);

  const entries = await clearHistory(storage);

  assert.deepEqual(entries, []);
  assert.equal(HISTORY_STORAGE_KEY in storage.values, false);
});

test("side panel exposes history controls and explains local retention", async () => {
  const html = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");

  assert.match(html, /id="open-history"/);
  assert.match(html, /id="history-card"[^>]*hidden/);
  assert.match(html, /id="history-list"/);
  assert.match(html, /結果とページタイトルをこの端末内に最大50件保存/);
});

test("the extension package includes the history module", async () => {
  const packageScript = await readFile(new URL("../scripts/package-extension.sh", import.meta.url), "utf8");

  assert.match(packageScript, /^lib\/history\.js$/m);
});
