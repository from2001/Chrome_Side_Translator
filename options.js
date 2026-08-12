const API_KEY_STORAGE_KEY = "openaiApiKey";

const form = document.querySelector("#settings-form");
const apiKeyInput = document.querySelector("#api-key");
const toggleKeyButton = document.querySelector("#toggle-key");
const deleteKeyButton = document.querySelector("#delete-key");
const statusElement = document.querySelector("#settings-status");

initialize();

async function initialize() {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  apiKeyInput.value = stored[API_KEY_STORAGE_KEY] || "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showStatus("APIキーを入力してください。", true);
    return;
  }

  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: apiKey });
  showStatus("APIキーを保存しました。", false);
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
