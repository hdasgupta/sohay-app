import { useCallback, useEffect, useState } from "react";
import Pagination from "../../components/Pagination/Pagination.jsx";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog.jsx";
import {
  getFamily,
  createFamily,
  invite,
  respond,
  withdrawInvitation,
  leaveFamily,
} from "../../api/patientApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { notify } from "../../utils/eventBus.js";
import { isEmail, initials } from "../../utils/validators.js";
import { formatTimestamp } from "../../utils/date.js";
import "./FamilyPage.css";

const INV_BADGE = {
  pending: "badge-scheduled",
  accepted: "badge-completed",
  rejected: "badge-cancelled",
  cancelled: "badge-rescheduled",
};

export default function FamilyPage() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = useCallback(async () => {
    try {
      setState((await getFamily()).data);
    } catch {
      setState({
        family: null,
        members: [],
        sentInvitations: [],
        receivedInvitations: [],
      });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act =
    (fn) =>
    async (...args) => {
      try {
        const { message } = await fn(...args);
        notify.success(message || "Done");
        await load();
        return true;
      } catch {
        return false;
      }
    };

  const onCreate = async (e) => {
    e.preventDefault();
    if (familyName.trim().length < 2) {
      notify.warning("Family name must be at least 2 characters");
      return;
    }
    if (await act(createFamily)(familyName.trim())) setFamilyName("");
  };
  const onInvite = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      notify.warning("Please enter the email of a registered patient");
      return;
    }
    if (await act(invite)(email.trim())) setEmail("");
  };
  const onLeave = async () => {
    setConfirmLeave(false);
    await act(leaveFamily)();
  };

  if (!state) return null;
  const { family, members, sentInvitations, receivedInvitations } = state;

  return (
    <div className="family">
      <div className="page-title">
        <div>
          <h1>My family</h1>
          <p>
            Family members can book appointments for each other. Invitations are
            sent by email and must be accepted.
          </p>
        </div>
      </div>

      {receivedInvitations.length > 0 && (
        <section className="card fam-received">
          <h2>Invitations for you</h2>
          <div className="fam-inv-list">
            {receivedInvitations.map((i) => (
              <div
                key={i.id}
                className="fam-inv"
                data-testid={`received-${i.id}`}
              >
                <div>
                  <strong>{i.familyName}</strong>
                  <p className="small muted">
                    Invited by {i.inviterName} ({i.inviterEmail}) ·{" "}
                    {formatTimestamp(i.createdAt)}
                  </p>
                  {family && (
                    <p className="small fam-warn">
                      Leave your current family before accepting this
                      invitation.
                    </p>
                  )}
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => act(respond)(i.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => act(respond)(i.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!family ? (
        <section className="card fam-create">
          <div className="fam-create-art" aria-hidden="true">
            <svg
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
            </svg>
          </div>
          <div className="stack">
            <h2>You are not part of a family yet</h2>
            <p className="muted">
              Create a family and invite other registered patients, or accept an
              invitation you received.
            </p>
            <form className="row fam-form" onSubmit={onCreate}>
              <input
                className="input"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Family name, e.g. The Sen Family"
                aria-label="Family name"
              />
              <button type="submit" className="btn btn-primary">
                Create family
              </button>
            </form>
          </div>
        </section>
      ) : (
        <div className="fam-grid">
          <section className="card stack">
            <div className="row row-between">
              <div>
                <h2 className="fam-name">{family.name}</h2>
                <p className="small muted">Created by {family.createdByName}</p>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmLeave(true)}
              >
                Leave family
              </button>
            </div>
            <ul className="fam-members">
              {members.map((m) => (
                <li key={m.id} className="fam-member">
                  <span className="fam-avatar">{initials(m.name)}</span>
                  <div>
                    <strong>
                      {m.name}
                      {m.id === user.id && (
                        <span className="chip fam-me">You</span>
                      )}
                    </strong>
                    <span className="small muted">
                      {m.email} · {m.sex}
                      {m.age !== null && m.age !== undefined
                        ? ` · ${m.age} yrs`
                        : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <form className="row fam-form" onSubmit={onInvite}>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Registered patient's email"
                aria-label="Invite by email"
              />
              <button type="submit" className="btn btn-primary">
                Send invitation
              </button>
            </form>
          </section>
          <section className="card stack">
            <h2>Sent invitations</h2>
            <Pagination
              items={sentInvitations}
              emptyMessage="No invitations sent yet"
              searchPlaceholder="Search invitations"
              searchText={(i) =>
                `${i.inviteeName} ${i.inviteeEmail} ${i.status}`
              }
              itemProcessor={(i) => (
                <div className="fam-sent" data-testid={`sent-${i.id}`}>
                  <div>
                    <strong>{i.inviteeName}</strong>
                    <p className="small muted">
                      {i.inviteeEmail} · {formatTimestamp(i.createdAt)}
                    </p>
                  </div>
                  <div className="row">
                    <span className={`badge ${INV_BADGE[i.status] || ""}`}>
                      {i.status}
                    </span>
                    {i.status === "pending" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => act(withdrawInvitation)(i.id)}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              )}
            />
          </section>
        </div>
      )}
      <ConfirmDialog
        open={confirmLeave}
        title="Leave family?"
        message="You will no longer be able to book for other members, and they will not be able to book for you."
        confirmText="Leave"
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
