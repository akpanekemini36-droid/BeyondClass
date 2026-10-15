'use strict';
const fail = (status, message) => Object.assign(new Error(message), { status });
function field(body, name, max, required = true) {
  const value = typeof body[name] === 'string' ? body[name].trim() : '';
  if ((required && !value) || value.length > max) throw fail(422, 'Please check the ' + name.replace(/([A-Z])/g, ' $1').toLowerCase() + ' field.');
  return value;
}
function validateRequest(body) {
  if (body.website) throw fail(422, 'Unable to send this request.');
  if (!['materials', 'trial'].includes(body.kind)) throw fail(422, 'Please choose a valid request type.');
  const token = field(body, 'requestToken', 36);
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(token)) throw fail(422, 'Please refresh the page and try again.');
  const email = field(body, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(422, 'Please enter a valid email address.');
  const details = { email, grade: field(body, 'grade', 80) };
  if (body.kind === 'materials') details.topic = field(body, 'topic', 300);
  else {
    details.name = field(body, 'name', 100);
    details.curriculum = field(body, 'curriculum', 100);
    details.plan = field(body, 'plan', 80);
    details.message = field(body, 'message', 4000, false);
  }
  return { kind: body.kind, token, details };
}
module.exports = { fail, validateRequest };
