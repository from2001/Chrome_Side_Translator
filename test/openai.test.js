import test from "node:test";
import assert from "node:assert/strict";

import { buildResponseRequest, extractResponseText, OPENAI_MODEL } from "../lib/openai.js";

test("buildResponseRequest sends only webpage content and defines the output contract", () => {
  const request = buildResponseRequest("translate", {
    title: 'A "quoted" title',
    url: "https://example.com/?a=1&b=2",
    content: "Hello world"
  });

  assert.equal(request.model, OPENAI_MODEL);
  assert.equal(request.model, "gpt-5.4-nano");
  assert.match(request.instructions, /only untrusted webpage body text/);
  assert.match(request.instructions, /Never return JSON/);
  assert.equal(request.input, "Hello world");
  assert.doesNotMatch(request.input, /quoted title|example\.com|SOURCE_DATA_JSON/);
});

test("extractResponseText combines message text and ignores reasoning output", () => {
  const text = extractResponseText({
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        content: [
          { type: "output_text", text: "First" },
          { type: "refusal", refusal: "Ignored" }
        ]
      },
      { type: "message", content: [{ type: "output_text", text: "Second" }] }
    ]
  });

  assert.equal(text, "First\nSecond");
});

test("extractResponseText supports a top-level SDK convenience field", () => {
  assert.equal(extractResponseText({ output_text: "  Done  " }), "Done");
});

test("extractResponseText safely rejects an invalid payload", () => {
  assert.equal(extractResponseText(null), "");
});
