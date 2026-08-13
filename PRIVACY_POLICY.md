# Privacy Policy for Side Translator

Last updated: August 14, 2026

Side Translator is a Chrome extension that translates or summarizes text from the active web page in Japanese by using the OpenAI API.

## Data the extension handles

The extension handles the following data only to provide its translation and summarization features:

- Text selected by the user, or the main text extracted from the active web page.
- An OpenAI API key supplied by the user.
- Custom translation and summarization instructions supplied by the user.

The page title and URL may be displayed locally in the extension interface, but they are not included in requests to the OpenAI API.

## How data is used and shared

When the user explicitly starts a translation or summary, the selected or extracted page text and the applicable instruction are sent directly from the extension to the OpenAI Responses API. The user's OpenAI API key is sent to OpenAI as authentication for that request.

The publisher does not operate an intermediary server for these requests and does not receive, sell, rent, or use this data for advertising, credit decisions, or unrelated purposes. OpenAI processes API requests under its own applicable terms and privacy practices.

The extension's use and transfer of information received from Google APIs complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used and transferred only as necessary to provide the extension's user-facing translation and summarization features. It is not used for personalized advertising, profiling, or unrelated analytics, and is not made available for humans to read except when required for security, legal compliance, or with the user's affirmative agreement.

## Local storage and retention

The OpenAI API key and custom instructions are stored locally in the user's Chrome extension storage. They are not synchronized through Chrome. The publisher does not retain copies of this locally stored data.

Users can delete the saved API key from the extension's settings page. Users can remove all extension data by uninstalling the extension or clearing its stored data in Chrome.

## Website access

The extension requests access to HTTP and HTTPS pages so it can read the active page after the user chooses to translate or summarize it, including when the side panel remains open while the user changes tabs or navigates. It does not continuously transmit page contents and does not send page text until the user explicitly starts an operation.

## Security

Data sent to OpenAI is transmitted over HTTPS. The API key remains client-side secret material; a person or program with sufficient access to the user's Chrome profile or extension runtime may be able to retrieve it.

## Changes

Material changes to this policy will be published at the same public URL and reflected by an updated date.

## Contact

Publisher: **from2001**

Contact: [GitHub Issues](https://github.com/from2001/Chrome_Side_Translator/issues)
