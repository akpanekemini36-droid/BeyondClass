'use strict';
const { publicPages } = require('./site-files.cjs');
const { fail } = require('./request-validation.cjs');
const labels = { 'index.html': 'Home', 'about.html': 'About', 'pricing.html': 'Pricing', 'reviews.html': 'Reviews', 'contact.html': 'Contact', 'payment.html': 'Payment', 'tutors.html': 'Our tutors', 'faq.html': 'FAQ', 'resources.html': 'Free materials', 'privacy.html': 'Privacy', 'assessment.html': 'Maths assessment' };
const dayAt = time => new Date(time).toISOString().slice(0, 10);
function validatePage(body) {
  if (!publicPages.includes(body.page)) throw fail(422, 'Choose a valid public page.');
  return body.page;
}
function periodDays(value) { return value === '7' ? 7 : 30; }
function dateRange(now, days) {
  const end = new Date(dayAt(now) + 'T00:00:00.000Z').getTime();
  return Array.from({ length: days }, (_, index) => dayAt(end - (days - index - 1) * 86400000));
}
function summarize(rows, now, days) {
  const dates = dateRange(now, days), daily = new Map(dates.map(day => [day, 0]));
  const pages = new Map(publicPages.map(page => [page, 0]));
  for (const row of rows) {
    if (!daily.has(row.day) || !pages.has(row.page) || !Number.isSafeInteger(row.views) || row.views < 0) continue;
    daily.set(row.day, daily.get(row.day) + row.views);
    pages.set(row.page, pages.get(row.page) + row.views);
  }
  return {
    ok: true, days, timeZone: 'UTC', today: daily.get(dayAt(now)) || 0,
    total: [...daily.values()].reduce((sum, count) => sum + count, 0),
    daily: [...daily].map(([day, views]) => ({ day, views })),
    pages: [...pages].map(([page, views]) => ({ page, label: labels[page], views })).sort((a, b) => b.views - a.views || a.label.localeCompare(b.label))
  };
}
module.exports = { dayAt, validatePage, periodDays, dateRange, summarize };
