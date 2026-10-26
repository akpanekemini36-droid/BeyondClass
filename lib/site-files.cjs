'use strict';
const publicPages = ['index.html', 'about.html', 'pricing.html', 'reviews.html', 'contact.html', 'payment.html', 'tutors.html', 'faq.html', 'resources.html', 'privacy.html', 'assessment.html'];
const allPages = [...publicPages, 'inbox.html'];
const titles = {
  'index.html': 'Online Math Tutoring | BeyondClass Math',
  'about.html': 'About BeyondClass | Personal Online Math Tutoring',
  'pricing.html': 'Online Math Tutoring Prices & Plans | BeyondClass Math',
  'reviews.html': 'Parent Reviews | BeyondClass Math Tutoring',
  'contact.html': 'Request a Free Math Trial Lesson | BeyondClass Math',
  'payment.html': 'Pay for Math Tutoring | BeyondClass Math',
  'tutors.html': 'Vetted Online Math Tutors | BeyondClass Math',
  'faq.html': 'Online Math Tutoring FAQs | BeyondClass Math',
  'resources.html': 'Free Math Materials & Interactive Tool | BeyondClass Math',
  'privacy.html': 'Child Protection & Privacy | BeyondClass Math'
};
function normalizeUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an HTTPS website origin without a path, password, port, query, or fragment.');
  return url.origin;
}
const pageUrl = (origin, file) => origin + (file === 'index.html' ? '/' : '/' + file);
function searchFiles(origin) {
  return {
    'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + publicPages.map(file => '  <url><loc>' + pageUrl(origin, file) + '</loc></url>').join('\n') + '\n</urlset>\n',
    'robots.txt': 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /.netlify/\n\nSitemap: ' + origin + '/sitemap.xml\n'
  };
}
function configureHtml(html, origin, file) {
  const canonical = html.match(/<link rel="canonical" href="(https:\/\/[^\"]+)"/);
  if (!canonical) return html;
  const oldOrigin = new URL(canonical[1]).origin;
  html = html.replaceAll(oldOrigin + '/', origin + '/');
  if (titles[file]) {
    const title = titles[file].replaceAll('&', '&amp;');
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>')
      .replace(/(<meta property="og:title" content=")[^"]*(">)/, '$1' + title + '$2')
      .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, '$1' + title + '$2');
  }
  const verification = process.env.GOOGLE_SITE_VERIFICATION;
  if (verification) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(verification)) throw new Error('GOOGLE_SITE_VERIFICATION must contain just the verification code.');
    html = html.replace(/<meta name="google-site-verification"[^>]*>\s*/g, '')
      .replace('</head>', '<meta name="google-site-verification" content="' + verification + '">\n</head>');
  }
  if (!html.includes('property="og:image"')) {
    html = html.replace('<meta property="og:locale"', '<meta property="og:image" content="' + origin + '/assets/images/beyondclass-card.png">\n<meta property="og:image:alt" content="BeyondClass Math Tutoring Services">\n<meta name="twitter:image" content="' + origin + '/assets/images/beyondclass-card.png">\n<meta property="og:locale"');
  }
  return html;
}
module.exports = { publicPages, allPages, normalizeUrl, pageUrl, searchFiles, configureHtml };
