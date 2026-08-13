import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sidepanelSource = readFileSync(new URL("../sidepanel.js", import.meta.url), "utf8");
const extractionStart = sidepanelSource.indexOf("function extractMainContentFromPage() {");
const extractionEnd = sidepanelSource.indexOf("\nfunction setBusy", extractionStart);
const extractionFunctionSource = sidepanelSource.slice(extractionStart, extractionEnd);

function runExtraction({ selectionText = "", activeElement = null } = {}) {
  const context = {
    document: {
      activeElement,
      body: {},
      documentElement: { lang: "en" },
      title: "Example page"
    },
    location: {
      href: "https://example.com/article",
      hostname: "example.com"
    },
    window: {
      getSelection() {
        return {
          isCollapsed: !selectionText,
          toString() {
            return selectionText;
          }
        };
      }
    }
  };

  const extract = vm.runInNewContext(`(${extractionFunctionSource})`, context);
  return extract();
}

test("page extraction prioritizes the current document selection", () => {
  const result = runExtraction({ selectionText: "  A selected\t sentence.  " });

  assert.equal(result.content, "A selected sentence.");
  assert.equal(result.sourceType, "selection");
  assert.equal(result.title, "Example page");
});

test("page extraction supports selected text inside form controls", () => {
  const result = runExtraction({
    selectionText: "Document selection",
    activeElement: {
      tagName: "TEXTAREA",
      selectionStart: 7,
      selectionEnd: 15,
      value: "Before control selection after"
    }
  });

  assert.equal(result.content, "control");
  assert.equal(result.sourceType, "selection");
});
