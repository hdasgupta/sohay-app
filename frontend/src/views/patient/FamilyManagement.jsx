import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import { useApp } from "../../context/AppContext";
import Dropdown from "../../components/Dropdown";
import "./Patient.css";
export default function FamilyManagement() {
  const [families, setFamilies] = useState([]);
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [email, setEmail] = useState("");
  const { notify } = useApp();
  const load = async () => {
    try {
      const [f, i] = await Promise.all([
        api.get("/patient/families"),
        api.get("/patient/families/invitations"),
      ]);
      setFamilies(f.data.items);
      setInvites(i.data.items);
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);
  const create = async () => {
    try {
      await api.post("/patient/families", { familyName: name });
      setName("");
      notify("success", "Family created.");
      load();
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const invite = async () => {
    try {
      await api.post("/patient/families/invite", { familyId, email });
      setEmail("");
      notify("success", "Invitation sent.");
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const respond = async (id, accept) => {
    try {
      await api.patch(`/patient/families/invitations/${id}`, { accept });
      notify(
        "success",
        accept ? "Invitation accepted." : "Invitation rejected.",
      );
      load();
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const grouped = [...new Map(families.map((x) => [x.family_id, x])).values()];
  return (
    <div className="panel">
      <h1>Manage Family</h1>
      <div className="form-grid">
        <div className="field">
          <label>New family</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" onClick={create} disabled={!name.trim()}>
            Create family
          </button>
        </div>
        <div className="field">
          <label>Family</label>
          <Dropdown
            options={grouped}
            value={familyId}
            onOptionSelected={(x) => setFamilyId(x.family_id)}
            labelProcessor={(x) => x.family_name}
            valueProcessor={(x) => x.family_id}
            placeholder="Select family"
          />
          <label>Invite patient by email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="btn"
            onClick={invite}
            disabled={!familyId || !email}
          >
            Invite
          </button>
        </div>
      </div>
      <hr className="hr" />
      <h2>Your families</h2>
      <div className="family-list">
        {grouped.map((f) => (
          <div className="card" key={f.family_id}>
            <h3>{f.family_name}</h3>
            {families
              .filter((x) => x.family_id === f.family_id)
              .map((m) => (
                <div key={m.patient_id}>
                  {m.patient_name} ·{" "}
                  <span className="muted">{m.patient_email}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <hr className="hr" />
      <h2>Pending invitations</h2>
      <div className="invite-list">
        {invites.map((i) => (
          <div className="card" key={i.id}>
            <b>{i.family_name}</b>
            <div>Invited by {i.inviter_name}</div>
            <div className="inline-actions">
              <button className="btn" onClick={() => respond(i.id, true)}>
                Accept
              </button>
              <button
                className="btn secondary"
                onClick={() => respond(i.id, false)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
