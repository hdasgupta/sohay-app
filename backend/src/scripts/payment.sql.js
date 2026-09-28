export const PAYMENT_SQL = Object.freeze({
  EXPIRE_STALE_HOLDS: `
    UPDATE payments
       SET status = $1,
           slot_hold_active = $2,
           updated_at = now()
     WHERE slot_hold_active = $3
       AND expires_at <= now()
       AND status = ANY($4::varchar[])
    RETURNING id`,

  ACTIVE_DOCTOR_HOLD: `
    SELECT id, appointment_id, patient_id, doctor_id, booked_by,
           appointment_date, start_time, end_time,
           amount_paise, currency,
           razorpay_order_id, razorpay_payment_id,
           status, expires_at
      FROM payments
     WHERE doctor_id = $1
       AND appointment_date = $2::date
       AND start_time = $3::time
       AND slot_hold_active = $4
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT $5`,

  ACTIVE_PATIENT_DOCTOR_HOLD: `
    SELECT id, patient_id, doctor_id, booked_by,
           appointment_date, start_time, end_time,
           razorpay_order_id, status, expires_at
      FROM payments
     WHERE patient_id = $1
       AND doctor_id = $2
       AND slot_hold_active = $3
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT $4`,

  INSERT_PAYMENT: `
    INSERT INTO payments (
      patient_id,
      doctor_id,
      booked_by,
      appointment_date,
      start_time,
      end_time,
      amount_paise,
      currency,
      status,
      slot_hold_active,
      expires_at
    )
    VALUES (
      $1, $2, $3, $4::date, $5::time, $6::time,
      $7, $8, $9, $10,
      now() + make_interval(mins => $11)
    )
    RETURNING id, expires_at`,

  BY_ORDER_ID: `
    SELECT *
      FROM payments
     WHERE razorpay_order_id = $1
     LIMIT $2`,

  BY_ID_FOR_UPDATE: `
    SELECT *
      FROM payments
     WHERE id = $1
     FOR UPDATE`,

  UPDATE_RAZORPAY_ORDER: `
    UPDATE payments
       SET razorpay_order_id = $2,
           updated_at = now()
     WHERE id = $1
    RETURNING *`,

  MARK_CAPTURED: `
    UPDATE payments
       SET appointment_id = $2,
           razorpay_payment_id = $3,
           razorpay_signature = COALESCE($4, razorpay_signature),
           status = $5,
           slot_hold_active = $6,
           updated_at = now()
     WHERE id = $1
    RETURNING *`,

  MARK_FAILED: `
    UPDATE payments
       SET razorpay_payment_id = COALESCE($2, razorpay_payment_id),
           status = $3,
           slot_hold_active = $4,
           failure_code = $5,
           failure_description = $6,
           updated_at = now()
     WHERE id = $1
    RETURNING *`,

  MARK_REFUNDED: `
    UPDATE payments
       SET status = $2,
           slot_hold_active = $3,
           updated_at = now()
     WHERE id = $1
    RETURNING *`,

  WEBHOOK_BY_EVENT_ID: `
    SELECT id, event_id, event_type, processed
      FROM payment_webhook_events
     WHERE event_id = $1
     LIMIT $2`,

  WEBHOOK_INSERT: `
    INSERT INTO payment_webhook_events (
      event_id,
      event_type,
      payload
    )
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id`,

  WEBHOOK_MARK_PROCESSED: `
    UPDATE payment_webhook_events
       SET processed = $2,
           processed_at = now(),
           error_message = NULL
     WHERE event_id = $1`,

  WEBHOOK_MARK_FAILED: `
    UPDATE payment_webhook_events
       SET processed = $2,
           error_message = $3
     WHERE event_id = $1`,
});
