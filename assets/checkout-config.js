/* Paste your Stripe Payment Link for each plan and currency below.
   The price, currency and billing period on Stripe must match your offer.
   Leave unavailable combinations blank. Never put Stripe secret keys here. */
window.BEYONDCLASS_CHECKOUT = {
  bankAccounts: {
    USD: {
      provider: 'Cleva', accountName: 'Ekemini Itoro Akpan', bankName: 'Lead Bank',
      accountNumber: '212966404958', routingNumber: '101019644', accountType: 'Personal Checking',
      accountAddress: '9450 Southwest Gemini Drive, Beaverton, OR, 97008, USA'
    },
    NGN: {
      provider: 'OPay', accountName: 'EKEMINI ITORO AKPAN', bankName: 'OPay Digital Services Limited(OPay)',
      accountNumber: '9130436121'
    }
  },
  paymentLinks: {
    Essential: { USD: '', NGN: '' },
    Growth: { USD: '', NGN: '' },
    Ultra: { USD: '', NGN: '' },
    'Confidence Week': { USD: '', NGN: '' }
  }
};
