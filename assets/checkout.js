(function () {
  'use strict';
  var form = document.getElementById('checkoutForm');
  if (!form) return;
  var planSelect = document.getElementById('checkoutPlan');
  var currencySelect = document.getElementById('checkoutCurrency');
  var button = document.getElementById('checkoutButton');
  var status = document.getElementById('checkoutStatus');
  var lastTransferSelection;
  var plans = {
    Starter: { USD: 16.8, NGN: 24000, period: 'lesson', detail: 'One 90-minute lesson per payment, scheduled once per week.' },
    Growth: { USD: 28.8, NGN: 40000, period: 'week', detail: 'Two 90-minute lessons per weekly payment, with between-lesson support and detailed progress updates.' },
    Premium: { USD: 45.6, NGN: 64000, period: 'week', detail: 'Three 90-minute lessons per weekly payment, dedicated chat response staff and an optional monthly parent call.' },
    Flexible: { USD: 160, NGN: 224000, period: 'calendar month', detail: 'Three 90-minute lessons per week during the calendar month. Confirm the billing dates and exact lesson count before payment. All Premium benefits, flexible rescheduling, limited tutor-approved extra lessons and an optional monthly parent call.' },
    'Confidence Week': { USD: 19.99, NGN: 29999, period: 'deposit', detail: 'One week at your chosen plan’s pace: one, two or three lessons, with dates and count confirmed before payment. Deposit credited towards your first month if you enroll; half refunded if you decide not to continue.' }
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
    document.getElementById('selectedPaymentPrice').textContent = document.getElementById('summaryPrice').textContent;
    document.getElementById('bankSelectedPlan').textContent = planSelect.value;
    document.getElementById('bankSelectedAmount').textContent = document.getElementById('summaryPrice').textContent;
    document.getElementById('checkoutContact').href = 'contact.html?plan=' + encodeURIComponent(planSelect.value) + '#contact';
    var available = Boolean(checkoutUrl());
    button.disabled = !available;
    button.hidden = !available;
    document.getElementById('cardCheckoutDescription').hidden = !available;
    var account = window.BEYONDCLASS_CHECKOUT.bankAccounts[currency];
    document.getElementById('bankTransferCurrency').textContent = currency + ' bank transfer';
    document.getElementById('bankTransferHeading').textContent = 'Pay with the ' + account.provider + ' bank details.';
    document.getElementById('bankTransferInstructions').textContent = currency === 'USD'
      ? 'Copy these details into your bank or payment app and send US dollars by ACH or domestic wire. The transfer takes place in your bank app.'
      : 'Copy these details into your bank app, choose OPay Digital Services Limited (OPay), and send Nigerian naira. Check that the recipient name matches before confirming.';
    document.getElementById('bankAccountName').textContent = account.accountName;
    document.getElementById('bankName').textContent = account.bankName;
    document.getElementById('bankAccountNumber').textContent = account.accountNumber;
    document.getElementById('bankRoutingNumber').textContent = account.routingNumber || '';
    document.getElementById('bankAccountType').textContent = account.accountType || '';
    document.getElementById('bankAccountAddress').textContent = account.accountAddress || '';
    ['bankRoutingRow', 'bankAccountTypeRow', 'bankAddressRow', 'clevaGuidance'].forEach(function (id) {
      document.getElementById(id).hidden = currency !== 'USD';
    });
    document.getElementById('bankTransferNote').textContent = currency === 'USD'
      ? 'These details are for USD transfers only. If your bank asks for a SWIFT code, contact us before sending. Check any fees with your bank or payment provider.'
      : 'These OPay details are for NGN transfers only. Confirm your enrollment and billing period with us before paying.';
    document.getElementById('bankCopyStatus').textContent = '';
    document.getElementById('transferPlan').textContent = planSelect.value;
    document.getElementById('transferAmountLabel').textContent = 'Amount you sent (' + currency + ')';
    document.getElementById('transferAmount').max = currency === 'USD' ? '99999.99' : '99999999.99';
    if (lastTransferSelection !== planSelect.value + currency) {
      document.getElementById('transferAmount').value = plan[currency];
      document.getElementById('transferAmount').defaultValue = plan[currency];
      lastTransferSelection = planSelect.value + currency;
    }
    button.textContent = 'Continue to Stripe checkout';
    status.textContent = available
      ? 'Your payment will be handled by Stripe. Review the amount and billing details there before confirming.'
      : 'Pay by bank transfer using the ' + account.provider + ' details below. Confirm your enrollment and amount before transferring.';
  }

  planSelect.addEventListener('change', updateSummary);
  currencySelect.addEventListener('change', updateSummary);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var url = checkoutUrl();
    if (url) window.location.assign(url);
    else updateSummary();
  });
  document.querySelectorAll('[data-copy-target]').forEach(function (copyButton) {
    copyButton.disabled = false;
    copyButton.addEventListener('click', async function () {
      var target = document.getElementById(copyButton.dataset.copyTarget);
      var copyStatus = document.getElementById('bankCopyStatus');
      try {
        await navigator.clipboard.writeText(target.textContent.trim());
        copyStatus.textContent = copyButton.getAttribute('aria-label').replace(/^Copy /, '') + ' copied.';
      } catch (_) {
        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        copyStatus.textContent = 'Automatic copying is unavailable. The detail is selected; use your device’s Copy option.';
      }
    });
  });
  updateSummary();
})();
