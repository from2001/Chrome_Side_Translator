import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("manifest grants persistent access to translatable web pages", async () => {
  const source = await readFile(new URL("../manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(source);

  assert.equal(manifest.version, "0.1.3");
  assert.equal(manifest.homepage_url, "https://github.com/from2001/Chrome_Side_Translator");
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.host_permissions.includes("http://*/*"));
  assert.ok(manifest.host_permissions.includes("https://*/*"));
});

test("manifest declares extension and toolbar icons", async () => {
  const source = await readFile(new URL("../manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(source);

  assert.deepEqual(manifest.icons, {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
    48: "assets/icons/icon-48.png",
    128: "assets/icons/icon-128.png",
  });
  assert.deepEqual(manifest.action.default_icon, {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
  });
});
