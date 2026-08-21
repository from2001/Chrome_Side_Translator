import { INSTRUCTION_STORAGE_KEYS, requestOpenAI } from "./lib/openai.js";
import { getCopyText, normalizeModelOutput, renderMarkdown } from "./lib/result-format.js";
import {
  HISTORY_STORAGE_KEY,
  addHistoryEntry,
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
  normalizeHistoryEntries
} from "./lib/history.js";

const API_KEY_STORAGE_KEY = "openaiApiKey";

const elements = {
  keyNotice: document.querySelector("#key-notice"),
  openHistoryButton: document.querySelector("#open-history"),
  closeHistoryButton: document.querySelector("#close-history"),
  clearHistoryButton: document.querySelector("#clear-history"),
  historyCard: document.querySelector("#history-card"),
  historyEmpty: document.querySelector("#history-empty"),
  historyList: document.querySelector("#history-list"),
  sourceIndicatorLabel: document.querySelector("#source-indicator-label"),
  pageActions: document.querySelector("#page-actions"),
  gmailActions: document.querySelector("#gmail-actions"),
  translateButton: document.querySelector("#translate-button"),
  summarizeButton: document.querySelector("#summarize-button"),
  gmailThreadSummaryButton: document.querySelector("#gmail-thread-summary-button"),
  gmailLatestSummaryButton: document.querySelector("#gmail-latest-summary-button"),
  gmailLatestTranslateButton: document.querySelector("#gmail-latest-translate-button"),
  gmailReplyButton: document.querySelector("#gmail-reply-button"),
  replyComposer: document.querySelector("#reply-composer"),
  replyNotes: document.querySelector("#reply-notes"),
  generateReplyButton: document.querySelector("#generate-reply-button"),
  cancelReplyButton: document.querySelector("#cancel-reply-button"),
  closeReplyComposerButton: document.querySelector("#close-reply-composer"),
  progressCard: document.querySelector("#progress-card"),
  progressTitle: document.querySelector("#progress-title"),
  progressDetail: document.querySelector("#progress-detail"),
  errorCard: document.querySelector("#error-card"),
  errorMessage: document.querySelector("#error-message"),
  resultCard: document.querySelector("#result-card"),
  resultMode: document.querySelector("#result-mode"),
  resultTitle: document.querySelector("#result-title"),
  sourceMeta: document.querySelector("#source-meta"),
  resultOutput: document.querySelector("#result-output"),
  copyMenus: Array.from(document.querySelectorAll(".copy-menu")),
  copyMenuTriggers: Array.from(document.querySelectorAll(".copy-menu > summary")),
  copyButtons: Array.from(document.querySelectorAll("[data-copy-format]"))
};

let activeController = null;
let currentResultText = "";
let sourceRefreshSequence = 0;
let copyFeedbackTimer = null;
let currentSourceState = { selectionLength: 0, isGmail: false, hasGmailThread: false };
let isBusy = false;
let historyEntries = [];

initialize();

