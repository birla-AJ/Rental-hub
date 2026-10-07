import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/index.js';

const full = { photosMatch:1, roomsCounted:1, ownerContactCaptured:1, tenantKycVerified:1, geoTagged:1, qrApplied:1 };
test('verification needs full checklist, valid geo and a QR for EVERY room', () => {
  assert.equal(c.validateSubmission({ checklist: full, geo:{lat:22.75,lng:75.89}, propertyRoomIds:['a','b'], qrRoomIds:['a','b'] }).length, 0);
  assert.ok(c.validateSubmission({ checklist: full, geo:{lat:22.75,lng:75.89}, propertyRoomIds:['a','b'], qrRoomIds:['a'] })[0].includes('1 room'));
  assert.ok(c.validateSubmission({ checklist: { ...full, tenantKycVerified:0 }, geo:{lat:22.75,lng:75.89}, propertyRoomIds:[], qrRoomIds:[] }).includes('Tenant KYC verified'));
  assert.ok(c.validateSubmission({ checklist: full, geo:{lat:999,lng:0}, propertyRoomIds:[], qrRoomIds:[] }).length === 1);
});
test('QR payload round-trips and rejects foreign codes', () => {
  assert.equal(c.parseQr(c.qrPayload('r12')), 'r12');
  assert.equal(c.parseQr('https://evil.example/room/r12'), null);
});
