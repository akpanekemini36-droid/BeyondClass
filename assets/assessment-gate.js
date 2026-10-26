(function () {
  'use strict';
  var form = document.getElementById('assessmentAccess'), input = document.getElementById('accessCode'), status = document.getElementById('accessStatus'), submit = document.getElementById('unlockAssessment'), reveal = document.getElementById('showAccessCode');
  if (!form) return;
  reveal.addEventListener('change', function () { input.type = reveal.checked ? 'text' : 'password'; });
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (submit.disabled) return;
    submit.disabled = true; status.textContent = 'Checking your code…';
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch('/assessment/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: input.value }), credentials: 'same-origin', signal: controller.signal });
      var result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Please try again.');
      input.value = ''; status.textContent = 'Unlocked. Opening your assessment…'; window.location.assign('/assessment/start');
    } catch (error) { status.textContent = error.name === 'AbortError' ? 'The connection took too long. Please try again.' : error.message === 'Failed to fetch' ? 'Could not connect. Check your connection and try again.' : error.message; submit.disabled = false; }
    finally { clearTimeout(timer); }
  });
  submit.disabled = false;
})();
