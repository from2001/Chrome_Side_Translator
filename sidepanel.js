import { INSTRUCTION_STORAGE_KEYS, requestOpenAI } from "./lib/openai.js";
import { normalizeModelOutput, renderMarkdown } from "./lib/result-format.js";

const API_KEY_STORAGE_KEY = "openaiApiKey";

const elements = {
  keyNotice: document.querySelector("#key-notice"),
  translateButton: document.querySelector("#translate-button"),
  summarizeButton: document.querySelector("#summarize-button"),
  progressCard: document.querySelector("#progress-card"),
  progressTitle: document.querySelector("#progress-title"),
  progressDetail: document.querySelector("#progress-detail"),
  errorCard: document.querySelector("#error-card"),
  errorMessage: document.querySelector("#error-message"),
  resultCard: document.querySelector("#result-card"),
  resultMode: document.querySelector("#result-mode"),
  sourceMeta: document.querySelector("#source-meta"),
  resultOutput: document.querySelector("#result-output"),
  copyButton: document.querySelector("#copy-button")
};

let activeController = null;
let currentResultText = "";

initialize();

async function initialize() {
  await refreshKeyState();

  document.querySelectorAll("#open-settings, #notice-settings, #footer-settings")
    .forEach((button) => button.addEventListener("click", () => chrome.runtime.openOptionsPage()));

  elements.translateButton.addEventListener("click", () => processPage("translate"));
  elements.summarizeButton.addEventListener("click", () => processPage("summarize"));
  elements.copyButton.addEventListener("click", copyResult);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[API_KEY_STORAGE_KEY]) {
      refreshKeyState();
    }
  });
}

async function refreshKeyState() {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  const hasKey = Boolean(stored[API_KEY_STORAGE_KEY]);
  elements.keyNotice.hidden = hasKey;
  return stored[API_KEY_STORAGE_KEY] || "";
}

async function processPage(mode) {
  if (activeController) {
    activeController.abort();
  }

  const apiKey = await refreshKeyState();
  if (!apiKey) {
    showError("先にOpenAI APIキーを設定してください。");
    return;
  }

  activeController = new AbortController();
  setBusy(true);
  hideError();
  elements.resultCard.hidden = true;
  updateProgress("テキストを抽出しています", "選択範囲またはページのメインコンテンツを解析中です。");

  try {
    const page = await extractCurrentPage();
    if (!page.content || (page.sourceType !== "selection" && page.content.length < 40)) {
      throw new Error("このページから十分な本文を抽出できませんでした。");
    }

    const sourceLabel = page.sourceType === "selection" ? "選択範囲" : "ページ本文";
    updateProgress(
      mode === "translate" ? "日本語に翻訳しています" : "日本語で要約しています",
      `${sourceLabel}の${page.content.length.toLocaleString("ja-JP")}文字を gpt-5.4-nano へ送信しています。`
    );

    const instructionKey = INSTRUCTION_STORAGE_KEYS[mode];
    const storedInstruction = await chrome.storage.local.get(instructionKey);

    const output = await requestOpenAI({
      apiKey,
      mode,
      page,
      instruction: storedInstruction[instructionKey] || "",
      signal: activeController.signal
    });

    showResult(mode, page, output);
  } catch (error) {
    if (error.name !== "AbortError") {
      showError(toUserMessage(error));
    }
  } finally {
    activeController = null;
    setBusy(false);
  }
}

async function extractCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("アクティブなタブを取得できませんでした。");
  }

  if (!tab.url) {
    throw new Error("アクティブなページのURLを取得できませんでした。拡張機能を再読み込みして、もう一度お試しください。");
  }

  if (!/^https?:\/\//i.test(tab.url)) {
    throw new Error("Chromeの設定ページや拡張機能ページでは実行できません。Webページを開いてください。");
  }

  let injection;
  try {
    [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMainContentFromPage
    });
  } catch (error) {
    if (/cannot access|cannot be scripted|missing host permission|extensions gallery/i.test(error.message)) {
      throw new Error("Chromeによりこのページへのアクセスが制限されています。通常のWebページでお試しください。");
    }
    throw new Error(`ページ本文を読み取れませんでした。ページを再読み込みしてお試しください。 (${error.message})`);
  }

  if (!injection || !injection.result) {
    throw new Error("ページ本文を読み取れませんでした。");
  }

  return injection.result;
}

