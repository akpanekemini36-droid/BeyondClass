(function () {
  'use strict';
  var status = document.getElementById('inboxStatus');
  var login = document.getElementById('inboxLogin');
  var content = document.getElementById('inboxContent');
  var list = document.getElementById('requestList');
  var page = 1, loading = false, unreadCount = 0, totalCount = 0, pageSize = 30, unreadChanged = false;
  function updatePagination() {
    var pages = Math.max(1, Math.ceil(totalCount / pageSize));
    page = Math.min(page, pages);
    document.getElementById('inboxPageLabel').textContent = 'Page ' + page + ' of ' + pages;
    document.getElementById('previousInboxPage').disabled = page <= 1;
    var next = document.getElementById('nextInboxPage');
    next.textContent = unreadChanged ? 'Show remaining new requests' : 'Next';
    next.disabled = unreadChanged ? totalCount === 0 : page >= pages;
  }
  function updateCount() {
    var filtered = document.getElementById('inboxKind').value || document.getElementById('inboxUnread').checked;
    document.getElementById('inboxCount').textContent = totalCount + (filtered ? ' matching request' : ' request') + (totalCount === 1 ? '' : 's') + ' · ' + unreadCount + (filtered ? ' new overall' : ' new');
  }
  var analyticsVersion = 0, sessionVersion = 0, listVersion = 0, statusVersion = 0;
  var activeStatusUpdates = new Map();
  function signedOut() { sessionVersion++; analyticsVersion++; statusVersion++; activeStatusUpdates.clear(); loading = false; login.hidden = false; content.hidden = true; list.replaceChildren(); document.getElementById('analyticsSummary').hidden = true; document.getElementById('analyticsChart').replaceChildren(); document.getElementById('analyticsPageRows').replaceChildren(); }
  async function api(path, method, body) {
    var version = sessionVersion;
    var options = { credentials: 'same-origin', cache: 'no-store' };
    if (method) { options.method = method; options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body || {}); }
    var response = await fetch(path, options);
    var result = await response.json().catch(function () { return null; });
    if (!response.ok || !result || result.ok !== true) {
      if (version === sessionVersion && response.status === 401 && path !== '/api/inbox/login' && path !== '/api/inbox/password') {
        signedOut(); status.textContent = 'Please sign in to your inbox.';
      }
      throw new Error(result && result.error ? result.error : 'We couldn’t load your inbox. Please try again.');
    }
    return result;
  }
  function node(tag, text, className) {
    var el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  async function loadAnalytics() {
    var version = ++analyticsVersion;
    var message = document.getElementById('analyticsStatus');
    var summary = document.getElementById('analyticsSummary');
    message.textContent = 'Loading page counts…'; summary.hidden = true;
    try {
      var result = await api('/api/inbox/analytics?days=' + document.getElementById('analyticsDays').value);
      if (version !== analyticsVersion || content.hidden) return;
      document.getElementById('analyticsToday').textContent = result.today.toLocaleString();
      document.getElementById('analyticsTotal').textContent = result.total.toLocaleString();
      document.getElementById('analyticsPeriodLabel').textContent = 'Last ' + result.days + ' days';
      var chart = document.getElementById('analyticsChart'); chart.replaceChildren();
      chart.setAttribute('aria-label', 'Daily page views over the last ' + result.days + ' days: ' + result.daily.map(function (day) { return day.day + ': ' + day.views; }).join(', '));
      var highest = Math.max.apply(null, result.daily.map(function (day) { return day.views; }).concat([1]));
      result.daily.forEach(function (day) {
        var bar = node('span', undefined, 'analytics-bar'); bar.title = day.day + ': ' + day.views + ' views';
        bar.style.setProperty('--bar-height', day.views ? Math.max(4, day.views / highest * 100) + '%' : '2px');
        bar.classList.toggle('is-empty', day.views === 0); bar.setAttribute('aria-hidden', 'true'); chart.append(bar);
      });
      document.getElementById('analyticsDateRange').textContent = result.daily[0].day + ' — ' + result.daily[result.daily.length - 1].day + ' (UTC)';
      var rows = document.getElementById('analyticsPageRows'); rows.replaceChildren();
      result.pages.forEach(function (page) { var row = node('tr'); row.append(node('th', page.label), node('td', page.views.toLocaleString())); row.firstChild.setAttribute('scope', 'row'); rows.append(row); });
      message.textContent = result.total ? '' : 'No page views recorded in this period yet. Counts begin when these updates are published.';
      summary.hidden = false;
    } catch (error) { if (version === analyticsVersion) message.textContent = 'Page counts could not be loaded. ' + error.message; }
  }
  function renderRequest(request) {
    var renderedVersion = listVersion, renderedSession = sessionVersion;
    var card = node('details', undefined, 'inbox-request');
    var summary = node('summary');
    var title = request.kind === 'payment' ? request.details.currency + ' transfer notice: ' + request.details.name : request.kind === 'materials' ? 'Free materials: ' + request.details.topic : 'Trial booking: ' + request.details.name;
    summary.append(node('strong', title), node('span', request.status === 'new' ? 'New' : 'Read', 'inbox-badge'));
    var date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(request.created_at));
    summary.append(node('span', request.reference + ' · ' + date, 'inbox-request-meta'));
    card.append(summary);
    var fields = node('dl');
    var labels = { name: 'Parent', email: 'Email', grade: 'Grade / year', topic: 'Topic', curriculum: 'Curriculum', timeZone: 'Time zone', availability: 'Preferred availability', plan: 'Plan', currency: 'Currency', amount: 'Reported amount', transferReference: 'Transfer reference / sender name', verification: 'Payment verification', message: 'Notes' };
    Object.keys(labels).forEach(function (key) {
      if (!request.details[key]) return;
      fields.append(node('dt', labels[key]), node('dd', request.details[key]));
    });
    card.append(fields);
    var readButton = node('button', request.status === 'new' ? 'Mark as read' : 'Mark as new', 'btn-secondary');
    readButton.type = 'button';
    readButton.disabled = activeStatusUpdates.has(request.id);
    async function setRead(nextStatus) {
      if (renderedSession !== sessionVersion || activeStatusUpdates.has(request.id)) return;
      var operation = ++statusVersion, refreshAfter = false;
      activeStatusUpdates.set(request.id, operation);
      readButton.disabled = true;
      card.setAttribute('aria-busy', 'true');
      function isCurrent() { return renderedSession === sessionVersion && activeStatusUpdates.get(request.id) === operation; }
      try {
        var result = await api('/api/inbox/requests/' + request.id, 'PATCH', { status: nextStatus });
        if (!isCurrent()) return;
        if (renderedVersion !== listVersion) { refreshAfter = true; return; }
        if (typeof result.revision === 'number' && result.revision < (request.revision || 0)) { refreshAfter = true; return; }
        var savedStatus = result.status === 'new' || result.status === 'read' ? result.status : nextStatus;
        if (request.status !== savedStatus) {
          var change = savedStatus === 'new' ? 1 : -1;
          unreadCount += change;
          if (document.getElementById('inboxUnread').checked) {
            totalCount += change;
            unreadChanged = true;
            updatePagination();
          }
        }
        request.status = savedStatus;
        if (typeof result.revision === 'number') request.revision = result.revision;
        updateCount();
        summary.querySelector('.inbox-badge').textContent = savedStatus === 'new' ? 'New' : 'Read';
        readButton.textContent = savedStatus === 'new' ? 'Mark as read' : 'Mark as new';
      } catch (error) {
        if (!isCurrent()) return;
        status.textContent = error.message;
        // A lost response can follow a committed change. Reload authoritative state.
        refreshAfter = true;
      } finally {
        if (isCurrent()) {
          activeStatusUpdates.delete(request.id);
          statusVersion++;
          readButton.disabled = false;
          card.removeAttribute('aria-busy');
          if (refreshAfter || renderedVersion !== listVersion || (!card.open && unreadChanged)) load();
        }
      }
    }
    card.addEventListener('toggle', async function () {
      if (card.open && request.status === 'new') {
        await setRead('read');
      }
      // Keep the open request readable; refresh the shrinking unread list
      // when it is closed, or through the remaining-requests button.
      if (!card.open && unreadChanged && renderedVersion === listVersion && renderedSession === sessionVersion) load();
    });
    readButton.addEventListener('click', async function () {
      await setRead(request.status === 'new' ? 'read' : 'new');
    });
    card.append(readButton);
    return card;
  }
  async function load() {
    var version = sessionVersion, currentList = ++listVersion, currentStatus = statusVersion;
    loading = true; status.textContent = 'Loading requests…';
    list.replaceChildren();
    try {
      var params = new URLSearchParams({ page: String(page), kind: document.getElementById('inboxKind').value, unread: document.getElementById('inboxUnread').checked ? '1' : '0' });
      var result = await api('/api/inbox/requests?' + params);
      if (version !== sessionVersion || currentList !== listVersion) return;
      if (currentStatus !== statusVersion) return load();
      var pages = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (page > pages) { page = pages; return load(); }
      login.hidden = true; content.hidden = false;
      list.replaceChildren();
      if (!result.requests.length) list.append(node('p', 'No requests to show yet. New parent requests will appear here.'));
      result.requests.forEach(function (request) { list.append(renderRequest(request)); });
      totalCount = result.total; unreadCount = result.unreadCount; pageSize = result.pageSize; unreadChanged = false;
      updateCount(); updatePagination();
      status.textContent = '';
      loadAnalytics();
    } catch (error) { if (version === sessionVersion && currentList === listVersion) status.textContent = error.message; }
    finally { if (version === sessionVersion && currentList === listVersion) loading = false; }
  }
  document.getElementById('inboxLoginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var button = this.querySelector('button'); button.disabled = true;
    var version = sessionVersion;
    status.textContent = 'Signing in…';
    try {
      var session = await api('/api/inbox/login', 'POST', { password: document.getElementById('inboxPassword').value });
      if (version !== sessionVersion) return;
      document.getElementById('passwordSettings').hidden = session.canChangePassword === false;
      this.reset(); page = 1; await load();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.getElementById('refreshInbox').addEventListener('click', load);
  document.getElementById('analyticsDays').addEventListener('change', loadAnalytics);
  ['inboxKind', 'inboxUnread'].forEach(function (id) { document.getElementById(id).addEventListener('change', function () { page = 1; load(); }); });
  document.getElementById('previousInboxPage').addEventListener('click', function () { if (!loading && page > 1) { page--; load(); } });
  document.getElementById('nextInboxPage').addEventListener('click', function () { if (!loading) { page = unreadChanged ? 1 : page + 1; load(); } });
  document.getElementById('logoutInbox').addEventListener('click', async function () {
    try { await api('/api/inbox/logout', 'POST'); signedOut(); status.textContent = 'You are signed out.'; }
    catch (error) { status.textContent = error.message; }
  });
  document.getElementById('changeInboxPassword').addEventListener('submit', async function (event) {
    event.preventDefault();
    var button = this.querySelector('button'); button.disabled = true;
    try {
      await api('/api/inbox/password', 'POST', { currentPassword: document.getElementById('currentInboxPassword').value, newPassword: document.getElementById('newInboxPassword').value });
      this.reset(); signedOut(); status.textContent = 'Password changed. Sign in with your new password.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  function checkSession() {
    var version = sessionVersion;
    api('/api/inbox/session').then(function (session) {
      if (version !== sessionVersion) return;
      document.getElementById('passwordSettings').hidden = session.canChangePassword === false;
      load();
    }).catch(function () { if (version === sessionVersion) { signedOut(); status.textContent = ''; } });
  }
  window.addEventListener('pagehide', signedOut);
  window.addEventListener('pageshow', function (event) { if (event.persisted) checkSession(); });
  ['inboxLoginForm', 'changeInboxPassword'].forEach(function (id) {
    document.getElementById(id).querySelector('button[type="submit"]').disabled = false;
  });
  checkSession();
})();
