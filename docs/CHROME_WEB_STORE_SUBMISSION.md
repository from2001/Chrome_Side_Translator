# Chrome Web Store Submission Guide

This document contains submission-ready copy and a release checklist for Side Translator. Replace every bracketed placeholder before submission.

## Store listing

### Product name

Side Translator

### Summary

Translate or summarize the main content of the current page in Japanese from Chrome's side panel.

### Detailed description

Side Translator helps you read web pages in Japanese without leaving the current tab.

Open the extension from the Chrome toolbar, then translate or summarize either the text you selected or the main content of the active page. Results appear in Chrome's side panel and can be copied as formatted text or Markdown.

Features:

- Translate selected text or the main page content into natural Japanese.
- Summarize content in Japanese with an overview and key points.
- Keep the side panel available while browsing between pages.
- Customize translation and summarization instructions.
- Safely render a limited Markdown subset without executing generated HTML.
- Store the user-provided OpenAI API key only in local Chrome extension storage.

An OpenAI API key with available API credit is required. Page text is sent to the OpenAI Responses API only after the user selects Translate or Summarize. The page title and URL remain local.

Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be read by extensions.

### Category

Productivity

### Language

Japanese

## Privacy tab declarations

### Single purpose

Translate or summarize user-selected text or the main content of the active web page in Japanese and display the result in Chrome's side panel.

### Permission justifications

`scripting`

> Required to extract the user's current text selection or the main readable text from the active page only when the user starts a translation or summary. The extension does not install a persistent content script.

`sidePanel`

> Required to display the translation and summary interface beside the current page and keep results visible while the user browses.

`storage`

> Required to store the user's OpenAI API key and custom translation and summarization instructions locally in Chrome. The data is not stored using Chrome Sync.

Host permissions for `http://*/*` and `https://*/*`

> Required to extract selected text or main page content after the user explicitly starts an operation, including when the persistent side panel remains open after tab changes or navigation. The extension does not continuously collect page content and does not inject a persistent content script.

### Remote code

Select **No, I am not using remote code**. All executable JavaScript is packaged with the extension. Requests to the OpenAI API exchange data and do not download or execute remote code.

### Data-use disclosure

Review the dashboard's current data categories and disclose at least the categories that cover:

- Website content: selected text or extracted main page text.
- Authentication information: the user-provided OpenAI API key.
- User-provided content: custom translation and summarization instructions, if the dashboard presents a matching category.

Declare that the data is used only for the extension's single purpose, is not sold, is not used for advertising or creditworthiness, and is transferred to OpenAI only to perform the user-requested API operation.

### Privacy policy URL

Publish `PRIVACY_POLICY.md` at a stable, publicly accessible HTTPS URL after replacing the publisher name and support email. Enter that public URL in the Privacy tab. A repository file that requires sign-in is not sufficient.

## Required and recommended visual assets

- Store icon: the packaged `assets/icons/icon-128.png` file.
- At least one 1280 x 800 screenshot of the extension in use, with up to five screenshots total.
- A YouTube video that demonstrates the extension's features.
- A 440 x 280 PNG or JPEG small promotional tile.
- A 1400 x 560 PNG or JPEG marquee promotional tile is optional.

Capture screenshots that show real extension behavior without exposing an API key, personal data, private browser tabs, or confidential page content.

## Test instructions for reviewers

> 1. Install the extension and click its toolbar icon to open the side panel.
> 2. Open API settings, enter a working OpenAI API key, and save it.
> 3. Open a normal HTTP or HTTPS article page.
> 4. Click Translate to Japanese or Summarize in Japanese.
> 5. Optionally select text on the page and repeat the operation to verify selection-only processing.
> The extension cannot run on Chrome internal pages or the Chrome Web Store. API usage may incur charges on the reviewer's OpenAI account.

If Chrome review requires access to a paid or credential-gated feature, provide a dedicated test credential through the dashboard's secure reviewer-instructions field. Do not put credentials in the public listing or the extension package.

## Release checklist

1. Replace the publisher name and support email in `PRIVACY_POLICY.md`.
2. Host the privacy policy at a stable public HTTPS URL.
3. Run `npm test`.
4. Run `npm run package`.
5. Load the generated ZIP as an unpacked extension after extracting it, and perform a final manual smoke test.
6. Confirm that the version in `manifest.json` has not already been uploaded.
7. Register and configure the Chrome Web Store developer account.
8. Upload the generated ZIP in the Chrome Web Store Developer Dashboard.
9. Complete the Store Listing, Privacy, Distribution, and Test Instructions sections.
10. Submit for review. Consider deferred publishing if the release timing matters.
