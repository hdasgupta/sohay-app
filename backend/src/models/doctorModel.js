export const toDoctorListItem = (row) => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  sex: row.sex,
  speciality: row.speciality,
  isDisabled: row.is_disabled,
  createdAt: row.created_at,
  availability: (row.availability || []).map((slot) => ({
    id: slot.id ? Number(slot.id) : undefined,
    weekday: Number(slot.weekday),
    startTime: slot.startTime,
    endTime: slot.endTime,
  })),
});

export const toDoctorOption = (row) => ({
  id: Number(row.id),
  name: row.name,
  speciality: row.speciality,
});
