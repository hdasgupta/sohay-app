/** Guess a default dose from the medicine name */
export function guessDose(name) {
  const n = String(name || '').trim().toLowerCase();
  if (/(tablets?|capsules?|tab|cap)$/.test(n)) return '1 pcs';
  if (/(syrup|suspension|solution|elixir|syp)$/.test(n)) return '10 ml';
  if (/(drops?)$/.test(n)) return '2 drops';
  if (/(injection|inj)$/.test(n)) return '1 ml';
  if (/(cream|gel|ointment|lotion)$/.test(n)) return 'Apply a thin layer';
  if (/(inhaler|rotacap|respules?)$/.test(n)) return '1 puff';
  if (/(sachet|powder|granules)$/.test(n)) return '1 sachet';
  return '';
}

export function timingSummary(it) {
  const t = [];
  if (it.morning) t.push('Morning');
  if (it.afternoon) t.push('Afternoon');
  if (it.evening) t.push('Evening');
  if (it.night) t.push('Night');
  if (it.sos) t.push('SOS');
  return t.join(' · ');
}
