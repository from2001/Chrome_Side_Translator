import test from "node:test";
import assert from "node:assert/strict";

import { limitExtractedText, normalizeExtractedText } from "../lib/page-content.js";

test("normalizeExtractedText compacts spaces and blank lines", () => {
  assert.equal(normalizeExtractedText("  First\t line \n\n\n Second  "), "First line\n\nSecond");
});

test("limitExtractedText reports and marks truncation", () => {
  const result = limitExtractedText("First paragraph\nSecond paragraph is long", 20);
  assert.equal(result.truncated, true);
  assert.equal(result.originalLength, 40);
  assert.match(result.content, /Content truncated by the extension/);
});

test("limitExtractedText leaves short content unchanged", () => {
  assert.deepEqual(limitExtractedText("Short", 20), {
    content: "Short",
    truncated: false,
    originalLength: 5
  });
});