async function initialize() {
  await Promise.all([refreshKeyState(), refreshSourceIndicator(), refreshHistory()]);

  document.querySelectorAll("#open-settings, #notice-settings, #footer-settings")
    .forEach((button) => button.addEventListener("click", () => chrome.runtime.openOptionsPage()));

  elements.openHistoryButton.addEventListener("click", toggleHistory);
  elements.closeHistoryButton.addEventListener("click", closeHistory);
  elements.clearHistoryButton.addEventListener("click", handleClearHistory);

  elements.translateButton.addEventListener("click", () => processPage("translate"));
  elements.summarizeButton.addEventListener("click", () => processPage("summarize"));
  elements.gmailThreadSummaryButton.addEventListener("click", () => processPage("summarize", "thread"));
  elements.gmailLatestSummaryButton.addEventListener("click", () => processPage("summarize", "latest"));
  elements.gmailLatestTranslateButton.addEventListener("click", () => processPage("translate", "latest"));
  elements.gmailReplyButton.addEventListener("click", openReplyComposer);
  elements.generateReplyButton.addEventListener("click", generateReplyDraft);
  elements.cancelReplyButton.addEventListener("click", closeReplyComposer);
  elements.closeReplyComposerButton.addEventListener("click", closeReplyComposer);
  elements.copyButtons.forEach((button) => {
    button.addEventListener("click", () => copyResult(button.dataset.copyFormat));
  });
  document.addEventListener("click", (event) => {
    elements.copyMenus.forEach((menu) => {
      if (!menu.contains(event.target)) {
        menu.open = false;
      }
    });
  });
  document.addEventListener("keydown", (event) => {
    const openMenu = elements.copyMenus.find((menu) => menu.open);
    if (event.key === "Escape" && openMenu) {
      openMenu.open = false;
      openMenu.querySelector("summary").focus();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[API_KEY_STORAGE_KEY]) {
      refreshKeyState();
    }
    if (areaName === "local" && changes[HISTORY_STORAGE_KEY]) {
      historyEntries = normalizeHistoryEntries(changes[HISTORY_STORAGE_KEY].newValue);
      renderHistory();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "selection-state-changed") {
      refreshSourceIndicator();
    }
  });

  chrome.tabs.onActivated.addListener(refreshSourceIndicator);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      refreshSourceIndicator();
    }
  });
  window.addEventListener("focus", refreshSourceIndicator);
}

async function refreshHistory() {
  try {
    historyEntries = await loadHistory(chrome.storage.local);
  } catch {
    historyEntries = [];
  }
  renderHistory();
}

function toggleHistory() {
  if (elements.historyCard.hidden) {
    elements.historyCard.hidden = false;
    elements.openHistoryButton.setAttribute("aria-expanded", "true");
    elements.historyCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    closeHistory();
  }
}

function closeHistory() {
  elements.historyCard.hidden = true;
  elements.openHistoryButton.setAttribute("aria-expanded", "false");
}

function renderHistory() {
  elements.historyList.replaceChildren();
  elements.historyEmpty.hidden = historyEntries.length > 0;
  elements.clearHistoryButton.hidden = historyEntries.length === 0;

  historyEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const openButton = document.createElement("button");
    openButton.className = "history-open-button";
    openButton.type = "button";
    openButton.addEventListener("click", () => openHistoryEntry(entry));

    const label = document.createElement("span");
    label.className = "history-item-label";
    label.textContent = `${formatHistoryDate(entry.createdAt)}: ${entry.title}`;
    label.title = label.textContent;
    openButton.append(label);

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `${entry.title}を履歴から削除`);
    deleteButton.addEventListener("click", () => handleDeleteHistory(entry.id));

    item.append(openButton, deleteButton);
    elements.historyList.append(item);
  });
}

function openHistoryEntry(entry) {
  hideError();
  renderResult({
    mode: entry.mode,
    output: entry.output,
    sourceMeta: buildSourceMeta(entry)
  });
  closeHistory();
}

async function handleDeleteHistory(id) {
  try {
    historyEntries = await deleteHistoryEntry(chrome.storage.local, id);
    renderHistory();
    hideError();
  } catch {
    showError("履歴を削除できませんでした。もう一度お試しください。");
  }
}

async function handleClearHistory() {
  if (!window.confirm("保存されている履歴をすべて削除しますか？")) {
    return;
  }

  try {
    historyEntries = await clearHistory(chrome.storage.local);
    renderHistory();
    hideError();
  } catch {
    showError("履歴を削除できませんでした。もう一度お試しください。");
  }
}

function formatHistoryDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function refreshSourceIndicator() {
  const sequence = ++sourceRefreshSequence;
  let sourceState = { selectionLength: 0, isGmail: false, hasGmailThread: false };

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && /^https?:\/\//i.test(tab.url || "")) {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: inspectSelectionOnPage
      });
      if (injection && injection.result) {
        sourceState = injection.result;
      }
    }
  } catch {
    sourceState = { selectionLength: 0, isGmail: false, hasGmailThread: false };
  }

  if (sequence !== sourceRefreshSequence) {
    return;
  }

  currentSourceState = sourceState;
  renderSourceActions();
}

