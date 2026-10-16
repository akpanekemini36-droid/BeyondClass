// A separate hosting route keeps logout outside the general function's limit.
export { default } from './api.mjs';
export const config = { path: '/api/inbox/logout', method: 'POST' };
