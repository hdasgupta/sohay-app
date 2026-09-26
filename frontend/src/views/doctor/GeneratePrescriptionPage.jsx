import { useEffect, useRef, useState } from "react";
import Dropdown from "../../components/Dropdown/Dropdown.jsx";
import ToggleButton from "../../components/ToggleButton/ToggleButton.jsx";
import SignaturePad from "../../components/SignaturePad/SignaturePad.jsx";
import {
  todayAppointments,
  searchMedicines,
  profile as fetchProfile,
  saveSignature,
  createPrescription,
} from "../../api/doctorApi.js";
import { downloadPrescription } from "../../api/commonApi.js";
import { downloadPrescriptionInAndroid } from "../../api/androidApi.js";
import { FOOD_TIMINGS } from "../../config/constants.js";
import { notify } from "../../utils/eventBus.js";
import { guessDose, timingSummary } from "../../utils/medicine.js";
import { formatTime, formatDate, todayIso } from "../../utils/date.js";
import { saveBlob } from "../../utils/download.js";
import "./GeneratePrescriptionPage.css";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

const svg = (d) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    {d}
  </svg>
);
const TIMINGS = [
  {
    key: "morning",
    label: "Morning",
    icon: svg(
      <>
        <path d="M12 3v3M5.6 7.6l2 2M18.4 7.6l-2 2M3 17h18M7 17a5 5 0 0 1 10 0" />
      </>,
    ),
  },
  {
    key: "afternoon",
    label: "Afternoon",
    icon: svg(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
    ),
  },
  {
    key: "evening",
    label: "Evening",
    icon: svg(
      <>
        <path d="M3 17h18M7 17a5 5 0 0 1 10 0M12 9V6M9 4l3 2 3-2" />
      </>,
    ),
  },
  {
    key: "night",
    label: "Night",
    icon: svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  },
];
const EMPTY_ITEM = {
  medicineName: "",
  dose: "",
  instructions: "",
  morning: false,
  afternoon: false,
  evening: false,
  night: false,
  sos: false,
  foodTiming: null,
};

