import { createApi } from '../api-core.js';

const api = createApi();

export default {
  fetch(request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return api(request, { pathname: new URL(request.url).pathname, ip });
  }
};
