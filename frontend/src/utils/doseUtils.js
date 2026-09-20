/**
 * Guesses the dose from the medicine name:
 *   ends with tablet / capsule -> "1 pcs"
 *   ends with syrup            -> "10 ml"
 * The doctor can freely edit whatever is guessed.
 */
export const guessDose = (medicineName) => {
  const name = String(medicineName || '').trim().toLowerCase();
  if (/(tablet|tablets|capsule|capsules)$/.test(name)) return '1 pcs';
  if (/(syrup|syrups)$/.test(name)) return '10 ml';
  return '1 pcs';
};

export const timingText = (medicine) => {
  const parts = [];
  if (medicine.morning) parts.push('Morning');
  if (medicine.afternoon) parts.push('Afternoon');
  if (medicine.evening) parts.push('Evening');
  if (medicine.night) parts.push('Night');
  if (medicine.sos) parts.push('SOS');
  return parts.length ? parts.join(', ') : 'Not set';
};

export const foodText = (value) =>
  ({ BEFORE_FOOD: 'Before food', WITH_FOOD: 'With food', AFTER_FOOD: 'After food' }[value] || value);
