const base = 'https://api.sarvam.ai';
const unavailable = (message, status = 503) => Object.assign(new Error(message), { status });

export function createSarvamClient(env = process.env, request = fetch) {
  const key = env.SARVAM_API_KEY;
  const available = (kind, language) => Boolean(key) && language === 'hi' && ['asr', 'tts'].includes(kind);

  async function transcribe(audioContent) {
    if (!key) throw unavailable('Sarvam Hindi speech recognition is not configured.');
    const form = new FormData();
    form.set('file', new Blob([Buffer.from(audioContent, 'base64')], { type: 'audio/wav' }), 'speech.wav');
    form.set('model', 'saaras:v3');
    form.set('mode', 'transcribe');
    form.set('language_code', 'hi-IN');
    let response;
    try { response = await request(`${base}/speech-to-text`, { method: 'POST', headers: { 'api-subscription-key': key }, body: form, signal: AbortSignal.timeout(30000) }); }
    catch { throw unavailable('Sarvam Hindi speech recognition could not be reached.'); }
    if (!response.ok) throw unavailable('Sarvam could not transcribe this recording.', response.status === 429 ? 429 : 503);
    const text = String((await response.json()).transcript || '').trim();
    if (!text) throw unavailable('No Hindi speech was detected. Please try again.', 422);
    return text;
  }

  async function synthesize(text) {
    if (!key) throw unavailable('Sarvam Hindi voice is not configured.');
    let response;
    try {
      response = await request(`${base}/text-to-speech`, {
        method: 'POST', headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ text, language_code: 'hi-IN', model: 'bulbul:v3', speaker: env.SARVAM_SPEAKER || 'shubh', output_audio_codec: 'wav' })
      });
    } catch { throw unavailable('Sarvam Hindi voice could not be reached.'); }
    if (!response.ok) throw unavailable('Sarvam could not speak this reply.', response.status === 429 ? 429 : 503);
    const audio = (await response.json()).audios?.[0];
    if (!audio) throw unavailable('Sarvam returned no audio.');
    return Buffer.from(audio, 'base64');
  }

  return { available, transcribe, synthesize };
}
