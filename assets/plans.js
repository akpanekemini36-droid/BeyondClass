(function (root, factory) {
  'use strict';
  var plans = factory();
  if (typeof module === 'object' && module.exports) module.exports = plans;
  else root.BEYONDCLASS_PLANS = plans;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // Fixed published prices at NGN 1,400 per USD; Confidence Week stays separate.
  return Object.freeze({
    Essential: Object.freeze({ USD: 120, NGN: 168000, period: '4 weeks', detail: 'Two private 60-minute lessons per week: 8 lessons and 8 hours every four weeks. Homework guidance, a monthly progress report and foundational mathematics support.' }),
    Growth: Object.freeze({ USD: 160, NGN: 224000, period: '4 weeks', detail: 'Three private 90-minute lessons per week: 12 lessons and 18 hours every four weeks. Interactive tools, weekly parent updates, personalized practice, WhatsApp support and assessments every two months.' }),
    Ultra: Object.freeze({ USD: 350, NGN: 490000, period: '4 weeks', detail: 'Five private 90-minute lessons per week: 20 lessons and 30 hours every four weeks. Everything in Growth, plus priority scheduling, weekly assessments, advanced interactive tools, tailored exam preparation, individual learning plans and optional monthly parent strategy meetings.' }),
    'Confidence Week': Object.freeze({ USD: 19.99, NGN: 29999, period: 'deposit', detail: 'One week at your chosen plan’s pace: two, three or four lessons, with dates and count confirmed before payment. Deposit credited towards your first four-week package if you enroll; half refunded if you decide not to continue.' })
  });
});
