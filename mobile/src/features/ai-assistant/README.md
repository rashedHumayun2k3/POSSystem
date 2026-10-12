# Bangla chat POC

## Feature structure

All assistant-specific code lives in `src/features/ai-assistant`:

- `index.ts`: public entry point used by the shared app header.
- `components/`: chat popup, microphone handling, and assistant avatar.
- `services/`: fixed-answer matching, text-to-speech, and the original demo report provider.
- `data/`: original demo report content.
- `tests/`: fixed-answer matching tests.

Import `{ AIButton }` from this feature's entry point when embedding the assistant.
Shared theme tokens stay in `src/theme`; native permissions and dependencies stay
in the app-level Expo configuration and package files. Commands below run from `mobile`.

The assistant avatar in the app header opens a chat window. Type Bangla or
Banglish, choose one of the 10 sample questions, or tap the microphone. The chat
and keyboard hide while a dedicated voice panel opens. Wait for “শুনছি”, speak
Bangla, then tap the large × below the microphone to finish and process the
speech. Review/edit the transcript back in chat and press Send. The panel's
“বাতিল করে চ্যাটে ফিরুন” action discards the recording; the header × closes the
whole assistant. Each answer has a Listen/Stop
control. The conversation is kept in memory only, until the header unmounts or
app restarts. Closing the popup preserves the conversation and draft.

All answers are fixed client-side demo data, visibly labelled as samples. No
backend, database, API key, or AI service is used for answer matching. The
operating-system/browser speech recognition service may send audio to its
provider and require internet; this is not an offline-recognition guarantee.

## Fixed questions

| Banglish question | Fixed answer |
| --- | --- |
| ajker sale koto taka (also: ajer sale koto taka) | আজকের সেল ২০০০ টাকা। |
| ajker lav koto taka | আজকের লাভ ৫০০ টাকা। |
| ajker khoroch koto taka | আজকের খরচ ৩০০ টাকা। |
| ajke koyti order hoyeche | আজকে ১০টি অর্ডার হয়েছে। |
| ajke koto taka baki ache | আজকে ৭০০ টাকা বাকি আছে। |
| ajke koto taka aday hoyeche | আজকে ১৩০০ টাকা আদায় হয়েছে। |
| stock e koyti ponno ache | স্টকে ১৫০টি পণ্য আছে। |
| ajke koyjon notun customer esheche | আজকে ৪জন নতুন কাস্টমার এসেছে। |
| koyti order pending ache | ৩টি অর্ডার পেন্ডিং আছে। |
| gotokaler sale koto taka | গতকালের সেল ১৮০০ টাকা। |

Matching ignores case, punctuation and repeated spaces, with explicit Bengali
and Banglish aliases. Unknown questions get a prompt to use the sample list;
this POC is not a general natural-language model.

## Native builds

Run `npm ci` in `mobile`. Speech recognition requires a NEW native build;
Expo Go and previously installed APKs/IPAs do not include the new native module.
Run `npx expo prebuild --platform android` before rebuilding Android, or use
the existing iOS BrowserStack workflow, which prebuilds iOS automatically.
The app.json config plugin adds microphone/speech permissions and Android
recognizer discovery. No workflow/backend change is needed.

Grant microphone and speech recognition permissions. Bengali recognition
availability depends on the device, OS and installed speech service. Android
may need Google's speech recognition service enabled. An unsupported device or
denied permission shows an error while typed chat remains available. The
microphone requests `bn-BD`. For web, use a browser with SpeechRecognition
support on localhost or HTTPS. A remote device session also needs working
microphone forwarding; verify real speech on a physical device.

The native recognizer processes audio as it arrives; the app holds the transcript
until you finish with ×. Finishing uses `stop()` and retains result listeners until
recognition ends; cancellation uses `abort()`. Android 13+ uses continuous
recognition and accumulates finalized segments. Older Android services may stop
automatically after a pause; the panel then asks you to tap × to use the captured
text. Startup and finalization timeouts show errors rather than an endless spinner.
Permission alone is insufficient if the APK lacks the native module, the speech
service is disabled, or the service does not support Bengali. The panel shows
these errors and offers Retry or a return to typed chat.

Permission is checked before requesting it again. A pending permission activity
does not dismiss the voice panel. Backgrounding during an active recording stops
capture and leaves an interruption message with Retry, rather than silently
returning to chat.

Replies use expo-speech and need an installed Bengali voice. On iOS check
silent mode/media volume. Missing Bengali voices produce setup guidance.

## Validation

- `npm run typecheck`
- `node --experimental-strip-types src/features/ai-assistant/tests/chat-poc.test.mjs` (Node 22+)
- `node --experimental-strip-types src/features/ai-assistant/tests/voice-session.test.mjs`
- Tap avatar; verify chat layout, scrolling and keyboard on a small screen.
- Send each sample question, the Banglish typo example and an unknown question.
- Tap mic; verify chat hides and the panel progresses from starting to listening.
- Speak a listed Bengali question; tap the panel's ×, verify processing and the
  resulting draft, edit it, then Send. Verify existing draft text is preserved.
- Deny permissions, stop/restart recording, close while recording/speaking,
  navigate away and background the app; confirm audio stops.
- Listen to a reply, stop it, and try with no Bengali voice installed.

Code: `components/AIButton.tsx`, `services/chatPoc.ts`, and
`services/speechService.ts`, relative to this feature folder.
