/** Row -> api shape mappers for the users hierarchy. */
export const toAuthUser = (row) => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
  isDisabled: row.is_disabled,
});

export const toPatientProfile = (row) => ({
  ...toAuthUser(row),
  sex: row.sex,
  dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : null,
  contactNumber: row.contact_number,
  familyId: row.family_id ? Number(row.family_id) : null,
});

export const toDoctorProfile = (row) => ({
  ...toAuthUser(row),
  sex: row.sex,
  speciality: row.speciality,
});
