import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicRoute } from './publicRoutes.ts';
test('legal pages and login are public, calculator and unknown routes stay protected', () => {
 for (const route of ['/login','/impressum','/datenschutz','/agb','/widerruf']) assert.equal(isPublicRoute(route),true);
 for (const route of ['/','/api/private','/impressum/secret']) assert.equal(isPublicRoute(route),false);
});
