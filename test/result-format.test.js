import test from "node:test";
import assert from "node:assert/strict";

import { getCopyText, normalizeModelOutput, parseMarkdownBlocks } from "../lib/result-format.js";

test("normalizeModelOutput extracts translated content from a legacy JSON response", () => {
  const result = normalizeModelOutput(JSON.stringify({
    title: "Title",
    url: "https://example.com",
    content: "見出し\\n\\n翻訳された本文"
  }));

  assert.equal(result, "見出し\n\n翻訳された本文");
});

test("normalizeModelOutput removes an outer Markdown code fence", () => {
  assert.equal(normalizeModelOutput("```markdown\n## 概要\n本文\n```"), "## 概要\n本文");
});

test("getCopyText preserves Markdown when that format is selected", () => {
  assert.equal(
    getCopyText("markdown", "概要\n項目A", "## 概要\n\n- **項目A**"),
    "## 概要\n\n- **項目A**"
  );
});

test("getCopyText returns rendered plain text without surrounding whitespace", () => {
  assert.equal(getCopyText("text", "  概要\n項目A  ", "## 概要"), "概要\n項目A");
});

test("parseMarkdownBlocks recognizes headings, paragraphs, and lists", () => {
  assert.deepEqual(parseMarkdownBlocks("## 概要\n\n説明です。\n\n- 項目A\n- **項目B**"), [
    { type: "heading", level: 2, text: "概要" },
    { type: "paragraph", text: "説明です。" },
    { type: "list", ordered: false, items: ["項目A", "**項目B**"] }
  ]);
});

test("parseMarkdownBlocks preserves fenced code as text", () => {
  assert.deepEqual(parseMarkdownBlocks("```js\nconst value = 1;\n```"), [
    { type: "code", text: "const value = 1;" }
  ]);
});
