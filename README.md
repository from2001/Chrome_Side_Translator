# Side Translator

A Manifest V3 Chrome extension that opens in the browser side panel and uses the OpenAI Responses API to translate or summarize the main content of the current page in Japanese.

## Features

- Opens from the extension toolbar button in Chrome's side panel.
- Extracts likely article or main-page content while removing headers, footers, navigation, advertisements, forms, and similar chrome.
- Translates the extracted content into Japanese while preserving its structure.
- Summarizes the extracted content in Japanese with an overview and key points.
- Lets users customize the translation and summarization instructions from the settings page.
- Uses `gpt-5.4-nano` through the OpenAI Responses API.
- Stores the user-provided API key only in `chrome.storage.local`.
- Renders a safe Markdown subset with DOM APIs, without executing webpage or model-generated HTML.
- Requests access to HTTP and HTTPS pages so the persistent side panel continues to work after tab switches and navigation.

## Install for development

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository directory.
5. Pin **Side Translator** to the toolbar if desired.

Chrome 116 or newer is required.

## Configure

1. Click the extension toolbar button to open the side panel.
2. Open **API settings** from the gear button or the setup notice.
3. Paste an OpenAI API key and select **Save**.
4. Return to a normal `http` or `https` page and choose **Translate to Japanese** or **Summarize in Japanese**.

The extension sends only the extracted main text to `https://api.openai.com/v1/responses`. The page title and URL stay local and are used only for the result label. Avoid using it on pages containing confidential or sensitive information.

Chrome grants the extension access to HTTP and HTTPS pages so it can extract the current page even when the side panel was opened from Chrome's side-panel menu or kept open during navigation. The extension does not inject a persistent content script and only reads a page after the user selects translate or summarize.

## Privacy and API-key notes

The API key is stored in Chrome local extension storage, not sync storage. It is still client-side secret material: a person or program with sufficient access to the Chrome profile or extension runtime may be able to retrieve it. For a multi-user production deployment, route requests through an authenticated backend and keep the OpenAI API key on the server instead.

## Content extraction

The extractor scores semantic candidates such as `article`, `main`, and `[role="main"]`, considers text length and link density, removes common non-content elements, and sends at most 100,000 characters per request. Extraction is heuristic and can be imperfect on highly interactive applications or pages with unusual markup.

Chrome internal pages, the Chrome Web Store, local browser pages, and other restricted URLs cannot be inspected by extensions.

## Development

Run the dependency-free unit tests with:

```sh
npm test
```

After changing extension files, select **Reload** for Side Translator on `chrome://extensions`.