function inspectSelectionOnPage() {
  const monitorKey = "__sideTranslatorSourceMonitorV2";

  const getSourceState = () => {
    const selectedText = getSelectedText().trim();
    const isGmail = location.hostname === "mail.google.com";
    const hasSubject = Boolean(document.querySelector("h2.hP"));
    const hasMessage = Boolean(document.querySelector(".a3s, [data-message-id], [data-legacy-message-id]"));
    return {
      selectionLength: selectedText.length,
      isGmail,
      hasGmailThread: isGmail && hasSubject && hasMessage
    };
  };

  if (!globalThis[monitorKey]) {
    const monitor = { stateKey: JSON.stringify(getSourceState()) };
    globalThis[monitorKey] = monitor;
    let reportScheduled = false;

    const scheduleReport = () => {
      if (reportScheduled) {
        return;
      }

      reportScheduled = true;
      window.requestAnimationFrame(() => {
        reportScheduled = false;
        const stateKey = JSON.stringify(getSourceState());
        if (stateKey !== monitor.stateKey) {
          monitor.stateKey = stateKey;
          chrome.runtime.sendMessage({ type: "selection-state-changed" }).catch(() => {});
        }
      });
    };

    document.addEventListener("selectionchange", scheduleReport);
    document.addEventListener("select", scheduleReport, true);
    if (document.body) {
      new MutationObserver(scheduleReport).observe(document.body, { childList: true, subtree: true });
    }
  }

  return getSourceState();

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
}

async function refreshKeyState() {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  const hasKey = Boolean(stored[API_KEY_STORAGE_KEY]);
  elements.keyNotice.hidden = hasKey;
  return stored[API_KEY_STORAGE_KEY] || "";
}

function renderSourceActions() {
  const hasSelection = currentSourceState.selectionLength > 0;
  const showGmailActions = currentSourceState.isGmail && !hasSelection;

  elements.pageActions.hidden = showGmailActions;
  elements.gmailActions.hidden = !showGmailActions;
  document.body.classList.toggle("gmail-actions-visible", showGmailActions);
  if (!showGmailActions || !currentSourceState.hasGmailThread) {
    closeReplyComposer();
  }

  if (hasSelection) {
    elements.sourceIndicatorLabel.textContent = `選択範囲を処理します ${currentSourceState.selectionLength.toLocaleString("ja-JP")}文字を選択中`;
  } else if (showGmailActions && currentSourceState.hasGmailThread) {
    elements.sourceIndicatorLabel.textContent = "表示中のGmailスレッドを処理します";
  } else if (showGmailActions) {
    elements.sourceIndicatorLabel.textContent = "処理するメールスレッドを開いてください";
  } else {
    elements.sourceIndicatorLabel.textContent = "ページ本文を処理します";
  }

  updateActionAvailability();
}

function updateActionAvailability() {
  elements.openHistoryButton.disabled = isBusy;
  elements.translateButton.disabled = isBusy;
  elements.summarizeButton.disabled = isBusy;
  const gmailDisabled = isBusy || !currentSourceState.hasGmailThread;
  elements.gmailThreadSummaryButton.disabled = gmailDisabled;
  elements.gmailLatestSummaryButton.disabled = gmailDisabled;
  elements.gmailLatestTranslateButton.disabled = gmailDisabled;
  elements.gmailReplyButton.disabled = gmailDisabled;
  elements.generateReplyButton.disabled = isBusy;
  elements.cancelReplyButton.disabled = isBusy;
  elements.closeReplyComposerButton.disabled = isBusy;
}

