# Chrome Web Store Submission Guide

This document records the Chrome Web Store release process and contains submission-ready copy for Side Translator.

## Links

- Chrome Web Store: https://chromewebstore.google.com/detail/side-translator/cnabgahfhpibcaohplkmgmidppkkklgg
- GitHub repository: https://github.com/from2001/Chrome_Side_Translator
- Public privacy policy: https://from2001.github.io/Chrome_Side_Translator/PRIVACY_POLICY.html
- Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Store item ID: `cnabgahfhpibcaohplkmgmidppkkklgg`

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
- Summarize or translate Gmail conversations and create copyable reply drafts from user instructions.
- Keep the side panel available while browsing between pages.
- Customize translation, summarization, and reply-drafting instructions.
- Reopen, copy, or delete up to 50 recent results stored locally on the device.
- Safely render a limited Markdown subset without executing generated HTML.
- Store the user-provided OpenAI API key only in local Chrome extension storage.

An OpenAI API key with available API credit is required. Page or Gmail conversation text is sent to the OpenAI Responses API only after the user starts an operation. Reply requirements are also sent when creating a reply draft. The page title and URL remain local.

Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be read by extensions.

### Category

Productivity

### Language

Japanese

## Privacy tab declarations

### Single purpose

Translate or summarize user-selected text, the main content of the active web page, or a Gmail conversation in Japanese, and create copyable Gmail reply drafts from user instructions. Display the result in Chrome's side panel without sending email.

### Permission justifications

`scripting`

> Required to extract the user's current text selection or the main readable text from the active page only when the user starts a translation or summary. The extension does not install a persistent content script.

`sidePanel`

> Required to display the translation and summary interface beside the current page and keep results visible while the user browses.

`storage`

> Required to store the user's OpenAI API key, custom instructions, and up to 50 recent results with page titles and display metadata locally in Chrome. Result history does not retain source text, page URLs, or reply requirements. The data is not stored using Chrome Sync.

Host permissions for `http://*/*` and `https://*/*`

> Required to extract selected text or main page content after the user explicitly starts an operation, including when the persistent side panel remains open after tab changes or navigation. The extension does not continuously collect page content and does not inject a persistent content script.

### Remote code

Select **No, I am not using remote code**. All executable JavaScript is packaged with the extension. Requests to the OpenAI API exchange data and do not download or execute remote code.

### Data-use disclosure

Review the dashboard's current data categories and disclose at least the categories that cover:

- Website content: selected text or extracted main page text.
- Authentication information: the user-provided OpenAI API key.
- Personal communications: Gmail message bodies and available message metadata used by the Gmail actions.
- User-provided content: custom instructions and Gmail reply requirements, if the dashboard presents a matching category.
- Locally retained result history: generated results, page titles, operation types, timestamps, and display metadata.

Declare that the data is used only for the extension's single purpose, is not sold, is not used for advertising or creditworthiness, and is transferred to OpenAI only to perform the user-requested API operation.

### Privacy policy URL

Use https://from2001.github.io/Chrome_Side_Translator/PRIVACY_POLICY.html in the Privacy tab. Verify it without a signed-in browser before every submission. A repository file URL is not a substitute for the public policy page.

## Store and repository links

- Set the Store Listing **Homepage URL** to `https://github.com/from2001/Chrome_Side_Translator`.
- Keep `homepage_url` in `manifest.json` set to the same GitHub URL.
- Keep the Chrome Web Store link near the top of `README.md`.
- Set the GitHub repository **Website** field to the Chrome Web Store URL.

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
> 6. Optionally open a Gmail conversation to verify the Gmail summary, translation, and reply-draft actions. The reply-draft action produces copyable text and does not send an email. Attachment contents are not read.
> The extension cannot run on Chrome internal pages or the Chrome Web Store. API usage may incur charges on the reviewer's OpenAI account.

If Chrome review requires access to a paid or credential-gated feature, provide a dedicated test credential through the dashboard's secure reviewer-instructions field. Do not put credentials in the public listing or the extension package.

## Release procedure

1. Confirm that `main` contains only the changes intended for the release and that the working tree is clean.
2. Increment the version in both `manifest.json` and `package.json`. Chrome Web Store rejects a version that has already been uploaded.
3. Update this document, `README.md`, and `PRIVACY_POLICY.md` when features or data handling have changed.
4. Run the automated checks:

   ```sh
   npm test
   npm run package
   unzip -t dist/side-translator-<version>.zip
   sh -n scripts/package-extension.sh
   git diff --check
   ```

5. Extract the generated ZIP, load the extracted directory from `chrome://extensions`, and perform a final smoke test. Do not load the ZIP itself as an unpacked extension.
6. Verify that the public privacy policy returns HTTP 200 in a signed-out request and contains the current policy text.
7. Open the Developer Dashboard linked above, select the item ID recorded in this document, and confirm the currently published version and any outstanding review state.
8. In **Package**, upload `dist/side-translator-<version>.zip`.
9. In **Store Listing**, update the description and screenshots when features have changed, and set the Homepage URL to the GitHub repository.
10. In **Privacy**, reconcile the disclosure, permission justifications, and privacy-policy URL with the packaged code.
11. Review **Distribution** and **Test Instructions**, then save the draft.
12. Keep automatic publishing disabled unless immediate publication after approval is explicitly intended.
13. Submit the draft for review. Uploading a package and submitting it for review are separate actions.
14. After approval, publish manually if automatic publishing was disabled.
15. Verify the public Store page version, GitHub link, description, and install flow in a signed-out browser.

Record the submitted version, ZIP filename, submission date, review state, and publication result in the pull request or release notes. A dashboard state of **Pending review** is not proof that the update is published.

## Official references

- [Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update/)
- [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
- [Manifest `homepage_url`](https://developer.chrome.com/docs/extensions/reference/manifest/homepage-url/)
