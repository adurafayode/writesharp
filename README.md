# WriteSharp

WriteSharp is your intelligent writing companion, available as a Chrome extension. It enhances selected text on any webpage with a single click, helping you communicate more effectively across various platforms.

## Features and Benefits

* Instant Text Enhancement: Automatically improves selected text when the popup is launched, focusing on clarity and professionalism.
* Flexible Editing: View and compare original and refined text, with options to further revise or edit directly.
* Easy Integration: Seamlessly insert refined text back into your document with a single click.
* Customizable AI: Powered by OpenAI's GPT models, with options to use default or custom prompts.
* Cost-Effective: Pay only for what you use through OpenAI credits, avoiding recurring subscription fees.

## How It Works

* Select text on any webpage.
* Launch WriteSharp popup.
* View original and AI-refined text.
* Optionally revise or edit the refined text.
* Click 'Insert' to replace the original text.

## Configuration Options

### Default Prompts

WriteSharp uses two default prompts to guide the AI in enhancing your text:

1. System Prompt:

```You are WriteSharp, an AI that enhances text clarity and professionalism.
Rephrase input text, maintaining original intent. Provide only the enhanced version.```

2. User Prompt:

```Improve the following text with these guidelines:
- Simplify complex sentences
- Use precise, professional language
- Ensure consistent tone and improved flow
- Correct grammar and punctuation
- Adapt to professional contexts

Input text:```

### Custom Prompts

1. Access the settings in the WriteSharp popup.
2. Enter your custom prompt in the provided textarea.
3. Toggle the "Use Custom Prompt" switch to activate your custom instructions.

> **Note on Custom Prompts:**
> The custom prompt feature modifies only the user prompt sent to the OpenAI model. For advanced customization, including changes to the system prompt, you can edit line 72 in the server.js file of your forked instance.

### API Key Configuration

1. Obtain an API key from OpenAI.
2. Open the WriteSharp popup and click on the "Settings" link.
3. Enter your API key in the designated field and click "Save API Key".

Your API key is securely stored using Chrome's storage sync API. This means your key will be available on any device where you're logged into Chrome with your Google account, ensuring a seamless experience across your devices.

> **Important:** Keep your API key confidential. Never share it publicly or with unauthorized individuals.



