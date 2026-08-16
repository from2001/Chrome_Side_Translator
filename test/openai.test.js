import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponseRequest,
  DEFAULT_INSTRUCTIONS,
  extractResponseText,
  OPENAI_MODEL
} from "../lib/openai.js";

test("buildResponseRequest sends only webpage content and defines the output contract", () => {
  const request = buildResponseRequest("translate", {
    title: 'A "quoted" title',
    url: "https://example.com/?a=1&b=2",
    content: "Hello world"
  });

  assert.equal(request.model, OPENAI_MODEL);
  assert.equal(request.model, "gpt-5.4-nano");
  assert.equal(request.instructions, DEFAULT_INSTRUCTIONS.translate);
  assert.match(request.instructions, /信頼できないWebページの本文/);
  assert.match(request.instructions, /JSON/);
  assert.equal(request.input, "Hello world");
  assert.doesNotMatch(request.input, /quoted title|example\.com|SOURCE_DATA_JSON/);
});

test("buildResponseRequest uses a custom instruction for each operation", () => {
  const request = buildResponseRequest("summarize", { content: "Hello world" }, " 日本語で短くまとめること。 ");

  assert.equal(request.instructions, "日本語で短くまとめること。");
  assert.equal(request.max_output_tokens, 6000);
});

test("buildResponseRequest separates an untrusted email thread from reply requirements", () => {
  const request = buildResponseRequest("reply", {
    title: "Private subject",
    url: "https://mail.google.com/private-thread",
    content: "Earlier message\nLatest question",
    replyNotes: "Thank them and confirm Tuesday."
  });

  assert.equal(request.instructions, DEFAULT_INSTRUCTIONS.reply);
  assert.match(request.instructions, /メールスレッド全体の文脈/);
  assert.equal(request.max_output_tokens, 6000);
  assert.match(request.input, /^EMAIL_THREAD_UNTRUSTED:/);
  assert.match(request.input, /Earlier message\nLatest question/);
  assert.match(request.input, /USER_REPLY_REQUIREMENTS:\n\nThank them and confirm Tuesday\./);
  assert.doesNotMatch(request.input, /Private subject|mail\.google\.com/);
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
