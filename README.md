# Saathi — SIH26003

Tablet-first, offline-first cognitive games and memory support with a caregiver view and Hindi voice guidance.

**SIH prototype:** Built to demonstrate the idea and core flows. Small labels in the app identify areas that still need external services, device support, or real-world validation.

| Area | Prototype boundary |
| --- | --- |
| Family sync | Works across devices through the local Node server or Vercel Functions with Upstash Redis. A sharing ID grants full access; user authentication and revocation are future work. |
| AI companion | Groq generates Hindi and English replies when its server-side key is set. Provider calls are mock-tested; live responses still need testing with your key. |
| Hindi/English voice | In Talk to Saathi, Sarvam handles Hindi speech only. Groq handles English transcription and short spoken replies; longer English replies use device speech. Live provider calls still need testing with your keys. |
| Reminders and caregiver insights | Notifications run while the app is open. Game scores are activity indicators, not a clinical assessment. |
| Assamese conversation | The interface is translated; companion chat currently supports Hindi and English. |

## Run

Requires Node.js 24 or later. Install dependencies before running the checks or deploying:

```sh
npm ci
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Run the checks with `npm test`.

The local Node server stores shared data in `saathi.sqlite` in this directory. The file is ignored by Git. For Vercel, connect an Upstash Redis database from the Vercel Marketplace so `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are available. Without those variables, the app stays usable locally but family sync returns a clear storage configuration error. A sharing ID is a 128-bit random access secret: anyone with it can read, edit, or delete that space. Share it privately; there is no password recovery or identity verification in this prototype.

## Demo

1. Open **Games** and play each of the four domains. Each session has three untimed rounds.
2. Open **Caregiver** to see per-domain activity and add a reminder.
3. Open **Settings** to see your unique sharing ID. Tap **Enable ID sharing** to save this space online.
4. On another device using the same deployed server, enter that ID under **Join an existing shared space**. Both devices can edit the same profile, reminders, games and conversation history. Updates are checked about every 15 seconds while the page is open. The older code-and-passphrase flow remains available for existing spaces.
5. From the family account, create a one-use care-team invite. Enter it on a health worker's device to open the read-only dashboard.
6. After the first load, disconnect the network and reload. Games, reminders and local activity remain available; syncing resumes when online.

The selected language applies to navigation, games, forms, dashboard, dates, feedback, notifications, and spoken guidance. English speech in the Voice Guide uses a device voice. The main Hindi game prompts and default reminder phrases also ship as offline audio, so the Hindi Voice Guide works without an installed Hindi voice. Custom reminder titles need a system voice for speech. Simple Voice Guide commands use the browser's recognition API when available and may need a connection. All essential actions have touch controls. Family members can add optional translations for custom reminder titles; user-written text is otherwise shown as entered.

See [SIH26003_PLAN.md](./SIH26003_PLAN.md) for the problem mapping, architecture, pitch, and real-world validation requirements.

## Hindi and English conversation companion

The highlighted **Talk to Saathi** section opens a private chat in the chosen site language. The interface offers text, microphone input, spoken replies, and an optional checkbox to share the day's reminders with the model. Chat turns are stored on this device and, when ID sharing is enabled, in the shared family database so trusted devices see the same conversation. The chat view shows turns in the selected language; switching language does not erase the other language’s turns. Clearing chat removes earlier turns across synced devices.

Text chat and spoken-message replies use Groq's `openai/gpt-oss-120b` model. The browser sends the message to Saathi's backend; only the backend sends it to Groq. In **Speak to Saathi**, Hindi microphone audio goes to Sarvam Saaras for transcription and Groq produces the reply text. Sarvam Bulbul speaks that Hindi reply. English microphone audio goes to Groq Whisper; Groq produces and speaks short English replies with Orpheus. Longer English replies use the device voice because Orpheus has a 200-character input limit. Sarvam is used only for Hindi voice in this companion section.

### Add your keys separately

For local development, copy `.env.example` to `.env` in the project root. Put each key on its own line:

```sh
GROQ_API_KEY=your_groq_key_here
SARVAM_API_KEY=your_sarvam_key_here
```

Then run `npm start`. The local server loads `.env` on Node.js 24. `.env` is ignored by Git. Do not add either key to `app.js`, the browser, `dist/`, or a `VITE_`/`PUBLIC_` variable.

For Vercel, open the `hamisaathi` project, choose **Settings → Environment Variables**, and add `GROQ_API_KEY` and `SARVAM_API_KEY` as two separate server environment variables for Production. Add Preview and Development scopes if you use those deployments. Save and redeploy so the Vercel Function receives the new values. The public browser bundle does not contain the keys. Provider free tiers have limits; set spending limits or monitoring in the provider accounts before public use.

After redeployment, visit `/api/companion/status`. With both keys present it should report `model: true` and `speech.hi` and `speech.en` ASR/TTS values as `true`. These values confirm configuration, not whether the provider accepted the keys. Send one text message, then try a short Hindi and English recording to verify live calls. If Sarvam is absent, Hindi voice is unavailable, while Groq text chat remains available. If Groq is absent, the Send button remains unavailable; no canned AI reply is displayed. The voice routes are adapter-tested with mock responses; live calls remain unverified until keys are added.

Saathi identifies itself as AI, avoids medical advice, and directs urgent situations to trusted people and emergency services. Natural voice conversation quality needs real-user validation. This is a companionship prototype, not a clinical or crisis service.

## Vercel deployment

Vercel builds the browser assets with `npm run build` and deploys the handler in `api/index.js`. The local development server is named `local-server.js` so Vercel does not mistake the SQLite server entrypoint for a serverless function. After deployment, open `/api/companion/status`: it should return JSON. `model: false` means the Groq key is missing. Install Upstash Redis from the Vercel Marketplace and redeploy to enable family sync. Set Groq and Sarvam keys only as Vercel environment variables.

Local SQLite files, environment files, logs, `node_modules`, and downloaded model weights are ignored. The published `dist/` contains only browser files and bundled demo audio. Do not commit API keys, real family data, chat exports, or model weights. A previous GitHub upload included `saathi.sqlite`; the current tree removes it, but the old Git commit still contains it. If its IDs or data were real, replace the shared IDs and remove the file from Git history before treating the repository as private or secure.