export default function GeneratePrescriptionPage() {
  const [appointments, setAppointments] = useState([]);
  const [appt, setAppt] = useState(null);
  const [age, setAge] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [editingSignature, setEditingSignature] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [item, setItem] = useState(EMPTY_ITEM);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [generated, setGenerated] = useState(null);
  const searchSeq = useRef(0);

  const loadToday = () =>
    todayAppointments()
      .then(({ data }) => setAppointments(data))
      .catch(() => {});
  useEffect(() => {
    loadToday();
    fetchProfile()
      .then(({ data }) => setDoctor(data))
      .catch(() => {});
  }, []);

  // debounced medicine search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const { data } = await searchMedicines(q);
        if (seq === searchSeq.current) {
          setResults(data);
          if (data.length === 0)
            notify.info(
              `No medicine found for "${q}". You can type the name directly in the medicine box`,
            );
        }
      } catch {
        /* shown */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const chooseAppointment = (a) => {
    setAppt(a);
    setAge(a.age ?? "");
    setItems([]);
    setNotes("");
    setItem(EMPTY_ITEM);
    setGenerated(null);
  };

  const pickMedicine = (m) => {
    setPicked(m);
    setItem((it) => ({
      ...it,
      medicineName: m.name,
      dose: guessDose(m.name) || it.dose,
    }));
  };

  const setField = (k) => (v) => setItem((it) => ({ ...it, [k]: v }));
  const onMedicineTyped = (v) =>
    setItem((it) => ({
      ...it,
      medicineName: v,
      dose: it.dose || guessDose(v),
    }));

  const hasTiming = TIMINGS.some((t) => item[t.key]) || item.sos;
  const canAdd =
    item.medicineName.trim() &&
    item.dose.trim() &&
    hasTiming &&
    item.foodTiming;

  const addItem = () => {
    if (!item.medicineName.trim()) {
      notify.warning("Please choose or type a medicine");
      return;
    }
    if (!item.dose.trim()) {
      notify.warning("Please enter the dose");
      return;
    }
    if (!hasTiming) {
      notify.warning(
        "Select at least one of morning, afternoon, evening, night or SOS",
      );
      return;
    }
    if (!item.foodTiming) {
      notify.warning("Please select before / with / after food");
      return;
    }
    setItems((list) => [
      ...list,
      {
        ...item,
        medicineName: item.medicineName.trim(),
        dose: item.dose.trim(),
        instructions: item.instructions.trim(),
        uid: `${Date.now()}-${list.length}`,
      },
    ]);
    setItem(EMPTY_ITEM);
    setPicked(null);
    setQuery("");
    setResults([]);
    notify.success("Medicine added to the prescription");
  };

  const removeItem = (uid) =>
    setItems((list) => list.filter((i) => i.uid !== uid));

  const storeSignature = async (sig) => {
    if (!sig) return;
    try {
      const { message } = await saveSignature(sig);
      notify.success(message || "Signature saved");
      setDoctor((d) => ({ ...d, signature: sig }));
      setEditingSignature(false);
    } catch {
      /* shown */
    }
  };

  const generate = async () => {
    if (!appt) {
      notify.warning("Please select a patient");
      return;
    }
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 130) {
      notify.warning("Please enter a valid age");
      return;
    }
    if (items.length === 0) {
      notify.warning("Please add at least one medicine");
      return;
    }
    if (!doctor?.signature) {
      notify.warning(
        "Please add your signature before generating the prescription",
      );
      return;
    }
    try {
      const { data, message } = await createPrescription({
        appointmentId: appt.appointmentId,
        patientAge: ageNum,
        notes: notes.trim(),
        items: items.map(({ uid, foodTiming, ...rest }) => ({
          ...rest,
          foodTiming: foodTiming.code,
        })),
      });
      notify.success(message || "Prescription generated");
      setGenerated({ ...data, patientName: appt.patientName });
      setAppointments((list) =>
        list.filter((a) => a.appointmentId !== appt.appointmentId),
      );
      setAppt(null);
      setItems([]);
      setNotes("");
      setAge("");
    } catch {
      /* shown */
    }
  };

  const download = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await downloadPrescriptionInAndroid(generated.appointmentId);
      } else {
        const blob = await downloadPrescription(generated.appointmentId);
        saveBlob(
          blob,
          `prescription-${todayIso()}-${generated.appointmentId}.pdf`,
        );
      }
    } catch {
      /* shown */
    }
  };

  return (
    <div className="rx">
      <div className="page-title">
        <div>
          <h1>Generate prescription</h1>
          <p>
            {formatDate(todayIso())} · patients with appointments today. A
            prescription can be generated once and completes the appointment.
          </p>
        </div>
      </div>

      {generated && (
        <div className="card rx-done" role="status">
          <div>
            <h2>Prescription ready for {generated.patientName}</h2>
            <p className="muted small">
              Saved securely and available to the patient in their appointment
              list.
            </p>
          </div>
          <button type="button" className="btn btn-success" onClick={download}>
            Download PDF
          </button>
        </div>
      )}

      <div className="rx-grid">
        <section className="card stack">
          <h2 className="rx-step">
            <span>1</span> Patient
          </h2>
          <Dropdown
            label="Today's patient"
            required
            options={appointments}
            keyProcessor={(a) => a.appointmentId}
            labelProcessor={(a) =>
              `${formatTime(a.startTime)} · ${a.patientName}`
            }
            selected={appt}
            onOptionSelected={chooseAppointment}
            placeholder={
              appointments.length
                ? "Select patient"
                : "No open appointments today"
            }
            id="rx-patient"
          />
          {appt && (
            <div className="rx-patient">
              <div className="field">
                <label htmlFor="rx-age" className="required">
                  Age (years)
                </label>
                <input
                  id="rx-age"
                  className="input"
                  type="number"
                  min="0"
                  max="130"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
                <span className="hint">
                  Calculated from date of birth{" "}
                  {appt.dateOfBirth ? `(${formatDate(appt.dateOfBirth)})` : ""}{" "}
                  - you can change it
                </span>
              </div>
              <div className="rx-pinfo">
                <span>
                  <span className="faint">Sex</span> {appt.patientSex || "-"}
                </span>
                <span>
                  <span className="faint">Slot</span>{" "}
                  {formatTime(appt.startTime)} - {formatTime(appt.endTime)} IST
                </span>
                <span>
                  <span className="faint">Email</span> {appt.patientEmail}
                </span>
              </div>
            </div>
          )}

          <h2 className="rx-step">
            <span>2</span> Add medicine
          </h2>
          <fieldset className="rx-medicine" disabled={!appt}>
            <div className="field">
              <label htmlFor="rx-search">Search medicine</label>
              <input
                id="rx-search"
                className="input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type at least 2 letters, e.g. Sertraline"
                autoComplete="off"
              />
            </div>
            <Dropdown
              label={`Search results${results.length ? ` (${results.length})` : ""}`}
              options={results}
              labelProcessor={(m) => m.name}
              selected={picked}
              onOptionSelected={pickMedicine}
              placeholder={
                query.trim().length < 2
                  ? "Search to see medicines"
                  : results.length
                    ? "Select medicine"
                    : "No results"
              }
              disabled={results.length === 0}
              id="rx-results"
            />
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="rx-name" className="required">
                  Medicine
                </label>
                <input
                  id="rx-name"
                  className="input"
                  value={item.medicineName}
                  onChange={(e) => onMedicineTyped(e.target.value)}
                  placeholder="Selected medicine appears here"
                />
              </div>
              <div className="field">
                <label htmlFor="rx-dose" className="required">
                  Dose
                </label>
                <input
                  id="rx-dose"
                  className="input"
                  value={item.dose}
                  onChange={(e) => setField("dose")(e.target.value)}
                  placeholder="e.g. 1 pcs, 10 ml"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="rx-instr">Other conditions / instructions</label>
              <input
                id="rx-instr"
                className="input"
                value={item.instructions}
                onChange={(e) => setField("instructions")(e.target.value)}
                placeholder="e.g. for 14 days, taper after a week"
              />
            </div>
            <div className="field">
              <span className="field-label required">When to take</span>
              <div className="rx-toggles">
                {TIMINGS.map((t) => (
                  <ToggleButton
                    key={t.key}
                    label={t.label}
                    icon={t.icon}
                    pressed={item[t.key]}
                    onToggle={setField(t.key)}
                  />
                ))}
                <ToggleButton
                  label="SOS"
                  icon={svg(
                    <>
                      <path d="M12 8v5M12 16h.01" />
                      <circle cx="12" cy="12" r="10" />
                    </>,
                  )}
                  tone="warning"
                  pressed={item.sos}
                  onToggle={setField("sos")}
                />
              </div>
            </div>
            <Dropdown
              label="Food"
              required
              options={FOOD_TIMINGS}
              labelProcessor={(f) => f.label}
              selected={item.foodTiming}
              onOptionSelected={setField("foodTiming")}
              placeholder="Before / with / after food"
              id="rx-food"
            />
            <button
              type="button"
              className="btn btn-accent"
              onClick={addItem}
              disabled={!canAdd}
            >
              + Add medicine
            </button>
          </fieldset>
        </section>

        <section className="card stack rx-preview">
          <h2 className="rx-step">
            <span>3</span> Prescription
          </h2>
          {items.length === 0 ? (
            <div className="empty-state">
              <strong>No medicines added</strong>Added medicines appear here.
            </div>
          ) : (
            <ol className="rx-items">
              {items.map((it, i) => (
                <li key={it.uid} className="rx-item" data-testid="rx-item">
                  <span className="rx-num">{i + 1}</span>
                  <div className="rx-item-body">
                    <strong>{it.medicineName}</strong>
                    <span className="small">
                      {it.dose} · {timingSummary(it)} · {it.foodTiming.label}
                    </span>
                    {it.instructions && (
                      <span className="small muted">{it.instructions}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rx-remove"
                    onClick={() => removeItem(it.uid)}
                    aria-label={`Remove ${it.medicineName}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="field">
            <label htmlFor="rx-notes">Advice / notes (optional)</label>
            <textarea
              id="rx-notes"
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lifestyle advice, follow-up, tests..."
              maxLength={2000}
            />
          </div>
          <div className="rx-signature">
            <div className="row row-between">
              <span className="field-label">Your signature</span>
              {doctor?.signature && !editingSignature && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingSignature(true)}
                >
                  Change
                </button>
              )}
            </div>
            {doctor?.signature && !editingSignature ? (
              <img
                className="rx-sig-img"
                src={doctor.signature}
                alt="Doctor signature"
              />
            ) : (
              <SignaturePad onChange={storeSignature} height={130} />
            )}
            {!doctor?.signature && (
              <p className="small rx-sig-warn">
                A signature is required on every prescription. Draw or upload it
                once, it is saved to your profile.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={generate}
            disabled={!appt || items.length === 0}
          >
            Generate prescription
          </button>
        </section>
      </div>
    </div>
  );
}
