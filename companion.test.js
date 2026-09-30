import test from 'node:test';
import assert from 'node:assert/strict';
import { companionPrompt, cleanHistory, urgentFallReply } from './companion-core.js';
import { createCompanionService } from './companion.js';
import { createSarvamClient } from './sarvam.js';

test('companion prompts respect language, consent and safe scope', () => {
  assert.match(companionPrompt('hi'), /Devanagari/);
  assert.match(companionPrompt('en'), /natural English/);
  assert.match(companionPrompt('en'), /Do not invent/);
  assert.match(companionPrompt('hi', [{title:'दवा',time:'08:00'}]), /दवा at 08:00/);
  assert.match(companionPrompt('en'), /they fell/);
  assert.match(companionPrompt('en'), /emergency services/);
  assert.deepEqual(cleanHistory([{role:'system',content:'ignored'},{role:'user',content:'hello'}]),[{role:'user',content:'hello'}]);
  assert.match(urgentFallReply('I fell from a tree','en'), /contact local emergency services/);
  assert.match(urgentFallReply('मैं पेड़ से गिरा','hi'), /आपातकालीन सेवा/);
  assert.equal(urgentFallReply('I am fine','en'),null);
});

test('Groq generates replies in both languages with limited history and no exposed reasoning', async () => {
  const calls=[];
  const service=createCompanionService({GROQ_API_KEY:'private'},async(url,options)=>{
    calls.push({url,options,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>({choices:[{message:{content:'<think>private reasoning</think>Hello, I am here.'}}]})};
  });
  assert.equal(await service.available(),true);
  assert.equal(service.speechAvailable('asr','hi'),false);
  assert.equal(service.speechAvailable('asr','en'),true);
  assert.equal((await service.reply('Hello','en',[{role:'system',content:'malicious'},{role:'user',content:'Earlier'}])).text,'Hello, I am here.');
  assert.equal((await service.reply('नमस्ते','hi')).mode,'model');
  assert.equal(calls[0].url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization,'Bearer private');
  assert.equal(calls[0].body.model,'openai/gpt-oss-120b');
  assert.equal(calls[0].body.messages.length,3);
  assert.equal(calls[0].body.messages[1].content,'Earlier');
  assert.match(calls[1].body.messages[0].content,/Devanagari/);
  const offline=createCompanionService({},async()=>{throw Error('offline')});
  await assert.rejects(offline.reply('नमस्ते','hi'),error=>error.status===503);
});

test('Groq handles English transcription and voice only',async()=>{
  const calls=[];
  const service=createCompanionService({GROQ_API_KEY:'private'},async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/audio/transcriptions'))return {ok:true,json:async()=>({text:'Hello Saathi'})};
    return {ok:true,arrayBuffer:async()=>Buffer.from('WAVE')};
  });
  assert.equal(await service.transcribe(Buffer.from('wav').toString('base64')),'Hello Saathi');
  assert.equal((await service.synthesize('Hello')).toString(),'WAVE');
  assert.equal(calls[0].options.body.get('model'),'whisper-large-v3-turbo');
  assert.equal(calls[0].options.body.get('language'),'en');
  assert.equal(calls[1].url,'https://api.groq.com/openai/v1/audio/speech');
  assert.equal(JSON.parse(calls[1].options.body).voice,'hannah');
  await assert.rejects(service.synthesize('x'.repeat(201)),error=>error.status===413);
});

test('Sarvam handles Hindi speech only and keeps its key server-side',async()=>{
  const calls=[];
  const client=createSarvamClient({SARVAM_API_KEY:'hindi-private'},async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/speech-to-text'))return {ok:true,json:async()=>({transcript:'नमस्ते'})};
    return {ok:true,json:async()=>({audios:[Buffer.from('WAVE').toString('base64')]})};
  });
  assert.equal(client.available('asr','hi'),true);
  assert.equal(client.available('tts','en'),false);
  assert.equal(await client.transcribe(Buffer.from('wav').toString('base64')),'नमस्ते');
  assert.equal((await client.synthesize('नमस्ते')).toString(),'WAVE');
  assert.equal(calls[0].url,'https://api.sarvam.ai/speech-to-text');
  assert.equal(calls[0].options.headers['api-subscription-key'],'hindi-private');
  assert.equal(calls[0].options.body.get('model'),'saaras:v3');
  assert.equal(calls[0].options.body.get('language_code'),'hi-IN');
  assert.equal(calls[1].url,'https://api.sarvam.ai/text-to-speech');
  assert.equal(JSON.parse(calls[1].options.body).model,'bulbul:v3');
  assert.equal(JSON.parse(calls[1].options.body).language_code,'hi-IN');
});