function openReplyComposer() {
  if (!currentSourceState.hasGmailThread || isBusy) {
    return;
  }
  hideError();
  elements.replyComposer.hidden = false;
  elements.replyNotes.focus();
  elements.replyComposer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeReplyComposer() {
  if (isBusy) {
    return;
  }
  elements.replyComposer.hidden = true;
}

async function generateReplyDraft() {
  const replyNotes = elements.replyNotes.value.trim();
  if (!replyNotes) {
    showError("返信で伝えたい内容を入力してください。");
    elements.replyNotes.focus();
    return;
  }
  await processPage("reply", "thread", replyNotes);
}

async function processPage(mode, gmailScope = null, replyNotes = "") {
  if (activeController) {
    activeController.abort();
  }

  const apiKey = await refreshKeyState();
  if (!apiKey) {
    showError("先にOpenAI APIキーを設定してください。");
    return;
  }

  activeController = new AbortController();
  closeHistory();
  setBusy(true);
  hideError();
  elements.resultCard.hidden = true;
  const extractionDetail = mode === "reply"
    ? "メールスレッド全体を展開して、返信案に必要な文脈を解析中です。"
    : gmailScope === "thread"
    ? "メールスレッドを展開して、すべてのメールを解析中です。"
    : gmailScope === "latest"
      ? "メールスレッドを展開して、最新のメールを解析中です。"
      : "選択範囲またはページのメインコンテンツを解析中です。";
  updateProgress("テキストを抽出しています", extractionDetail);

  try {
    const page = await extractCurrentPage(gmailScope);
    if (!page.content || (page.sourceType !== "selection" && page.content.length < 40)) {
      throw new Error("このページから十分な本文を抽出できませんでした。");
    }
    if (mode === "reply") {
      page.replyNotes = replyNotes;
    }

    const sourceLabel = getSourceLabel(page.sourceType);
    updateProgress(
      mode === "translate"
        ? "日本語に翻訳しています"
        : mode === "reply"
          ? "返信案を作成しています"
          : "日本語で要約しています",
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

    const normalizedOutput = showResult(mode, page, output);
    try {
      historyEntries = await addHistoryEntry(chrome.storage.local, {
        mode,
        page,
        output: normalizedOutput
      });
      renderHistory();
    } catch {
      showError("結果は表示しましたが、履歴を保存できませんでした。");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      showError(toUserMessage(error));
    }
  } finally {
    activeController = null;
    setBusy(false);
  }
}

async function extractCurrentPage(gmailScope = null) {
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
    const injectionOptions = gmailScope
      ? {
          target: { tabId: tab.id },
          func: extractGmailContentFromPage,
          args: [gmailScope]
        }
      : {
          target: { tabId: tab.id },
          func: extractMainContentFromPage
        };
    [injection] = await chrome.scripting.executeScript(injectionOptions);
  } catch (error) {
    if (/cannot access|cannot be scripted|missing host permission|extensions gallery/i.test(error.message)) {
      throw new Error("Chromeによりこのページへのアクセスが制限されています。通常のWebページでお試しください。");
    }
    throw new Error(`ページ本文を読み取れませんでした。ページを再読み込みしてお試しください。 (${error.message})`);
  }

  if (!injection || !injection.result) {
    throw new Error("ページ本文を読み取れませんでした。");
  }

  if (injection.result.error) {
    throw new Error(injection.result.error);
  }

  return injection.result;
}

async function extractGmailContentFromPage(scope) {
  const MAX_CHARACTERS = 100000;

  if (!document.body || location.hostname !== "mail.google.com") {
    return { error: "Gmailを開いてから、もう一度お試しください。" };
  }

  const selectedText = normalize(getSelectedText());
  if (selectedText) {
    return buildResult(selectedText, "selection", document.title || "Gmail", 0);
  }

  const initialMessageBodies = findMessageBodies();
  const subjectElement = document.querySelector("h2.hP");
  if (!subjectElement || initialMessageBodies.length === 0) {
    return { error: "処理するメールスレッドをGmailで開いてください。" };
  }

  let expandAllControl = findControl((label) => /^(すべて展開|expand all)$/i.test(label));
  if (!expandAllControl) {
    const oldMessagesControl = findControl((label) => (
      /古いメールが\s*\d+\s*件あります/.test(label)
      || /\d+\s+older messages?/i.test(label)
    ));
    if (oldMessagesControl) {
      oldMessagesControl.click();
      await waitForConversationToSettle();
      expandAllControl = findControl((label) => /^(すべて展開|expand all)$/i.test(label));
    }
  }
  if (expandAllControl) {
    expandAllControl.click();
    await waitForConversationToSettle();
  }

  const messages = findMessageBodies()
    .map((body) => extractMessage(body))
    .filter((message) => message.body);

  if (messages.length === 0) {
    return { error: "メール本文を取得できませんでした。Gmailを再読み込みしてお試しください。" };
  }

  const selectedMessages = scope === "latest" ? messages.slice(-1) : messages;
  const subject = normalize(subjectElement.textContent) || document.title || "Gmail";
  const content = [
    `# ${subject}`,
    ...selectedMessages.map((message, index) => formatMessage(message, scope === "latest" ? messages.length : index + 1))
  ].join("\n\n");

  return buildResult(
    content,
    scope === "latest" ? "gmail-latest" : "gmail-thread",
    subject,
    selectedMessages.length
  );

  function findControl(matches) {
    return Array.from(document.querySelectorAll("button, [role='button']"))
      .find((element) => {
        if (!isVisible(element)) {
          return false;
        }
        const labels = [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("data-tooltip"),
          element.textContent
        ].filter(Boolean).map(normalize);
        return labels.some(matches);
      });
  }

  function findMessageBodies() {
    const seenContainers = new Set();
    return Array.from(document.querySelectorAll(".a3s.aiL, .a3s"))
      .filter(isVisible)
      .filter((body) => {
        const container = getMessageContainer(body);
        if (seenContainers.has(container)) {
          return false;
        }
        seenContainers.add(container);
        return true;
      });
  }

  function getMessageContainer(body) {
    return body.closest(".adn.ads, .adn, [data-message-id], [data-legacy-message-id]") || body.parentElement || body;
  }

  function extractMessage(body) {
    const container = getMessageContainer(body);
    const senderElement = container.querySelector(".gD[email], .gD, [email][data-hovercard-id], [email]");
    const senderName = senderElement ? normalize(senderElement.textContent) : "";
    const senderEmail = senderElement ? normalize(senderElement.getAttribute("email")) : "";
    const sender = senderName && senderEmail && senderName !== senderEmail
      ? `${senderName} <${senderEmail}>`
      : senderName || senderEmail;
    const recipientsElement = container.querySelector(".hb");
    const dateElement = container.querySelector(".g3[title], .g3");
    const attachmentNames = Array.from(container.querySelectorAll(".aV3"))
      .map((element) => normalize(element.textContent))
      .filter(Boolean);

    return {
      sender,
      recipients: recipientsElement ? normalize(recipientsElement.textContent) : "",
      date: dateElement ? normalize(dateElement.getAttribute("title") || dateElement.textContent) : "",
      attachments: [...new Set(attachmentNames)],
      body: extractBodyText(body)
    };
  }

  function extractBodyText(body) {
    const clone = body.cloneNode(true);
    const sourceElements = Array.from(body.querySelectorAll("*"));
    const clonedElements = Array.from(clone.querySelectorAll("*"));
    sourceElements.forEach((sourceElement, index) => {
      if (!isVisible(sourceElement) && clonedElements[index]) {
        clonedElements[index].remove();
      }
    });
    clone.querySelectorAll([
      "script", "style", "button", "form", "dialog", "svg", "canvas",
      ".gmail_quote", ".gmail_extra", "blockquote[type='cite']", "[aria-hidden='true']"
    ].join(",")).forEach((element) => element.remove());
    clone.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
    clone.querySelectorAll("p, div, section, article, li, blockquote, pre, tr")
      .forEach((element) => element.append("\n"));
    return normalize(clone.textContent);
  }

  function formatMessage(message, number) {
    const metadata = [
      `From: ${message.sender || "不明"}`,
      message.recipients ? `To: ${message.recipients}` : "",
      message.date ? `Date: ${message.date}` : ""
    ].filter(Boolean).join("\n");
    const attachments = message.attachments.length > 0
      ? `\n\nAttachments:\n${message.attachments.map((name) => `- ${name}`).join("\n")}`
      : "";
    return `## Email ${number}\n${metadata}\n\n${message.body}${attachments}`;
  }

  function buildResult(value, sourceType, title, messageCount) {
    const fullText = normalize(value);
    const boundary = fullText.lastIndexOf("\n", MAX_CHARACTERS);
    const cutAt = boundary >= MAX_CHARACTERS * 0.8 ? boundary : MAX_CHARACTERS;
    const truncated = fullText.length > MAX_CHARACTERS;
    return {
      title,
      url: location.href,
      language: document.documentElement.lang || "unknown",
      content: truncated
        ? `${fullText.slice(0, cutAt).trim()}\n\n[Content truncated by the extension]`
        : fullText,
      truncated,
      originalLength: fullText.length,
      sourceType,
      messageCount
    };
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }
    for (let current = element; current && current !== document.body; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") {
        return false;
      }
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }
    return true;
  }

  function waitForConversationToSettle() {
    return new Promise((resolve) => {
      let idleTimer;
      let maximumTimer;
      const finish = () => {
        window.clearTimeout(idleTimer);
        window.clearTimeout(maximumTimer);
        observer.disconnect();
        resolve();
      };
      const scheduleFinish = () => {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(finish, 350);
      };
      const observer = new MutationObserver(scheduleFinish);
      observer.observe(document.body, { childList: true, subtree: true });
      maximumTimer = window.setTimeout(finish, 5000);
      scheduleFinish();
    });
  }

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

