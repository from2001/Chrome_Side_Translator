import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("manifest grants persistent access to translatable web pages", async () => {
  const source = await readFile(new URL("../manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(source);

  assert.equal(manifest.version, "0.1.2");
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.host_permissions.includes("http://*/*"));
  assert.ok(manifest.host_permissions.includes("https://*/*"));
});