function extractMainContentFromPage() {
  const MAX_CHARACTERS = 100000;
  const REMOVE_SELECTORS = [
    "script", "style", "noscript", "template", "svg", "canvas", "iframe", "object",
    "nav", "header", "footer", "aside", "form", "dialog", "button",
    "[hidden]", "[aria-hidden='true']", "[role='navigation']", "[role='banner']",
    "[role='contentinfo']", "[role='complementary']", "[role='dialog']",
    ".advertisement", ".advert", ".ads", ".ad", ".cookie-banner", ".cookie-notice",
    ".newsletter", ".social-share", ".related-posts", ".comments", "#comments"
  ];
  const CANDIDATE_SELECTORS = [
    "article", "main", "[role='main']", "#main", "#content", ".main", ".content",
    ".post-content", ".article-content", ".entry-content"
  ];

  if (!document.body) {
    return {
      title: document.title || location.hostname,
      url: location.href,
      language: document.documentElement.lang || "unknown",
      content: "",
      truncated: false,
      originalLength: 0,
      sourceType: "page"
    };
  }

  const selectedText = normalize(getSelectedText());
  if (selectedText) {
    const boundary = selectedText.lastIndexOf("\n", MAX_CHARACTERS);
    const cutAt = boundary >= MAX_CHARACTERS * 0.8 ? boundary : MAX_CHARACTERS;
    const truncated = selectedText.length > MAX_CHARACTERS;
    const content = truncated
      ? `${selectedText.slice(0, cutAt).trim()}\n\n[Content truncated by the extension]`
      : selectedText;

    return {
      title: document.title || location.hostname,
      url: location.href,
      language: document.documentElement.lang || "unknown",
      content,
      truncated,
      originalLength: selectedText.length,
      sourceType: "selection"
    };
  }

  const candidates = Array.from(document.querySelectorAll(CANDIDATE_SELECTORS.join(",")));
  if (candidates.length === 0) {
    candidates.push(document.body);
  }

  let best = document.body;
  let bestScore = -Infinity;
  for (const candidate of [...new Set(candidates)]) {
    if (!candidate) {
      continue;
    }
    const text = normalize(candidate.innerText);
    if (text.length < 40) {
      continue;
    }
    const links = Array.from(candidate.querySelectorAll("a"));
    const linkLength = links.reduce((total, link) => total + normalize(link.innerText).length, 0);
    const linkDensity = Math.min(1, linkLength / Math.max(text.length, 1));
    const paragraphs = candidate.querySelectorAll("p").length;
    const headings = candidate.querySelectorAll("h1, h2, h3").length;
    const semanticBonus = candidate.matches("article, main, [role='main']") ? 1600 : 0;
    const score = Math.min(text.length, 50000) + paragraphs * 80 + headings * 120 + semanticBonus - linkDensity * text.length * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const clone = best.cloneNode(true);
  const sourceElements = Array.from(best.querySelectorAll("*"));
  const clonedElements = Array.from(clone.querySelectorAll("*"));
  sourceElements.forEach((sourceElement, index) => {
    const style = getComputedStyle(sourceElement);
    if (style.display === "none" || style.visibility === "hidden") {
      clonedElements[index].remove();
    }
  });
  clone.querySelectorAll(REMOVE_SELECTORS.join(",")).forEach((element) => element.remove());
  clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    heading.prepend(`${"#".repeat(level)} `);
  });
  clone.querySelectorAll("li").forEach((item) => item.prepend("• "));
  clone.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  clone.querySelectorAll("p, div, section, article, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr")
    .forEach((element) => element.append("\n"));

  const fullText = normalize(clone.textContent);
  const boundary = fullText.lastIndexOf("\n", MAX_CHARACTERS);
  const cutAt = boundary >= MAX_CHARACTERS * 0.8 ? boundary : MAX_CHARACTERS;
  const truncated = fullText.length > MAX_CHARACTERS;
  const content = truncated
    ? `${fullText.slice(0, cutAt).trim()}\n\n[Content truncated by the extension]`
    : fullText;

  return {
    title: document.title || location.hostname,
    url: location.href,
    language: document.documentElement.lang || "unknown",
    content,
    truncated,
    originalLength: fullText.length,
    sourceType: "page"
  };

  function getSelectedText() {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT")) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      if (typeof start === "number" && typeof end === "number" && end > start) {
        return activeElement.value.slice(start, end);
      }
    }

    const selection = window.getSelection();
    return selection && !selection.isCollapsed ? selection.toString() : "";
  }

  function normalize(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\f\v ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}

function setBusy(isBusy) {
  elements.progressCard.hidden = !isBusy;
  elements.translateButton.disabled = isBusy;
  elements.summarizeButton.disabled = isBusy;
}

function updateProgress(title, detail) {
  elements.progressTitle.textContent = title;
  elements.progressDetail.textContent = detail;
}

function showResult(mode, page, output) {
  currentResultText = normalizeModelOutput(output);
  elements.resultMode.textContent = mode === "translate" ? "TRANSLATION" : "SUMMARY";
  const sourceLabel = page.sourceType === "selection" ? "選択範囲" : "ページ本文";
  elements.sourceMeta.textContent = `${sourceLabel} · ${page.title} · ${page.content.length.toLocaleString("ja-JP")}文字${page.truncated ? "（上限で省略）" : ""}`;
  renderMarkdown(elements.resultOutput, currentResultText);
  elements.resultCard.hidden = false;
  elements.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorCard.hidden = false;
}

function hideError() {
  elements.errorCard.hidden = true;
  elements.errorMessage.textContent = "";
}

function toUserMessage(error) {
  if (error.status === 401) {
    return "APIキーが無効です。設定画面でOpenAI APIキーを確認してください。";
  }
  if (error.status === 429) {
    return "OpenAI APIの利用上限に達したか、リクエストが集中しています。しばらく待ってからお試しください。";
  }
  if (error.status >= 500) {
    return "OpenAI APIで一時的な問題が発生しています。しばらく待ってからお試しください。";
  }
  return error.message || "予期しないエラーが発生しました。";
}

async function copyResult() {
  const text = elements.resultOutput.innerText.trim() || currentResultText;
  if (!text) {
    return;
  }
  await navigator.clipboard.writeText(text);
  elements.copyButton.textContent = "コピー済み";
  window.setTimeout(() => {
    elements.copyButton.textContent = "コピー";
  }, 1600);
}
