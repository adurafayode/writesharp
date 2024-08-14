# WriteSharp

WriteSharp is your AI-powered intelligent writing companion, available as a Chrome extension. It enhances selected text on any webpage with a single click, helping you improve clarity and professionalism in your writing across various platforms.

## How It Works

* Select text on any webpage.
* Launch WriteSharp popup.
* View original and AI-refined text.
* Optionally revise or edit the refined text.
* Click `Insert` to replace the original text.

### WriteSharp in Action (Screenshot)

![WriteSharp improving text clarity](./src/public/images/writesharp-demo.png)

WriteSharp seamlessly integrates with your browser, allowing you to improve your writing with just a few clicks. As shown above, it transforms complex, wordy text into clear, concise language - perfect for emails, reports, or any written communication. By clicking `Insert`, the original text would be replaced with the improved version."

**Original Text**

```
The implementation of the aforementioned protocol necessitates a comprehensive understanding of the underlying mechanisms. 
It is imperative that all stakeholders involved in the process maintain a high level of cognizance regarding the potential ramifications of their actions. The successful execution of this initiative is contingent upon the synergistic collaboration of multiple departments within the organizational structure.
```

**Refined Text by GPT-4o**

```
Implementing this protocol requires a thorough understanding of its mechanisms. All stakeholders must be aware of the potential consequences of their actions. Successful execution depends on the collaborative efforts of various departments within the organization.
```

## Features and Benefits

* **Instant Text Enhancement**: Automatically improves selected text when the popup is launched, focusing on clarity and professionalism.
* **Flexible Editing**: View and compare original and refined text, with options to further revise or edit directly.
* **Easy Integration**: Seamlessly insert refined text back into your document with a single click.
* **Customizable AI**: Powered by OpenAI's GPT models, with options to use default or custom prompts.
* **Cost-Effective**: Pay only for what you use through OpenAI credits, avoiding recurring subscription fees.

## Installation

Currently, WriteSharp supports manual installation only. Follow these steps to set up the extension on your local machine:

1. **Clone the Repository**

```
git clone https://github.com/adurafayode/writesharp.git
cd writesharp
```

2. **Install Dependencies**

```
npm install
```

3. **Configure the Server**

* Open the project in your preferred code editor.
* Copy `.env.example` to `.env` and update the values as needed.
* Navigate to `server.js` in the root directory.
*  (Optional) The default port is set to 4000. If you wish to change the default, modify `PORT` in `.env`, `BACKEND_URL` in `src/background.js`, and `content_security_policy` in `manifest.json`.

4. **Start the Server**

```
node server.js
```

5. **Load the Extension in Chrome**

* Open Google Chrome and navigate to `chrome://extensions/`
* Enable "Developer mode" using the toggle in the top right corner.
* Click "Load unpacked" and select the `writesharp` directory you cloned in step 1.

6. **Verify Installation**

* You should now see the WriteSharp icon in your Chrome extensions toolbar.
* Click on the icon to open the popup and start using WriteSharp!

> Note: Make sure to keep the server running while using the extension. If you close the terminal or shut down your computer, you'll need to start the server again (step 4) to use WriteSharp.

### Troubleshooting

* If you encounter any issues with the extension not loading, try refreshing the `chrome://extensions/` page and reloading the unpacked extension.
* Ensure that your Node.js version is compatible with the project requirements.

## Configuration Options

### Default Prompts

WriteSharp uses two default prompts to guide the AI in enhancing your text:

1. **System Prompt:**

```You are WriteSharp, an AI that enhances text clarity and professionalism. Rephrase input text, maintaining original intent. Provide only the enhanced version.
```

2. **User Prompt:**

```Improve the following text with these guidelines:

- Simplify complex sentences
- Use precise, professional language
- Ensure consistent tone and improved flow
- Correct grammar and punctuation
- Adapt to professional contexts

Input text:
```

### Custom Prompts

1. Access the settings in the WriteSharp popup.
2. Enter your custom prompt in the provided textarea.
3. Toggle the "Use Custom Prompt" switch to activate your custom instructions.

> **Note on Custom Prompts:**
> The custom prompt feature modifies only the user prompt sent to the OpenAI model. For advanced customization, including changes to the system prompt, you can edit the `systemPrompt` variable in `server.js`. 

### API Key Configuration

1. Obtain an API key from OpenAI.
2. Open the WriteSharp popup and click on the "Settings" link.
3. Enter your API key in the designated field and click "Save API Key".

Your API key is securely stored using Chrome's storage sync API. This means your key will be available on any device where you're logged into Chrome with your Google account, ensuring a seamless experience across your devices.

> **Important:** Keep your API key confidential. Never share it publicly or with unauthorized individuals.

### AI Response Generation Settings

* The model's temperature is set to 0.7 to balance creativity and coherence. The GPT-4o model is used for its advanced capabilities. If you prefer different parameters, you can modify them in the `createChatCompletion` method in `server.js`.

## Limitations

* **Google Docs, PowerPoint, and Excel are not supported:** This extension currently does not support text selection or rephrasing functionalities in Google Docs, Microsoft PowerPoint, or Microsoft Excel. These platforms use custom rendering methods that are not compatible with standard DOM manipulation techniques.

## License

WriteSharp is open-source software licensed under the MIT License.

This means you are free to use, modify, and distribute this software, even for commercial purposes, provided you include the original copyright notice and license text. For more details, see the LICENSE file in this repository.