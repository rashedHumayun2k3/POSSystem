# Bangla chat POC

## Feature structure

All assistant-specific code lives in `src/features/ai-assistant`:

- `index.ts`: public entry point used by the shared app header.
- `components/`: chat popup and assistant avatar.
- `services/`: fixed-answer matching, text-to-speech, and the original demo report provider.
- `data/`: original demo report content.
- `tests/`: fixed-answer matching tests.

Import `{ AIButton }` from this feature's entry point when embedding the assistant.
Shared theme tokens stay in `src/theme`; native permissions and dependencies stay
in the app-level Expo configuration and package files. Commands below run from `mobile`.

The assistant avatar in the app header opens a chat window. Type Bangla or
Banglish or choose one of the 10 sample questions. User voice input has been
removed. Each answer has a Listen/Stop
control. The conversation is kept in memory only, until the header unmounts or
app restarts. Closing the popup preserves the conversation and draft.

All answers are fixed client-side demo data, visibly labelled as samples. No
backend, database, API key, or AI service is used for answer matching. The
assistant does not capture microphone audio.

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

Run `npm ci` in `mobile`. Rebuild native apps to remove the previously bundled
speech recognition module and its plugin-added permissions.

Replies use expo-speech and need an installed Bengali voice. On iOS check
silent mode/media volume. Missing Bengali voices produce setup guidance.

## Validation

- `npm run typecheck`
- `node --experimental-strip-types src/features/ai-assistant/tests/chat-poc.test.mjs` (Node 22+)
- Tap avatar; verify typed chat, sample questions, scrolling and keyboard.
- Close the assistant, navigate away and background the app; confirm playback stops.
- Listen to a reply, stop it, and try with no Bengali voice installed.

Code: `components/AIButton.tsx`, `services/chatPoc.ts`, and
`services/speechService.ts`, relative to this feature folder.