function setBusy(busy) {
  isBusy = busy;
  elements.progressCard.hidden = !busy;
  updateActionAvailability();
}

function updateProgress(title, detail) {
  elements.progressTitle.textContent = title;
  elements.progressDetail.textContent = detail;
}

function showResult(mode, page, output) {
  const normalizedOutput = normalizeModelOutput(output);
  renderResult({
    mode,
    output: normalizedOutput,
    sourceMeta: buildSourceMeta(page)
  });
  return normalizedOutput;
}

function renderResult({ mode, output, sourceMeta }) {
  currentResultText = output;
  window.clearTimeout(copyFeedbackTimer);
  elements.copyMenus.forEach((menu) => {
    menu.open = false;
  });
  elements.copyMenuTriggers.forEach((trigger) => {
    trigger.textContent = "コピー";
  });
  const presentation = getModePresentation(mode);
  elements.resultMode.textContent = presentation.kicker;
  elements.resultTitle.textContent = presentation.title;
  elements.sourceMeta.textContent = sourceMeta;
  renderMarkdown(elements.resultOutput, currentResultText);
  elements.resultCard.hidden = false;
  elements.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getModePresentation(mode) {
  if (mode === "translate") {
    return { kicker: "TRANSLATION", title: "翻訳結果" };
  }
  if (mode === "reply") {
    return { kicker: "REPLY DRAFT", title: "返信案" };
  }
  return { kicker: "SUMMARY", title: "要約結果" };
}

function buildSourceMeta(source) {
  const sourceLabel = getSourceLabel(source.sourceType);
  const messageCount = source.messageCount ? ` · ${source.messageCount.toLocaleString("ja-JP")}通` : "";
  const sourceLength = source.sourceLength || (source.content ? source.content.length : 0);
  return `${sourceLabel} · ${source.title}${messageCount} · ${sourceLength.toLocaleString("ja-JP")}文字${source.truncated ? "（上限で省略）" : ""}`;
}

function getSourceLabel(sourceType) {
  if (sourceType === "selection") {
    return "選択範囲";
  }
  if (sourceType === "gmail-thread") {
    return "メールスレッド全体";
  }
  if (sourceType === "gmail-latest") {
    return "最新のメール";
  }
  return "ページ本文";
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

async function copyResult(format) {
  const text = getCopyText(format, elements.resultOutput.innerText, currentResultText);
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    elements.copyMenus.forEach((menu) => {
      menu.open = false;
    });
    elements.copyMenuTriggers.forEach((trigger) => {
      trigger.textContent = "コピー済み";
    });
    window.clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = window.setTimeout(() => {
      elements.copyMenuTriggers.forEach((trigger) => {
        trigger.textContent = "コピー";
      });
    }, 1600);
  } catch {
    elements.copyMenus.forEach((menu) => {
      menu.open = false;
    });
    showError("クリップボードへコピーできませんでした。もう一度お試しください。");
  }
}
