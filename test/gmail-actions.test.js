import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sidepanelSource = readFileSync(new URL("../sidepanel.js", import.meta.url), "utf8");
const gmailExtractionStart = sidepanelSource.indexOf("async function extractGmailContentFromPage(scope) {");
const gmailExtractionEnd = sidepanelSource.indexOf("\nfunction extractMainContentFromPage() {", gmailExtractionStart);
const gmailExtractionFunctionSource = sidepanelSource.slice(gmailExtractionStart, gmailExtractionEnd);

test("side panel includes the three Gmail thread actions", async () => {
  const source = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");

  assert.match(source, /id="gmail-thread-summary-button"/);
  assert.match(source, />メールスレッド全体を要約</);
  assert.match(source, /id="gmail-latest-summary-button"/);
  assert.match(source, />最新のメールを要約</);
  assert.match(source, /id="gmail-latest-translate-button"/);
  assert.match(source, />最新のメールを翻訳</);
});

test("Gmail actions are hidden until the source is identified", async () => {
  const source = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");

  assert.match(source, /id="gmail-actions" class="action-grid" hidden/);
});

test("Gmail extraction returns only the latest expanded message when requested", async () => {
  const documentBody = {};
  const makeMessage = ({ sender, email, date, bodyText }) => {
    const senderElement = {
      textContent: sender,
      getAttribute(name) {
        return name === "email" ? email : null;
      }
    };
    const dateElement = {
      textContent: date,
      getAttribute(name) {
        return name === "title" ? date : null;
      }
    };
    const container = {
      querySelector(selector) {
        if (selector.startsWith(".gD")) {
          return senderElement;
        }
        if (selector.startsWith(".g3")) {
          return dateElement;
        }
        return null;
      },
      querySelectorAll() {
        return [];
      }
    };
    return {
      hidden: false,
      isConnected: true,
      parentElement: documentBody,
      textContent: bodyText,
      closest() {
        return container;
      },
      getAttribute() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      cloneNode() {
        return {
          textContent: bodyText,
          querySelectorAll() {
            return [];
          }
        };
      }
    };
  };
  const messageBodies = [
    makeMessage({ sender: "First Sender", email: "first@example.com", date: "2026-08-01", bodyText: "First message" }),
    makeMessage({ sender: "Latest Sender", email: "latest@example.com", date: "2026-08-02", bodyText: "Latest message" })
  ];
  const context = {
    document: {
      activeElement: null,
      body: documentBody,
      documentElement: { lang: "ja" },
      title: "Gmail",
      querySelector(selector) {
        return selector === "h2.hP" ? { textContent: "Test thread" } : null;
      },
      querySelectorAll(selector) {
        return selector === ".a3s.aiL, .a3s" ? messageBodies : [];
      }
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
    location: { hostname: "mail.google.com", href: "https://mail.google.com/mail/u/0/#inbox/thread" },
    window: {
      getSelection() {
        return { isCollapsed: true, toString: () => "" };
      }
    }
  };
  const extract = vm.runInNewContext(`(${gmailExtractionFunctionSource})`, context);

  const result = await extract("latest");

  assert.equal(result.sourceType, "gmail-latest");
  assert.equal(result.messageCount, 1);
  assert.match(result.content, /Latest Sender <latest@example\.com>/);
  assert.match(result.content, /Latest message/);
  assert.doesNotMatch(result.content, /First message/);
});

test("Gmail extraction keeps the full message order for a thread summary", async () => {
  const documentBody = {};
  const makeBody = (bodyText) => {
    const container = {
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    };
    return {
      hidden: false,
      isConnected: true,
      parentElement: documentBody,
      closest: () => container,
      getAttribute: () => null,
      querySelectorAll: () => [],
      cloneNode: () => ({ textContent: bodyText, querySelectorAll: () => [] })
    };
  };
  const messageBodies = [makeBody("First body"), makeBody("Second body")];
  const context = {
    document: {
      activeElement: null,
      body: documentBody,
      documentElement: { lang: "en" },
      title: "Gmail",
      querySelector: (selector) => selector === "h2.hP" ? { textContent: "Thread subject" } : null,
      querySelectorAll: (selector) => selector === ".a3s.aiL, .a3s" ? messageBodies : []
    },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    location: { hostname: "mail.google.com", href: "https://mail.google.com/thread" },
    window: { getSelection: () => ({ isCollapsed: true, toString: () => "" }) }
  };
  const extract = vm.runInNewContext(`(${gmailExtractionFunctionSource})`, context);

  const result = await extract("thread");

  assert.equal(result.sourceType, "gmail-thread");
  assert.equal(result.messageCount, 2);
  assert.ok(result.content.indexOf("First body") < result.content.indexOf("Second body"));
});
