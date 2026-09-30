import { companionPrompt, cleanHistory, urgentFallReply } from './companion-core.js';

const base = 'https://api.groq.com/openai/v1';
const unavailable = (message, status = 503) => Object.assign(new Error(message), { status });

export function createCompanionService(env = process.env, request = fetch) {
  const key = env.GROQ_API_KEY;
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const voice = env.GROQ_VOICE || 'hannah';
  const auth = { Authorization: `Bearer ${key}` };
  const available = async () => Boolean(key);
  const speechAvailable = (kind, language) => Boolean(key) && language === 'en' && ['asr', 'tts'].includes(kind);

  async function reply(message, language, history = [], reminders = []) {
    const urgent = urgentFallReply(message, language);
    if (urgent) return { text: urgent, mode: 'safety' };
    if (!key) throw unavailable('Groq AI is not configured.');
    const safeReminders = (Array.isArray(reminders) ? reminders : []).slice(0, 8).map(r => ({
      title: String(r?.title || '').slice(0, 80), time: String(r?.time || '').slice(0, 5)
    })).filter(r => r.title);
    let response;
    try {
      response = await request(`${base}/chat/completions`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ model, stream: false, reasoning_effort: 'low', max_completion_tokens: 800,
          messages: [{ role: 'system', content: companionPrompt(language, safeReminders) }, ...cleanHistory(history), { role: 'user', content: message }] })
      });
    } catch { throw unavailable('Groq AI could not be reached. Please try again.'); }
    if (!response.ok) throw unavailable(response.status === 429 ? 'Groq is busy. Please try again shortly.' : 'Groq AI could not answer. Check the API key and model.', response.status === 429 ? 429 : 503);
    const data = await response.json();
    const text = String(data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 1200);
    if (!text) throw unavailable('Groq returned an empty answer. Please try again.');
    return { text, mode: 'model' };
  }

  async function transcribe(audioContent) {
    if (!key) throw unavailable('Groq speech recognition is not configured.');
    const form = new FormData();
    form.set('file', new Blob([Buffer.from(audioContent, 'base64')], { type: 'audio/wav' }), 'speech.wav');
    form.set('model', 'whisper-large-v3-turbo');
    form.set('language', 'en');
    form.set('response_format', 'json');
    let response;
    try { response = await request(`${base}/audio/transcriptions`, { method: 'POST', headers: auth, body: form, signal: AbortSignal.timeout(30000) }); }
    catch { throw unavailable('English speech recognition could not be reached.'); }
    if (!response.ok) throw unavailable('English speech recognition could not process that recording.', response.status === 429 ? 429 : 503);
    const text = String((await response.json()).text || '').trim();
    if (!text) throw unavailable('No speech was detected. Please try again.', 422);
    return text;
  }

  async function synthesize(text) {
    if (!key) throw unavailable('Groq voice is not configured.');
    if (text.length > 200) throw unavailable('This reply is too long for the Groq voice model.', 413);
    let response;
    try {
      response = await request(`${base}/audio/speech`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ model: 'canopylabs/orpheus-v1-english', voice, input: text, response_format: 'wav' })
      });
    } catch { throw unavailable('English voice could not be reached.'); }
    if (!response.ok) throw unavailable('English voice could not speak this reply.', response.status === 429 ? 429 : 503);
    return Buffer.from(await response.arrayBuffer());
  }

  return { model, available, speechAvailable, reply, transcribe, synthesize };
}
