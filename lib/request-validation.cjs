'use strict';
const plans = require('../assets/plans.js');
const hasPlan = name => Object.prototype.hasOwnProperty.call(plans, name);
function listedPrice(name) {
  const plan = plans[name];
  return '$' + plan.USD.toLocaleString('en-US') + ' / ' + plan.period + ' · ₦' + plan.NGN.toLocaleString('en-NG') + ' / ' + plan.period;
}
const fail = (status, message) => Object.assign(new Error(message), { status });
function field(body, name, max, required = true) {
  const value = typeof body[name] === 'string' ? body[name].trim() : '';
  if ((required && !value) || value.length > max) throw fail(422, 'Please check the ' + name.replace(/([A-Z])/g, ' $1').toLowerCase() + ' field.');
  return value;
}
function validateRequest(body) {
  if (body.website) throw fail(422, 'Unable to send this request.');
  if (!['materials', 'trial', 'payment'].includes(body.kind)) throw fail(422, 'Please choose a valid request type.');
  const token = field(body, 'requestToken', 36);
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(token)) throw fail(422, 'Please refresh the page and try again.');
  const email = field(body, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(422, 'Please enter a valid email address.');
  if (body.kind === 'payment') {
    const plan = field(body, 'plan', 80);
    const amount = field(body, 'amount', 11);
    if (!hasPlan(plan)) throw fail(422, 'Please choose a valid tutoring plan.');
    if (!['USD', 'NGN'].includes(body.currency) || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(amount) || Number(amount) < 0.01 || Number(amount) > (body.currency === 'USD' ? 99999.99 : 99999999.99)) throw fail(422, 'Please enter the amount sent in USD or NGN, with up to two decimal places.');
    return { kind: 'payment', token, details: {
      email, name: field(body, 'name', 100), plan, planPrice: listedPrice(plan), currency: body.currency, amount: Number(amount).toFixed(2),
      transferReference: field(body, 'transferReference', 160), message: field(body, 'message', 1000, false),
      verification: 'Unverified — check ' + (body.currency === 'USD' ? 'Cleva' : 'OPay') + ' before confirming payment'
    } };
  }
  const details = { email, grade: field(body, 'grade', 80) };
  if (body.kind === 'materials') details.topic = field(body, 'topic', 300);
  else {
    details.name = field(body, 'name', 100);
    details.curriculum = field(body, 'curriculum', 100);
    details.timeZone = field(body, 'timeZone', 100);
    details.availability = field(body, 'availability', 300);
    details.plan = field(body, 'plan', 80);
    if (!hasPlan(details.plan) && details.plan !== 'Not sure yet') throw fail(422, 'Please choose a valid tutoring plan.');
    if (hasPlan(details.plan)) details.planPrice = listedPrice(details.plan);
    details.message = field(body, 'message', 4000, false);
  }
  return { kind: body.kind, token, details };
}
module.exports = { fail, validateRequest };
