import { resolveBaseUrl } from 'file:///C:/Users/Usuario/Documents/qa-pr-test/e2e/lib/target.ts';
const ok = ['http://localhost:3000', 'http://127.0.0.1:8080', 'http://[::1]:5173', 'https://backend-staging-e3a6.up.railway.app', undefined, '', '  '];
const bad = ['http://backend-staging-e3a6.up.railway.app', 'https://backend-production-ab.up.railway.app', 'https://example.com', 'https://backend-staging-x.up.railway.app.evil.com', 'https://evil-localhost', 'https://localhost.evil.com', 'https://user:pass@backend-staging-e3a6.up.railway.app@evil.com', 'ftp://localhost', 'no es url', 'https://backend-staging-.up.railway.app/..', 'https://x.up.railway.app', 'https://backend-staging-e3a6.up.railway.app.attacker.io', 'https://BACKEND-STAGING-E3A6.up.railway.app.evil.com'];
let r = [];
for (const v of ok) { try { r.push(['ok', String(v), resolveBaseUrl(v)]); } catch (e) { r.push(['FALLA-permitido', String(v), e.message]); } }
for (const v of bad) { try { r.push(['FALLA-NO-BLOQUEADO', v, resolveBaseUrl(v)]); } catch (e) { r.push(['bloqueado', v, 'error']); } }
console.log(JSON.stringify(r.map(x => x.slice(0, 3).join(' | ')), null, 0).replace(/","/g, '\n'));
