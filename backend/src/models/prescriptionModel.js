export const toPrescriptionMedicineRow = (medicine, position) => [
  medicine.medicineName,
  medicine.dose,
  medicine.conditionNote || null,
  Boolean(medicine.morning),
  Boolean(medicine.afternoon),
  Boolean(medicine.evening),
  Boolean(medicine.night),
  Boolean(medicine.sos),
  medicine.food,
  position,
];
