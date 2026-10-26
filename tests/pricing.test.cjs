'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateRequest } = require('../lib/request-validation.cjs');
const plans = require('../assets/plans.js');

test('bookings preserve the published four-week prices independently of client-supplied prices', () => {
  for (const [plan, usd, ngn] of [['Essential', 120, 168000], ['Growth', 160, 224000], ['Ultra', 350, 490000]]) {
    assert.equal(plans[plan].USD, usd);
    assert.equal(plans[plan].NGN, usd * 1400);
    const result = validateRequest({ kind: 'trial', requestToken: crypto.randomUUID(), email: 'test@example.invalid', name: 'Test Parent', grade: 'Grade 8', curriculum: 'Canada', timeZone: 'America/Toronto', availability: 'Tuesday 4 pm', plan, planPrice: '$1', message: '' });
    assert.equal(result.details.plan, plan);
    assert.equal(result.details.planPrice, '$' + usd + ' / 4 weeks · ₦' + ngn.toLocaleString('en-NG') + ' / 4 weeks');
  }
});

test('retired and inherited property names cannot become new booking plans', () => {
  for (const plan of ['Starter', 'Premium', 'Flexible', '__proto__', 'constructor']) {
    assert.throws(() => validateRequest({ kind: 'trial', requestToken: crypto.randomUUID(), email: 'test@example.invalid', name: 'Test Parent', grade: 'Grade 8', curriculum: 'Canada', timeZone: 'America/Toronto', availability: 'Tuesday', plan }), /valid tutoring plan/);
  }
});
