import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { DEFAULT_INSTRUCTIONS, INSTRUCTION_STORAGE_KEYS } from "../lib/openai.js";

test("settings expose a configurable reply instruction", async () => {
  const html = await readFile(new URL("../options.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../options.js", import.meta.url), "utf8");

  assert.equal(INSTRUCTION_STORAGE_KEYS.reply, "replyInstruction");
  assert.match(DEFAULT_INSTRUCTIONS.reply, /返信メール案/);
  assert.match(html, /id="reply-instruction"/);
  assert.match(script, /INSTRUCTION_STORAGE_KEYS\.reply/);
  assert.match(script, /DEFAULT_INSTRUCTIONS\.reply/);
});
