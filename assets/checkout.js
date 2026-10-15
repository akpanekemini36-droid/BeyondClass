(function () {
  'use strict';
  var form = document.getElementById('checkoutForm');
  if (!form) return;
  var planSelect = document.getElementById('checkoutPlan');
  var currencySelect = document.getElementById('checkoutCurrency');
  var button = document.getElementById('checkoutButton');
  var status = document.getElementById('checkoutStatus');
  var plans = {
    Starter: { USD: 21, NGN: 30000, period: 'lesson', detail: '1 lesson per week, 1 hour 30 minutes.' },
    Growth: { USD: 36, NGN: 50000, period: 'week', detail: '2 lessons per week, 1 hour 30 minutes each.' },
    Premium: { USD: 57, NGN: 80000, period: 'week', detail: '3 lessons per week, 1 hour 30 minutes each. Dedicated chat response staff and an optional monthly parent call.' },
    Flexible: { USD: 200, NGN: 280000, period: 'month', detail: '3 lessons per week for a month, 1 hour 30 minutes each, with all Premium benefits, flexible rescheduling and an optional monthly parent call.' },
    'Confidence Week': { USD: 19.99, NGN: 29999, period: 'deposit', detail: 'One week at the pace of your chosen plan. Deposit credited towards your first month if you enroll; half refunded if you decide not to continue.' }
  };
  var params = new URLSearchParams(window.location.search);
  if (Object.prototype.hasOwnProperty.call(plans, params.get('plan'))) planSelect.value = params.get('plan');
  if (['USD', 'NGN'].includes(params.get('currency'))) currencySelect.value = params.get('currency');

  function checkoutUrl() {
    var links = window.BEYONDCLASS_CHECKOUT && window.BEYONDCLASS_CHECKOUT.paymentLinks;
    var byCurrency = links && Object.prototype.hasOwnProperty.call(links, planSelect.value) && links[planSelect.value];
    var link = byCurrency && byCurrency[currencySelect.value];
    if (!link || typeof link !== 'string') return null;
    try {
      var url = new URL(link);
      if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password || url.port || url.pathname.length < 2) return null;
      return url.href;
    } catch (_) { return null; }
  }

  function updateSummary() {
    var plan = plans[planSelect.value];
    var currency = currencySelect.value;
    if (!plan || !['USD', 'NGN'].includes(currency)) return;
    document.getElementById('summaryPlan').textContent = planSelect.value;
    var fractionDigits = Number.isInteger(plan[currency]) ? 0 : 2;
    document.getElementById('summaryPrice').textContent = new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency', currency: currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits
    }).format(plan[currency]) + ' / ' + plan.period;
    document.getElementById('summaryDetail').textContent = plan.detail;
    document.getElementById('checkoutContact').href = 'contact.html?plan=' + encodeURIComponent(planSelect.value) + '#contact';
    var available = Boolean(checkoutUrl());
    button.disabled = !available;
    button.textContent = available ? 'Continue to Stripe checkout' : 'Online checkout coming soon';
    status.textContent = available
      ? 'Your payment will be handled by Stripe. Review the amount and billing details there before confirming.'
      : 'Online payments are not available for this selection yet. Contact us to arrange enrollment or book a free trial.';
  }

  planSelect.addEventListener('change', updateSummary);
  currencySelect.addEventListener('change', updateSummary);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var url = checkoutUrl();
    if (url) window.location.assign(url);
    else updateSummary();
  });
  updateSummary();
})();
