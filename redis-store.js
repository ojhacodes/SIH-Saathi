// Vercel's functions are stateless. Upstash REST keeps family data across deploys.
const compareAndSet = `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 end; return 0`;

export function createRedisStore(env = process.env, request = fetch) {
  const url = env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  async function command(...args) {
    if (!url || !token) throw new Error('Family sync storage is not configured.');
    const response = await request(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Family sync storage returned ${response.status}.`);
    const result = await response.json();
    if (result.error) throw new Error(`Family sync storage error: ${result.error}`);
    return result.result;
  }

  return name => {
    const keyFor = key => `saathi:${name}:${key}`;
    return {
      async get(key) {
        const raw = await command('GET', keyFor(key));
        return raw === null ? null : JSON.parse(raw);
      },
      async getWithMetadata(key) {
        const raw = await command('GET', keyFor(key));
        return raw === null ? null : { data: JSON.parse(raw), etag: raw };
      },
      async setJSON(key, value, options = {}) {
        const raw = JSON.stringify(value);
        if (options.onlyIfNew) {
          return { modified: (await command('SET', keyFor(key), raw, 'NX')) === 'OK' };
        }
        if (options.onlyIfMatch !== undefined) {
          return { modified: (await command('EVAL', compareAndSet, 1, keyFor(key), options.onlyIfMatch, raw)) === 1 };
        }
        await command('SET', keyFor(key), raw);
        return { modified: true };
      },
      async delete(key) { await command('DEL', keyFor(key)); }
    };
  };
}
