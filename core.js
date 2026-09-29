export const DOMAINS = ['memory', 'attention', 'routine', 'pattern'];

function speechText(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[!?.,;:।,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hindiIntent(text) {
  const words=speechText(text);
  if (/दवा|दवाई|दवाइ|दवाएं|पानी|जल|याद दिल|याद दिला|आज (की )?याद|आज क्या|रिमाइंड|यादें/.test(words)) return 'reminders';
  if (/ध्यान|ढूंढ|ढूँढ|खोज|फल|सही वस्तु/.test(words)) return 'attention';
  if (/पैटर्न|आकार|अगली चीज|अगला आकार/.test(words)) return 'pattern';
  if (/दिनचर्या|रूटीन|रोजमर्रा|सही क्रम/.test(words)) return 'routine';
  if (/याददाश्त|याद शक्ति|स्मृति|यादों का खेल|मेमोरी/.test(words)) return 'memory';
  if (/खेल|गेम/.test(words)) return 'games';
  if (/अगला|आगे|जारी|चलो आगे/.test(words)) return 'next';
  if (/वापस|पीछे|बंद|होम|मुख्य/.test(words)) return 'back';
  if (/देखभाल|केयरगिवर|परिवार/.test(words)) return 'caregiver';
  if (/साथी|बातचीत|कंपेनियन/.test(words)) return 'companion';
  if (/सेटिंग|सेटिंग्स/.test(words)) return 'settings';
  return 'help';
}

export function englishIntent(text) {
  const words = speechText(text);
  if (/remind|reminder|medicine|medication|pill|water|hydration|today('?s)? reminders|schedule|what('s| is) today/.test(words)) return 'reminders';
  if (/attention|find|fruit|search|spot|look for/.test(words)) return 'attention';
  if (/pattern|sequence|what comes next|next shape/.test(words)) return 'pattern';
  if (/routine|daily|daily steps|order the steps/.test(words)) return 'routine';
  if (/memory|remember|basket|memory game/.test(words)) return 'memory';
  if (/open games|show games|games|game menu/.test(words)) return 'games';
  if (/next|continue|forward|go on/.test(words)) return 'next';
  if (/back|home|stop|exit|quit/.test(words)) return 'back';
  if (/caregiver|care team|family/.test(words)) return 'caregiver';
  if (/companion|talk to saathi|conversation/.test(words)) return 'companion';
  if (/settings|preferences/.test(words)) return 'settings';
  return 'help';
}

export function nextLevel(sessions, domain) {
  const recent = sessions.filter(s => s.domain === domain && !s.demo).slice(-8);
  if (!recent.length) return 1;
  const previous = recent.at(-1).level || 1;
  const atLevel = recent.filter(s => s.level === previous);
  if (atLevel.length < 2) return previous;
  // Online beta-binomial mastery estimate: each three-round session contributes three observations.
  const successes = atLevel.reduce((sum, s) => sum + Math.max(0, Math.min(1, s.score / 100)) * 3, 0);
  const mastery = (2 + successes) / (4 + atLevel.length * 3);
  return Math.max(1, Math.min(3, previous + (mastery >= .75 ? 1 : 0) - (mastery <= .45 ? 1 : 0)));
}

export function domainScores(sessions) {
  return Object.fromEntries(DOMAINS.map(domain => {
    const recent = sessions.filter(s => s.domain === domain).slice(-5);
    return [domain, recent.length ? Math.round(recent.reduce((sum, s) => sum + s.score, 0) / recent.length) : null];
  }));
}

export function activityTrend(sessions, includeDemo = false) {
  const selected = sessions.filter(s => includeDemo || !s.demo);
  const days = [...new Set(selected.map(s => s.date.slice(0, 10)))].sort();
  if (days.length < 6) return null;
  const last = days.slice(-6);
  const average = selected => {
    const values = sessions.filter(s => (includeDemo || !s.demo) && selected.includes(s.date.slice(0, 10))).map(s => s.score);
    return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
  };
  const earlier = average(last.slice(0, 3));
  const recent = average(last.slice(3));
  return { earlier: Math.round(earlier), recent: Math.round(recent), lower: earlier >= 40 && recent < earlier - 20 };
}

export function mergeData(local, remote) {
  const byId = (a, b) => [...new Map([...a, ...b].map(item => [item.id, item])).values()];
  const reminders = new Map();
  for (const item of [...(remote.reminders || []), ...(local.reminders || [])]) {
    const old = reminders.get(item.id);
    if (!old || (item.updatedAt || '') >= (old.updatedAt || '')) reminders.set(item.id, item);
  }
  const conversationClearedAt=(local.conversationClearedAt||'')>(remote.conversationClearedAt||'')?local.conversationClearedAt:remote.conversationClearedAt||'';
  const conversation=[...new Map([...(remote.conversation||[]),...(local.conversation||[])].filter(turn=>turn.date>conversationClearedAt).map(turn=>[turn.id,turn])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-200);
  return {
    ...remote, ...local,
    profile: (local.profile?.updatedAt || '') >= (remote.profile?.updatedAt || '') ? local.profile : remote.profile,
    sessions: byId(remote.sessions || [], local.sessions || []).sort((a, b) => a.date.localeCompare(b.date)),
    reminders: [...reminders.values()], conversation, conversationClearedAt,
    checks: Object.fromEntries([...new Set([...Object.keys(remote.checks||{}),...Object.keys(local.checks||{})])].map(key => {
      const a=remote.checks?.[key], b=local.checks?.[key];
      return [key, !a?b:!b?a:(b.updatedAt||'') >= (a.updatedAt||'')?b:a];
    }))
  };
}
