(function () {
  'use strict';
  document.documentElement.classList.add('js');
  // Only aggregate a public page name; never send queries, referrers, or an identity.
  (function countPageView() {
    if (!['http:', 'https:'].includes(window.location.protocol) || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    var page = window.location.pathname === '/' ? 'index.html' : window.location.pathname.slice(1);
    if (!['index.html', 'about.html', 'pricing.html', 'reviews.html', 'contact.html', 'payment.html', 'tutors.html', 'faq.html', 'resources.html', 'privacy.html'].includes(page)) return;
    var sent = false;
    function send() {
      if (sent || document.visibilityState !== 'visible') return;
      sent = true;
      document.removeEventListener('visibilitychange', send);
      fetch('/api/pageviews', { method: 'POST', mode: 'same-origin', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: page }) }).catch(function () {});
    }
    send();
    if (!sent) document.addEventListener('visibilitychange', send);
  })();
  // Preserve the desktop card rows on phones without shrinking their text.
  var compactRows = window.matchMedia('(max-width: 640px)');
  var rowGroups = [
    ['#why .why-grid', 'Why families choose BeyondClass'],
    ['#how .steps', 'How tutoring works'],
    ['.page-cards', 'Explore BeyondClass'],
    ['#pricing .pricing-grid', 'Compare tutoring plans'],
    ['#trust .trust-cards', 'Family reviews']
  ];
  rowGroups.forEach(function (group, index) {
    var row = document.querySelector(group[0]);
    if (!row) return;
    row.classList.add('browse-row');
    row.setAttribute('role', 'region');
    row.setAttribute('aria-label', group[1]);
    var hint = document.createElement('p');
    hint.id = 'browseHint' + index;
    hint.className = 'row-hint';
    hint.textContent = 'Swipe to explore →';
    row.parentNode.insertBefore(hint, row);
    if (!row.id) row.id = 'browseRow' + index;
    var controls = document.createElement('div');
    controls.className = 'row-controls';
    var previous = document.createElement('button');
    var next = document.createElement('button');
    var position = document.createElement('span');
    previous.type = next.type = 'button';
    previous.textContent = '← Previous';
    next.textContent = 'Next →';
    previous.setAttribute('aria-label', 'Previous: ' + group[1]);
    next.setAttribute('aria-label', 'Next: ' + group[1]);
    previous.setAttribute('aria-controls', row.id);
    next.setAttribute('aria-controls', row.id);
    position.setAttribute('aria-live', 'polite');
    controls.append(previous, position, next);
    row.parentNode.insertBefore(controls, row);
    function activeCard() {
      var left = row.getBoundingClientRect().left + 8;
      var cards = Array.from(row.children);
      return cards.reduce(function (nearest, card, cardIndex) {
        return Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[nearest].getBoundingClientRect().left - left) ? cardIndex : nearest;
      }, 0);
    }
    function updateControls() {
      var active = activeCard();
      position.textContent = (active + 1) + ' of ' + row.children.length;
      previous.disabled = row.scrollLeft <= 2;
      next.disabled = row.scrollLeft >= row.scrollWidth - row.clientWidth - 2;
    }
    function moveCard(direction) {
      var cards = Array.from(row.children);
      var target = cards[Math.max(0, Math.min(cards.length - 1, activeCard() + direction))];
      row.scrollTo({ left: row.scrollLeft + target.getBoundingClientRect().left - row.getBoundingClientRect().left - 8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    previous.addEventListener('click', function () { moveCard(-1); });
    next.addEventListener('click', function () { moveCard(1); });
    row.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls);
    var syncRowAccess = function () {
      if (compactRows.matches) {
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-describedby', hint.id);
      } else {
        row.removeAttribute('tabindex');
        row.removeAttribute('aria-describedby');
      }
      updateControls();
    };
    syncRowAccess();
    compactRows.addEventListener('change', syncRowAccess);
  });
  var legacySections = { vetting: 'tutors.html', rigor: 'tutors.html', pricing: 'pricing.html', 'confidence-week': 'pricing.html', trust: 'reviews.html', faq: 'faq.html', 'child-protection': 'privacy.html', 'from-founder': 'about.html', 'free-resource': 'resources.html', contact: 'contact.html' };
  function redirectLegacySection() {
    var incomingSection = window.location.hash.slice(1);
    if (!document.getElementById(incomingSection) && Object.prototype.hasOwnProperty.call(legacySections, incomingSection)) {
      window.location.replace(legacySections[incomingSection] + window.location.hash);
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', redirectLegacySection);
  if (redirectLegacySection()) return;

  /* ------------------------------------------------------------------
     CONTACT DETAILS — the only place you need to edit these.
     If you change the WhatsApp number here, also update the three
     href="https://wa.me/..." links in the HTML above; those are the
     fallback used if JavaScript is blocked.
  ------------------------------------------------------------------ */
  var WHATSAPP_NUMBER = '2349130436121';           // country code, no + or spaces
  var CONTACT_EMAIL   = 'hellobeyondclass@gmail.com';
  var WHATSAPP_TEXT   = 'Hi! I would like to book a free trial math lesson for my child.';

  var whatsappLink = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(WHATSAPP_TEXT);

  ['navWhatsapp', 'mobileWhatsapp', 'heroWhatsapp'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.href = whatsappLink;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
  });

  /* ---------------------------------------------------------------- */
  /* Nav background on scroll                                          */
  /* ---------------------------------------------------------------- */
  var siteNav = document.getElementById('siteNav');
  if (siteNav) {
    var measureNav = function () {
      document.documentElement.style.setProperty('--nav-h', Math.ceil(siteNav.getBoundingClientRect().height) + 'px');
    };
    measureNav();
    if ('ResizeObserver' in window) new ResizeObserver(measureNav).observe(siteNav);
    var navTicking = false;
    var updateNavBg = function () {
      siteNav.classList.toggle('scrolled', window.scrollY > 40);
      navTicking = false;
    };
    updateNavBg();
    window.addEventListener('scroll', function () {
      if (!navTicking) {
        navTicking = true;
        window.requestAnimationFrame(updateNavBg);
      }
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Mobile menu                                                       */
  /* ---------------------------------------------------------------- */
  var burger = document.getElementById('burgerBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  var closeMenuBtn = document.getElementById('closeMenuBtn');

  if (burger && mobileMenu && closeMenuBtn) {
    // Everything that sits behind the menu, hidden from assistive tech while open.
    var backdropEls = [siteNav, document.getElementById('main'), document.querySelector('footer')]
      .filter(Boolean);

    var getFocusableMenuEls = function () {
      return Array.prototype.slice
        .call(mobileMenu.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return el.offsetParent !== null; });
    };

    var setBackdropHidden = function (hidden) {
      backdropEls.forEach(function (el) {
        if (hidden) {
          el.setAttribute('aria-hidden', 'true');
          el.inert = true;
        } else {
          el.removeAttribute('aria-hidden');
          el.inert = false;
        }
      });
    };

    var openMenu = function () {
      mobileMenu.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');   // stops the page scrolling behind it
      setBackdropHidden(true);
      var focusables = getFocusableMenuEls();
      if (focusables.length) focusables[0].focus();
    };

    var closeMenu = function () {
      if (!mobileMenu.classList.contains('open')) return;
      mobileMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      setBackdropHidden(false);
      burger.focus();
    };

    burger.addEventListener('click', openMenu);
    closeMenuBtn.addEventListener('click', closeMenu);

    mobileMenu.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Escape closes the menu; Tab is trapped inside it while open.
    mobileMenu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.key !== 'Tab') return;

      var focusables = getFocusableMenuEls();
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Rotating to landscape or widening the window must not leave the
    // full-screen menu stuck over the desktop layout.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  /* ---------------------------------------------------------------- */
  /* FAQ accordion                                                     */
  /* ---------------------------------------------------------------- */
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      if (!item) return;
      var willOpen = !item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        if (openItem === item) return;
        openItem.classList.remove('open');
        var openBtn = openItem.querySelector('.faq-question');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      });

      item.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });

  /* ---------------------------------------------------------------- */
  /* Scroll-in reveals                                                 */
  /* ---------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ---------------------------------------------------------------- */
  /* Background video: silent autoplay, a pause control, and motion preferences. */
  document.querySelectorAll('[data-background-video]').forEach(function (button) {
    var video = document.getElementById(button.getAttribute('data-background-video'));
    if (!video) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var saveData = navigator.connection && navigator.connection.saveData;
    var inView = false, userPaused = false, userStarted = false;
    video.muted = true;
    button.removeAttribute('aria-pressed');
    if (saveData) video.preload = 'none';
    function updateButton() {
      button.textContent = video.paused ? 'Play video' : 'Pause video';
      button.setAttribute('aria-label', video.paused ? 'Play background video' : 'Pause background video');
    }
    function syncPlayback() {
      if (!document.hidden && inView && !userPaused && (userStarted || (!reduced.matches && !saveData))) {
        video.play().catch(updateButton);
      } else video.pause();
    }
    video.addEventListener('play', updateButton);
    video.addEventListener('pause', updateButton);
    video.addEventListener('error', function () { button.disabled = true; button.textContent = 'Video unavailable'; });
    button.addEventListener('click', function () {
      if (video.paused) { userStarted = true; userPaused = false; inView = true; }
      else { userPaused = true; userStarted = false; }
      syncPlayback();
    });
    document.addEventListener('visibilitychange', syncPlayback);
    reduced.addEventListener('change', function () { userStarted = false; syncPlayback(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
        syncPlayback();
      }, { threshold: [0, .15] }).observe(video);
    } else { inView = true; syncPlayback(); }
    updateButton();
  });

  /* Triangle angles tool                                              */
  /* ---------------------------------------------------------------- */
  (function () {
    var svg = document.getElementById('triCanvas');
    var triangle = document.getElementById('triShape');
    if (!svg || !triangle) return;

    var MIN_GAP = 40;        // keeps two corners from landing on top of each other
    var EDGE_PAD = 26;       // keeps a corner inside the drawing area
    var KEY_STEP = 10;       // arrow-key nudge, in viewBox units

    var points = {
      A: { el: document.getElementById('triPointA'), text: document.getElementById('triTextA'), out: document.getElementById('triEqA'), x: 140, y: 300 },
      B: { el: document.getElementById('triPointB'), text: document.getElementById('triTextB'), out: document.getElementById('triEqB'), x: 560, y: 300 },
      C: { el: document.getElementById('triPointC'), text: document.getElementById('triTextC'), out: document.getElementById('triEqC'), x: 350, y: 80 }
    };
    var keys = ['A', 'B', 'C'];

    // Bail out rather than throw if any piece of the markup is missing.
    var complete = keys.every(function (k) {
      return points[k].el && points[k].text && points[k].out;
    });
    if (!complete) return;

    var handles = {};
    svg.querySelectorAll('.tri-handle').forEach(function (h) {
      handles[h.getAttribute('data-vertex')] = h;
    });

    var distance = function (p1, p2) {
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    };

    // acos() is fed a value that floating-point error can push just outside
    // [-1, 1], which would return NaN — so clamp it first.
    var angleAt = function (opposite, side1, side2) {
      if (side1 === 0 || side2 === 0) return 60;
      var cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
      return Math.acos(Math.min(1, Math.max(-1, cos))) * (180 / Math.PI);
    };

    function calculateAngles() {
      var a = distance(points.B, points.C);
      var b = distance(points.A, points.C);
      var c = distance(points.A, points.B);

      var exact = {
        A: angleAt(a, b, c),
        B: angleAt(b, a, c),
        C: angleAt(c, a, b)
      };

      // Normalise away floating-point drift, then round with the
      // largest-remainder method. The three displayed values add up to
      // exactly 180 AND each one stays within half a degree of the true
      // angle. (Rounding two and subtracting for the third, as before, let
      // the third value drift by up to a full degree.)
      var total = exact.A + exact.B + exact.C;
      if (!isFinite(total) || total <= 0) return { A: 60, B: 60, C: 60 };

      var scaled = {}, floors = {}, sum = 0;
      keys.forEach(function (k) {
        scaled[k] = exact[k] * (180 / total);
        floors[k] = Math.floor(scaled[k]);
        sum += floors[k];
      });

      var order = keys.slice().sort(function (p, q) {
        return (scaled[q] - floors[q]) - (scaled[p] - floors[p]);
      });
      for (var i = 0; i < 180 - sum; i++) floors[order[i % 3]] += 1;

      return floors;
    }

    function updateVisuals() {
      triangle.setAttribute('points', keys.map(function (k) {
        return points[k].x + ',' + points[k].y;
      }).join(' '));

      var angles = calculateAngles();
      var centerX = (points.A.x + points.B.x + points.C.x) / 3;
      var centerY = (points.A.y + points.B.y + points.C.y) / 3;

      keys.forEach(function (k) {
        var p = points[k];
        p.el.setAttribute('cx', p.x);
        p.el.setAttribute('cy', p.y);
        if (handles[k]) {
          handles[k].setAttribute('cx', p.x);
          handles[k].setAttribute('cy', p.y);
          handles[k].setAttribute('aria-label',
            'Corner ' + k + ', ' + angles[k] + ' degrees. Use the arrow keys to move it.');
        }

        // Nudge the label in from the corner, toward the middle of the shape.
        var dx = centerX - p.x;
        var dy = centerY - p.y;
        var dist = Math.hypot(dx, dy) || 1;
        p.text.setAttribute('x', p.x + (dx / dist) * 38);
        p.text.setAttribute('y', p.y + (dy / dist) * 38);
        p.text.textContent = angles[k] + '\u00B0';
        p.out.textContent = angles[k] + '\u00B0';
      });
    }

    // Constrain a proposed position: inside the canvas, and not sitting
    // on top of either of the other two corners.
    function placeVertex(key, x, y) {
      var vb = svg.viewBox.baseVal;
      var nx = Math.min(vb.x + vb.width - EDGE_PAD, Math.max(vb.x + EDGE_PAD, x));
      var ny = Math.min(vb.y + vb.height - EDGE_PAD, Math.max(vb.y + EDGE_PAD, y));

      var tooClose = keys.some(function (k) {
        return k !== key && Math.hypot(nx - points[k].x, ny - points[k].y) < MIN_GAP;
      });
      if (tooClose) return false;

      // Keep a visible height above the opposite edge, even when dragging
      // almost onto it. A straight line has no triangle interior angles.
      var others = keys.filter(function (k) { return k !== key; });
      var a = points[others[0]], b = points[others[1]];
      var height = Math.abs((b.x - a.x) * (ny - a.y) - (b.y - a.y) * (nx - a.x)) / distance(a, b);
      if (height < 10) return false;

      points[key].x = nx;
      points[key].y = ny;
      return true;
    }

    function toSvgPoint(clientX, clientY) {
      var ctm = svg.getScreenCTM();
      if (!ctm) return null;               // SVG not laid out yet — don't throw
      var pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      return pt.matrixTransform(ctm.inverse());
    }

    var activeKey = null;

    keys.forEach(function (k) {
      var handle = handles[k];
      if (!handle) return;

      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        activeKey = k;
        handle.classList.add('is-active');
        if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', function (e) {
        if (activeKey !== k) return;
        e.preventDefault();
        var p = toSvgPoint(e.clientX, e.clientY);
        if (!p) return;
        if (placeVertex(k, p.x, p.y)) updateVisuals();
      });

      var release = function (e) {
        if (activeKey !== k) return;
        activeKey = null;
        handle.classList.remove('is-active');
        if (handle.releasePointerCapture && e.pointerId !== undefined) {
          try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
        }
      };
      handle.addEventListener('pointerup', release);
      handle.addEventListener('pointercancel', release);

      // Keyboard equivalent of dragging.
      handle.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
        var dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else return;
        e.preventDefault();
        if (placeVertex(k, points[k].x + dx, points[k].y + dy)) updateVisuals();
      });
    });

    function triangleArea(p) {
      return Math.abs(
        (p.B.x - p.A.x) * (p.C.y - p.A.y) - (p.C.x - p.A.x) * (p.B.y - p.A.y)
      ) / 2;
    }

    function randomizeTriangle() {
      var vb = svg.viewBox.baseVal;
      var margin = 60;
      var w = vb.width - margin * 2;
      var h = vb.height - margin * 2;
      var minArea = w * h * 0.14;

      var best = null;
      var bestArea = -1;

      // Take the roomiest of 40 candidates rather than the first one that
      // clears the bar, so a run of unlucky draws can't produce a sliver.
      for (var i = 0; i < 40; i++) {
        var candidate = {
          A: { x: margin + Math.random() * w, y: margin + Math.random() * h },
          B: { x: margin + Math.random() * w, y: margin + Math.random() * h },
          C: { x: margin + Math.random() * w, y: margin + Math.random() * h }
        };
        var area = triangleArea(candidate);
        if (area > bestArea) { bestArea = area; best = candidate; }
        if (area >= minArea) break;
      }

      keys.forEach(function (k) {
        points[k].x = best[k].x;
        points[k].y = best[k].y;
      });
      updateVisuals();
    }

    var randomizeBtn = document.getElementById('triRandomize');
    if (randomizeBtn) randomizeBtn.addEventListener('click', randomizeTriangle);

    updateVisuals();
  })();

  /* ---------------------------------------------------------------- */
  /* Footer year                                                       */
  /* ---------------------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------------- */
  /* Plan buttons carry their plan name into the booking form          */
  /* ---------------------------------------------------------------- */
  var planSelect = document.getElementById('planInterest');
  function updateBookingPrice() {
    var summary = document.getElementById('bookingPlanPrice');
    var plans = window.BEYONDCLASS_PLANS;
    if (!summary || !plans || !planSelect) return;
    var selected = Object.prototype.hasOwnProperty.call(plans, planSelect.value) && plans[planSelect.value];
    summary.textContent = selected
      ? '$' + selected.USD.toLocaleString('en-US') + ' / ' + selected.period + ' · ₦' + selected.NGN.toLocaleString('en-NG') + ' / ' + selected.period
      : 'Not sure yet? We’ll help you choose a plan during your free trial.';
  }
  if (planSelect) {
    var requestedPlan = new URLSearchParams(window.location.search).get('plan');
    if (Array.from(planSelect.options).some(function (option) { return option.value === requestedPlan; })) {
      planSelect.value = requestedPlan;
    }
    planSelect.addEventListener('change', updateBookingPrice);
    updateBookingPrice();
  }
  document.querySelectorAll('a[data-plan]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (planSelect) { planSelect.value = btn.getAttribute('data-plan'); updateBookingPrice(); }
    });
  });

  /* ---------------------------------------------------------------- */
  /* Parent requests are saved directly to the website inbox.          */
  /* ---------------------------------------------------------------- */
  function wireRequestForm(formId, statusId, build) {
    var form = document.getElementById(formId);
    var statusEl = document.getElementById(statusId);
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!form.reportValidity() || form.getAttribute('aria-busy') === 'true') return;
      var button = form.querySelector('button[type="submit"]');
      var originalLabel = button.textContent;
      statusEl.classList.add('visible');
      statusEl.textContent = 'Sending your request…';
      if (window.location.protocol === 'file:') {
        statusEl.textContent = 'Please open the live website to send your request, or email ' + CONTACT_EMAIL + '.';
        return;
      }
      var payload = build();
      var requestPayload = JSON.stringify(payload);
      if (!form.dataset.requestToken || form.dataset.requestPayload !== requestPayload) {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        form.dataset.requestToken = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
        form.dataset.requestPayload = requestPayload;
      }
      payload.requestToken = form.dataset.requestToken;
      var trap = form.querySelector('[name="website"]');
      payload.website = trap ? trap.value : '';
      form.setAttribute('aria-busy', 'true');
      button.disabled = true;
      button.textContent = 'Sending…';
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 12000);
      try {
        var response = await fetch('/api/requests', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: controller.signal
        });
        var result = await response.json().catch(function () { return null; });
        if (!response.ok || !result || result.ok !== true || !result.reference) {
          throw new Error(result && result.error ? result.error : 'Your request could not be saved. Please try again.');
        }
        var editedWhileSending = JSON.stringify(build()) !== requestPayload;
        if (!editedWhileSending) {
          form.reset();
          if (formId === 'bookingForm') updateBookingPrice();
        }
        delete form.dataset.requestToken;
        delete form.dataset.requestPayload;
        statusEl.textContent = (payload.kind === 'payment'
          ? 'Your ' + payload.currency + ' transfer notice for ' + payload.plan + ' has been saved. We’ll verify the money arrived and email you at ' + payload.email + '. This is not a payment confirmation.'
          : payload.kind === 'materials'
          ? 'Your materials request has been received. We’ll email your learning materials to ' + payload.email + ' within 48 hours.'
          : 'Your trial request has been received. We’ll contact you at ' + payload.email + ' to arrange a lesson.') + ' Reference: ' + result.reference;
        if (editedWhileSending) statusEl.textContent += ' Your later edits are still in the form and have not been sent.';
      } catch (error) {
        statusEl.textContent = error.name === 'AbortError'
          ? 'We couldn’t confirm delivery in time. Please try again; retrying the same request will not create a duplicate.'
          : error.name === 'TypeError'
            ? 'We couldn’t connect. Please check your connection and try again.'
            : error.message || 'We couldn’t send your request. Please try again.';
      } finally {
        clearTimeout(timeout);
        form.removeAttribute('aria-busy');
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
    form.querySelector('button[type="submit"]').disabled = false;
  }

  var valueOf = function (id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  wireRequestForm('bookingForm', 'formStatus', function () {
    return {
      kind: 'trial', name: valueOf('parentName'), email: valueOf('email'),
      grade: valueOf('studentGrade'), curriculum: valueOf('curriculum'),
      plan: valueOf('planInterest'), message: valueOf('message'),
      timeZone: valueOf('bookingTimeZone'), availability: valueOf('bookingAvailability')
    };
  });

  wireRequestForm('freeResourceForm', 'frStatus', function () {
    return {
      kind: 'materials', email: valueOf('frEmail'), grade: valueOf('frGrade'), topic: valueOf('frTopic')
    };
  });
  wireRequestForm('transferNoticeForm', 'transferNoticeStatus', function () {
    return {
      kind: 'payment', name: valueOf('transferParentName'), email: valueOf('transferEmail'),
      plan: valueOf('checkoutPlan'), currency: valueOf('checkoutCurrency'), amount: valueOf('transferAmount'),
      transferReference: valueOf('transferReference'), message: valueOf('transferMessage')
    };
  });
})();
