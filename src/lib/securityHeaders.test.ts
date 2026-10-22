import assert from 'node:assert/strict';import test from 'node:test';import {securityHeaders} from './securityHeaders.ts';
test('C3: headers protect framing and restrict permissions with a report-only full CSP',()=>{
 const h=Object.fromEntries(securityHeaders('https://test.supabase.co').map(x=>[x.key,x.value]));
 assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.match(h['Content-Security-Policy-Report-Only'],/wss:\/\/test.supabase.co/);
 assert.equal(h['X-Content-Type-Options'],'nosniff');assert.match(h['Permissions-Policy'],/geolocation=\(\)/);
});
