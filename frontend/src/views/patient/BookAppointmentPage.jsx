import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import Dropdown from "../../components/Dropdown/Dropdown.jsx";
import DatePicker from "../../components/DatePicker/DatePicker.jsx";
import AppointmentCard from "../../components/AppointmentCard/AppointmentCard.jsx";
import {
  listDoctors,
  members as fetchMembers,
  slots as fetchSlots,
  createPaymentOrder,
  verifyPayment,
} from "../../api/patientApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/eventBus.js";
import {
  addDaysIso,
  todayIso,
  slotLabel,
  formatTime,
} from "../../utils/date.js";
import { BOOKING_WINDOW_DAYS, WEEKDAYS_SHORT } from "../../config/constants.js";
import "./BookAppointmentPage.css";
import {
  openRazorpayCheckout,
} from "../../utils/razorpay.js";

export default function BookAppointmentPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [family, setFamily] = useState(null);
  const [memberList, setMemberList] = useState([]);
  const [member, setMember] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState(null);
  const [slotList, setSlotList] = useState([]);
  const [slot, setSlot] = useState(null);
  const [booked, setBooked] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    listDoctors()
      .then(({ data }) => setDoctors(data))
      .catch(() => {});
    fetchMembers()
      .then(({ data }) => {
        setFamily(data.family);
        setMemberList(data.members);
        setMember(
          data.members.find((m) => m.id === user.id) || data.members[0] || null,
        );
      })
      .catch(() => {});
  }, [user.id]);

  const patientId = member?.id || user.id;

  const loadSlots = async (d, iso, pid) => {
    setSlot(null);
    setSlotList([]);
    if (!d || !iso) return;
    try {
      const { data } = await fetchSlots(d.id, iso, pid);
      setSlotList(data);
      if (data.length === 0)
        notify.warning("No free slot on this date. Please choose another date");
    } catch {
      /* shown */
    }
  };

  const chooseMember = (m) => {
    setMember(m);
    loadSlots(doctor, date, m.id);
  };
  const chooseDoctor = (d) => {
    setDoctor(d);
    setBooked(null);
    const keep =
      date && d.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    if (!keep) {
      setDate(null);
      setSlotList([]);
      setSlot(null);
    } else loadSlots(d, date, patientId);
  };
  const chooseDate = (iso) => {
    setDate(iso);
    setBooked(null);
    loadSlots(doctor, iso, patientId);
  };

  const submit = async (e) => {
    e.preventDefault();

    if (
      !doctor ||
      !date ||
      !slot
    ) {
      notify.warning(
        "Please choose the doctor, date and slot",
      );
      return;
    }

    if (paying) return;

    setPaying(true);

    try {
      const {
        data: order,
      } =
      await createPaymentOrder({
        doctorId:
          doctor.id,
        date,
        startTime:
          slot,
        patientId,
      });

      const payment =
        await openRazorpayCheckout(
        order,
      );

      if (
        !payment?.razorpay_payment_id ||
        !payment?.razorpay_order_id ||
        !payment?.razorpay_signature
      ) {
        throw new Error(
          "Razorpay did not return a valid payment response",
        );
      }

      const {
        data,
        message,
      } =
        await verifyPayment({
          orderId:
            payment.razorpay_order_id,
          paymentId:
            payment.razorpay_payment_id,
          signature:
            payment.razorpay_signature,
        });

      notify.success(
        message ||
          "Payment successful and appointment confirmed",
      );

      setBooked(
        data.appointment,
      );

      setSlot(null);

      loadSlots(
        doctor,
        date,
        patientId,
      );
    } catch (err) {
      const message =
        String(
          err?.message || "",
        );

      if (
        /cancel|dismiss/i.test(
          message,
        )
      ) {
        notify.info(
          "Payment was cancelled",
        );
      }

      // The API/client error handler
      // already shows backend errors.
      loadSlots(
        doctor,
        date,
        patientId,
      );
    } finally {
      setPaying(false);
    }
  };

  const today = todayIso();
  const firstBookableDate = addDaysIso(today, 1);
  const weekdays = useMemo(() => doctor?.weekdays || [], [doctor]);

  return (
    <div className="book">
      <div className="page-title">
        <div>
          <h1>Book an appointment</h1>
          <p>
            Consultations are 30 minute secure video calls. A confirmation with
            the meeting link is emailed to you.
          </p>
        </div>
      </div>
      <div className="book-grid">
        <form className="card book-form" onSubmit={submit} noValidate>
          {family && (
            <Dropdown
              label={`Patient (family: ${family.name})`}
              required
              options={memberList}
              labelProcessor={(m) =>
                m.id === user.id ? `${m.name} (me)` : m.name
              }
              selected={member}
              onOptionSelected={chooseMember}
              placeholder="Select family member"
              id="bk-member"
            />
          )}
          <Dropdown
            label="Doctor"
            required
            options={doctors}
            labelProcessor={(d) => `${d.name} - ${d.speciality}`}
            selected={doctor}
            onOptionSelected={chooseDoctor}
            placeholder={
              doctors.length ? "Select doctor" : "No doctors available"
            }
            id="bk-doctor"
          />
          {doctor && (
            <div className="book-doc-days">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <span
                  key={d}
                  className={`book-day ${doctor.weekdays.includes(d) ? "book-day-on" : ""}`}
                >
                  {WEEKDAYS_SHORT[d]}
                </span>
              ))}
            </div>
          )}
          <DatePicker
            label="Date"
            required
            startDate={today}
            endDate={addDaysIso(today, BOOKING_WINDOW_DAYS)}
            enabledWeekDays={weekdays}
            value={date}
            onDateSelect={chooseDate}
            disabled={!doctor}
            placeholder={doctor ? "Select a date" : "Choose a doctor first"}
            id="bk-date"
            hint={`You can book from tomorrow up to ${BOOKING_WINDOW_DAYS} days in advance`}
          />
          <Dropdown
            label="Time slot (IST)"
            required
            options={slotList}
            keyProcessor={(s) => s}
            labelProcessor={(s) => slotLabel(date, s)}
            selected={slot}
            onOptionSelected={setSlot}
            disabled={!date || slotList.length === 0}
            placeholder={
              date
                ? slotList.length
                  ? `Select slot (${slotList.length} free)`
                  : "No free slot"
                : "Choose a date first"
            }
            id="bk-slot"
          />
          <div className="book-payment-summary">
            <strong>Consultation fee</strong>
            <span>
              ₹
              {Number(
                import.meta.env
                  .VITE_DISPLAY_APPOINTMENT_FEE ||
                  0,
              ).toLocaleString("en-IN")}
            </span>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!slot || paying}
          >
            {paying
              ? "Opening payment..."
              : "Pay & book appointment"}
          </button>
        </form>
        <aside className="stack">
          {booked ? (
            <div className="book-success">
              <h2>Appointment confirmed</h2>
              <AppointmentCard appointment={booked} viewer="patient" />
              <p className="small muted">
                Join from your appointment list up to 15 minutes before{" "}
                {formatTime(booked.startTime)} IST on the day, or use the link
                in the confirmation email.
              </p>
              <Link className="btn btn-accent" to="/patient/appointments">
                View my appointments
              </Link>
            </div>
          ) : (
            <div className="card book-tips">
              <h3>How it works</h3>
              <ol>
                <li>
                  Choose {family ? "the family member and " : ""}a doctor.
                </li>
                <li>Only the doctor's consultation days can be picked.</li>
                <li>
                  Free 30 minute slots are loaded live, so there are no clashes
                  with the doctor's or your other bookings.
                </li>
                <li>You receive an email with a secure in-app video link.</li>
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
