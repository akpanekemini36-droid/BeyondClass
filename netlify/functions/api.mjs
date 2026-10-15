import { getStore } from '@netlify/blobs';
import api from '../../lib/netlify-api.cjs';

let handler;
export default async function (request, context) {
  // Preview deployments must not read or write the production inbox.
  const deployContext = context.deploy?.context || process.env.CONTEXT || 'dev';
  if (deployContext === 'production' && (context.deploy?.published !== true || !context.site?.url || new URL(request.url).origin !== new URL(context.site.url).origin)) {
    return new Response(JSON.stringify({ ok: false, error: 'Please use the current website address.' }), {
      status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
    });
  }
  const environment = deployContext === 'production' ? 'production' : 'preview-' + (context.deploy?.id || process.env.DEPLOY_ID || 'local');
  if (!handler) handler = api.createNetlifyHandler({
    store: getStore({ name: 'beyondclass-inbox-' + environment, consistency: 'strong' }),
    password: process.env.INBOX_PASSWORD
  });
  return handler(request, context);
}

export const config = {
  path: '/api/*',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 120 }
};
