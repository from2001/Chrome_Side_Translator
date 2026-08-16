import { DEFAULT_INSTRUCTIONS, INSTRUCTION_STORAGE_KEYS } from "./lib/openai.js";

const API_KEY_STORAGE_KEY = "openaiApiKey";

const form = document.querySelector("#settings-form");
const apiKeyInput = document.querySelector("#api-key");
const toggleKeyButton = document.querySelector("#toggle-key");
const deleteKeyButton = document.querySelector("#delete-key");
const translateInstructionInput = document.querySelector("#translate-instruction");
const summarizeInstructionInput = document.querySelector("#summarize-instruction");
const replyInstructionInput = document.querySelector("#reply-instruction");
const resetInstructionsButton = document.querySelector("#reset-instructions");
const statusElement = document.querySelector("#settings-status");

initialize();

async function initialize() {
  const stored = await chrome.storage.local.get([
    API_KEY_STORAGE_KEY,
    INSTRUCTION_STORAGE_KEYS.translate,
    INSTRUCTION_STORAGE_KEYS.summarize,
    INSTRUCTION_STORAGE_KEYS.reply
  ]);
  apiKeyInput.value = stored[API_KEY_STORAGE_KEY] || "";
  translateInstructionInput.value = stored[INSTRUCTION_STORAGE_KEYS.translate] || DEFAULT_INSTRUCTIONS.translate;
  summarizeInstructionInput.value = stored[INSTRUCTION_STORAGE_KEYS.summarize] || DEFAULT_INSTRUCTIONS.summarize;
  replyInstructionInput.value = stored[INSTRUCTION_STORAGE_KEYS.reply] || DEFAULT_INSTRUCTIONS.reply;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiKey = apiKeyInput.value.trim();
  const translateInstruction = translateInstructionInput.value.trim();
  const summarizeInstruction = summarizeInstructionInput.value.trim();
  const replyInstruction = replyInstructionInput.value.trim();
  if (!translateInstruction || !summarizeInstruction || !replyInstruction) {
    showStatus("翻訳用、要約用、返信案作成用のInstructionを入力してください。", true);
    return;
  }

  const settings = {
    [INSTRUCTION_STORAGE_KEYS.translate]: translateInstruction,
    [INSTRUCTION_STORAGE_KEYS.summarize]: summarizeInstruction,
    [INSTRUCTION_STORAGE_KEYS.reply]: replyInstruction
  };
  if (apiKey) {
    settings[API_KEY_STORAGE_KEY] = apiKey;
  }

  await chrome.storage.local.set(settings);
  showStatus(apiKey ? "APIキーとInstructionを保存しました。" : "Instructionを保存しました。", false);
});

resetInstructionsButton.addEventListener("click", () => {
  translateInstructionInput.value = DEFAULT_INSTRUCTIONS.translate;
  summarizeInstructionInput.value = DEFAULT_INSTRUCTIONS.summarize;
  replyInstructionInput.value = DEFAULT_INSTRUCTIONS.reply;
  showStatus("Instructionを既定値に戻しました。保存すると反映されます。", false);
});

toggleKeyButton.addEventListener("click", () => {
  const shouldShow = apiKeyInput.type === "password";
  apiKeyInput.type = shouldShow ? "text" : "password";
  toggleKeyButton.textContent = shouldShow ? "隠す" : "表示";
  toggleKeyButton.setAttribute("aria-label", shouldShow ? "APIキーを隠す" : "APIキーを表示");
});

deleteKeyButton.addEventListener("click", async () => {
  await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
  apiKeyInput.value = "";
  showStatus("保存したAPIキーを削除しました。", false);
});

function showStatus(message, isError) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-error", isError);
}
