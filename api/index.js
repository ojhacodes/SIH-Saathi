import { createApi } from '../api-core.js';

const api = createApi();

export default {
  fetch(request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const url = new URL(request.url);
    const route = url.searchParams.get('route');
    return api(request, { pathname: route ? `/api/${route}` : url.pathname, ip });
  }
};
