import { useEffect, useMemo, useState } from 'react';
import Dropdown from '../../components/Dropdown/Dropdown';
import Card, { CardRow } from '../../components/Card/Card';
import { doctorApi } from '../../api/doctorApi';
import { sharedApi } from '../../api/sharedApi';
import { useMessage } from '../../context/MessageContext';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { FOOD_OPTIONS } from '../../utils/constants';
import { calculateAge, prettyDate, todayISO } from '../../utils/dateUtils';
import { foodText, guessDose, timingText } from '../../utils/doseUtils';
import { formatTime } from '../../utils/slotUtils';
import './GeneratePrescriptionPage.css';

const emptyDraft = {
  medicineName: '',
  dose: '',
  conditionNote: '',
  morning: false,
  afternoon: false,
  evening: false,
  night: false,
  sos: false,
  food: 'AFTER_FOOD',
};

const TIMINGS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
];

const GeneratePrescriptionPage = () => {
  const [patients, setPatients] = useState([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [age, setAge] = useState('');
  const [advice, setAdvice] = useState('');
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [medicines, setMedicines] = useState([]);
  const [generated, setGenerated] = useState(null);
  const debouncedTerm = useDebouncedValue(term, 400);
  const messenger = useMessage();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await doctorApi.todayPatients();
        setPatients(data || []);
        console.log('[prescription] today patients =', data?.length);
        if (!data?.length) messenger.info('You have no appointment scheduled for today');
      } catch (error) {
        console.error('[prescription] could not load today patients', error.message);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debouncedTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const search = async () => {
      try {
        const data = await doctorApi.searchMedicines(debouncedTerm.trim());
        setSuggestions(data || []);
      } catch (error) {
        console.error('[prescription] medicine search failed', error.message);
      }
    };
    search();
  }, [debouncedTerm]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.appointmentId) === String(appointmentId)) || null,
    [patients, appointmentId],
  );

  const choosePatient = (patient) => {
    setAppointmentId(patient ? String(patient.appointmentId) : '');
    // Age is calculated from the date of birth but stays editable.
    setAge(patient ? String(patient.age ?? calculateAge(patient.dateOfBirth)) : '');
    setMedicines([]);
    setDraft(emptyDraft);
    setGenerated(null);
  };

  const pickMedicine = (medicine) => {
    setDraft((current) => ({ ...current, medicineName: medicine.name, dose: guessDose(medicine.name) }));
    setTerm('');
    setSuggestions([]);
    console.log('[prescription] medicine selected', medicine.name);
  };

  const toggle = (key) => setDraft((current) => ({ ...current, [key]: !current[key] }));

  const addMedicine = () => {
    if (!draft.medicineName.trim()) return messenger.warning('Search and select a medicine first');
    if (!draft.dose.trim()) return messenger.warning('Dose cannot be empty');
    const anyTiming = draft.morning || draft.afternoon || draft.evening || draft.night || draft.sos;
    if (!anyTiming) return messenger.warning('Choose at least one timing or mark the medicine as SOS');
    if (medicines.some((medicine) => medicine.medicineName === draft.medicineName.trim())) {
      return messenger.warning('This medicine has already been added');
    }
    setMedicines((current) => [...current, { ...draft, medicineName: draft.medicineName.trim(), dose: draft.dose.trim() }]);
    setDraft(emptyDraft);
    messenger.success('Medicine added to the prescription', 4);
    return undefined;
  };

  const removeMedicine = (index) => setMedicines((current) => current.filter((unused, position) => position !== index));

  const generate = async () => {
    if (!appointmentId) return messenger.warning('Choose a patient first');
    if (!age || Number(age) < 0) return messenger.warning('Age must be a valid number');
    if (medicines.length === 0) return messenger.warning('Add at least one medicine');

    try {
      const result = await doctorApi.generatePrescription({
        appointmentId,
        age: Number(age),
        advice: advice.trim() || undefined,
        medicines,
      });
      messenger.success(result.message || 'Prescription generated');
      setGenerated(result.data);
      setMedicines([]);
      setDraft(emptyDraft);
      setAdvice('');
      const refreshed = await doctorApi.todayPatients();
      setPatients(refreshed || []);
      setAppointmentId('');
      setAge('');
    } catch (error) {
      console.error('[prescription] generation failed', error.message);
    }
    return undefined;
  };

  const openPdf = async () => {
    if (!generated?.id) return;
    try {
      const data = await sharedApi.prescriptionUrl(generated.id);
      window.open(data.url, '_blank', 'noopener');
    } catch (error) {
      console.error('[prescription] could not open the pdf', error.message);
    }
  };

  const pendingPatients = patients.filter((patient) => !patient.prescriptionId);

  return (
    <section className="page prescription-page">
      <div className="page-head">
        <div>
          <div className="page-title">Generate prescription</div>
          <div className="page-subtitle">
            Patients having an appointment today ({prettyDate(todayISO())}). The prescription is saved as a PDF and emailed
            to the patient.
          </div>
        </div>
      </div>

      <div className="surface">
        <div className="grid cols-2">
          <Dropdown
            label="Patient"
            required
            options={pendingPatients}
            value={appointmentId}
            placeholder={pendingPatients.length ? 'Choose a patient' : 'No pending patient for today'}
            disabled={pendingPatients.length === 0}
            valueProcessor={(option) => String(option.appointmentId)}
            labelProcessor={(option) => `${option.patientName} · ${formatTime(option.startTime)}`}
            onOptionSelected={choosePatient}
          />
          <div className="field">
            <label htmlFor="age">
              Age (years)<span className="req"> *</span>
            </label>
            <input
              id="age"
              type="number"
              min="0"
              max="130"
              value={age}
              onChange={(event) => setAge(event.target.value)}
              disabled={!selectedPatient}
              placeholder="Calculated from the date of birth"
            />
            {selectedPatient ? (
              <span className="hint">
                Date of birth {prettyDate(selectedPatient.dateOfBirth)} · calculated age {selectedPatient.age}. You can
                change it if needed.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {selectedPatient ? (
        <>
          <div className="surface medicine-builder">
            <h3 className="block-title">Add medicine</h3>

            <div className="grid cols-2">
              <div className="field medicine-search">
                <label htmlFor="medicine-term">Search medicine</label>
                <input
                  id="medicine-term"
                  type="search"
                  autoComplete="off"
                  placeholder="Type at least two letters, for example para"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
                {suggestions.length > 0 ? (
                  <ul className="suggestion-list">
                    {suggestions.map((medicine) => (
                      <li key={medicine.id}>
                        <button type="button" onClick={() => pickMedicine(medicine)}>
                          {medicine.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="medicine-name">Selected medicine</label>
                <input
                  id="medicine-name"
                  type="text"
                  value={draft.medicineName}
                  placeholder="Pick a medicine from the search result"
                  onChange={(event) => setDraft((current) => ({ ...current, medicineName: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="dose">Dose</label>
                <input
                  id="dose"
                  type="text"
                  value={draft.dose}
                  placeholder="Guessed from the medicine type, for example 1 pcs"
                  onChange={(event) => setDraft((current) => ({ ...current, dose: event.target.value }))}
                />
              </div>
              <Dropdown
                label="Food instruction"
                options={FOOD_OPTIONS}
                value={draft.food}
                placeholder="Choose food instruction"
                onOptionSelected={(option) => setDraft((current) => ({ ...current, food: option?.id || 'AFTER_FOOD' }))}
              />
            </div>

            <div className="field">
              <label htmlFor="condition">Other condition for this medicine</label>
              <input
                id="condition"
                type="text"
                value={draft.conditionNote}
                placeholder="Any other instruction, for example only if fever is above 100"
                onChange={(event) => setDraft((current) => ({ ...current, conditionNote: event.target.value }))}
              />
            </div>

            <div className="field">
              <span className="field-label">Medicine time</span>
              <div className="toggle-row">
                {TIMINGS.map((timing) => (
                  <button
                    key={timing.key}
                    type="button"
                    className={`toggle ${draft[timing.key] ? 'on' : ''}`}
                    onClick={() => toggle(timing.key)}
                    aria-pressed={draft[timing.key]}
                  >
                    {timing.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`toggle sos ${draft.sos ? 'on' : ''}`}
                  onClick={() => toggle('sos')}
                  aria-pressed={draft.sos}
                >
                  SOS
                </button>
              </div>
            </div>

            <div className="row end">
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(emptyDraft)}>
                Clear medicine
              </button>
              <button type="button" className="btn btn-primary" onClick={addMedicine}>
                Add
              </button>
            </div>
          </div>

          <div className="surface">
            <h3 className="block-title">Medicines in this prescription ({medicines.length})</h3>
            {medicines.length === 0 ? (
              <div className="empty-state">No medicine added yet. Use the Add button above.</div>
            ) : (
              <div className="medicine-cards">
                {medicines.map((medicine, index) => (
                  <Card
                    key={medicine.medicineName}
                    title={medicine.medicineName}
                    subtitle={`Dose ${medicine.dose}`}
                    badge={`#${index + 1}`}
                    badgeTone="info"
                    actions={
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMedicine(index)}>
                        Remove
                      </button>
                    }
                  >
                    <CardRow label="Timing" value={timingText(medicine)} />
                    <CardRow label="Food" value={foodText(medicine.food)} />
                    {medicine.conditionNote ? <CardRow label="Condition" value={medicine.conditionNote} /> : null}
                  </Card>
                ))}
              </div>
            )}

            <div className="field advice-field">
              <label htmlFor="advice">General advice (optional)</label>
              <textarea
                id="advice"
                value={advice}
                placeholder="Any general advice for the patient"
                onChange={(event) => setAdvice(event.target.value)}
              />
            </div>

            <div className="row end">
              <button type="button" className="btn btn-primary" onClick={generate}>
                Generate prescription
              </button>
            </div>
          </div>
        </>
      ) : null}

      {generated ? (
        <div className="surface generated-box">
          <h3>Prescription generated</h3>
          <p className="hint">The PDF has been stored securely and emailed to the patient.</p>
          <button type="button" className="btn btn-success btn-sm" onClick={openPdf}>
            Open the prescription PDF
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default GeneratePrescriptionPage;
