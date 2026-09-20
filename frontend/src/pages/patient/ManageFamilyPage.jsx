import { useCallback, useEffect, useState } from 'react';
import Card, { CardRow } from '../../components/Card/Card';
import Dropdown from '../../components/Dropdown/Dropdown';
import Pagination from '../../components/Pagination/Pagination';
import { patientApi } from '../../api/patientApi';
import { useMessage } from '../../context/MessageContext';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { calculateAge, prettyDate } from '../../utils/dateUtils';
import './ManageFamilyPage.css';

const ManageFamilyPage = () => {
  const [overview, setOverview] = useState({ family: null, members: [], sentInvitations: [], pendingInvitations: [] });
  const [familyName, setFamilyName] = useState('');
  const [search, setSearch] = useState('');
  const [invitable, setInvitable] = useState([]);
  const [inviteeId, setInviteeId] = useState('');
  const debouncedSearch = useDebouncedValue(search, 450);
  const messenger = useMessage();

  const load = useCallback(async () => {
    try {
      const data = await patientApi.family();
      setOverview(data);
      console.log('[family] overview loaded, members =', data?.members?.length);
    } catch (error) {
      console.error('[family] could not load overview', error.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!overview.family) return;
    const loadInvitable = async () => {
      try {
        const data = await patientApi.invitable(debouncedSearch);
        setInvitable(data || []);
      } catch (error) {
        console.error('[family] could not load invitable patients', error.message);
      }
    };
    loadInvitable();
  }, [debouncedSearch, overview.family]);

  const createFamily = async (event) => {
    event.preventDefault();
    if (!familyName.trim()) return messenger.warning('Please type a family name');
    try {
      const result = await patientApi.createFamily(familyName.trim());
      messenger.success(result.message || 'Family created');
      setFamilyName('');
      load();
    } catch (error) {
      console.error('[family] creation failed', error.message);
    }
    return undefined;
  };

  const invite = async (event) => {
    event.preventDefault();
    if (!inviteeId) return messenger.warning('Choose a patient to invite');
    try {
      const result = await patientApi.invite(inviteeId);
      messenger.success(result.message || 'Invitation sent');
      setInviteeId('');
      setSearch('');
      load();
    } catch (error) {
      console.error('[family] invitation failed', error.message);
    }
    return undefined;
  };

  const respond = async (invitation, accept) => {
    try {
      const result = await patientApi.respondInvitation(invitation.id, accept);
      messenger.success(result.message || 'Response recorded');
      load();
    } catch (error) {
      console.error('[family] could not respond to invitation', error.message);
    }
  };

  const renderMember = (member) => (
    <Card key={member.id} title={member.name} subtitle={member.email} badge={member.sex} badgeTone="info">
      <CardRow label="Date of birth" value={member.dateOfBirth ? prettyDate(member.dateOfBirth) : 'Not available'} />
      <CardRow label="Age" value={member.dateOfBirth ? `${calculateAge(member.dateOfBirth)} years` : 'Not available'} />
    </Card>
  );

  return (
    <section className="page family-page">
      <div className="page-head">
        <div>
          <div className="page-title">Manage family</div>
          <div className="page-subtitle">
            Create a family, invite other registered patients and book appointments on behalf of your family members.
          </div>
        </div>
        {overview.family ? <span className="chip success">{overview.family.name}</span> : null}
      </div>

      {overview.pendingInvitations.length > 0 ? (
        <div className="surface invite-inbox">
          <h3 className="block-title">Invitations waiting for your response</h3>
          <div className="invite-list">
            {overview.pendingInvitations.map((invitation) => (
              <Card
                key={invitation.id}
                title={invitation.familyName}
                subtitle={`Invited by ${invitation.inviterName} (${invitation.inviterEmail})`}
                badge="Pending"
                badgeTone="warning"
                actions={
                  <>
                    <button type="button" className="btn btn-success btn-sm" onClick={() => respond(invitation, true)}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => respond(invitation, false)}>
                      Reject
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {!overview.family ? (
        <form className="surface" onSubmit={createFamily} noValidate>
          <h3 className="block-title">Create your family</h3>
          <p className="hint">
            You are not part of any family yet. Create one to start inviting your family members, or accept an invitation
            that you received.
          </p>
          <div className="row family-create-row">
            <input
              type="text"
              placeholder="Family name, for example Dasgupta family"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Create family
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="surface">
            <h3 className="block-title">Invite a patient</h3>
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="patient-search">Search registered patients</label>
                <input
                  id="patient-search"
                  type="search"
                  placeholder="Type a name or email address"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Dropdown
                label="Patient to invite"
                options={invitable}
                value={inviteeId}
                placeholder={invitable.length ? 'Choose a patient' : 'No matching patient found'}
                labelProcessor={(option) => `${option.name} (${option.email})`}
                disabled={invitable.length === 0}
                onOptionSelected={(option) => setInviteeId(option ? String(option.id) : '')}
              />
            </div>
            <div className="row end">
              <button type="button" className="btn btn-primary" onClick={invite}>
                Send invitation
              </button>
            </div>
          </div>

          <div className="surface">
            <h3 className="block-title">Family members</h3>
            <Pagination
              items={overview.members}
              itemProcessor={renderMember}
              listClassName="cards"
              emptyMessage="No member in this family yet"
            />
          </div>

          <div className="surface">
            <h3 className="block-title">Invitations sent by the family</h3>
            <Pagination
              items={overview.sentInvitations}
              emptyMessage="No invitation has been sent yet"
              listClassName="cards"
              itemProcessor={(invitation) => (
                <Card
                  key={invitation.id}
                  title={invitation.inviteeName}
                  subtitle={invitation.inviteeEmail}
                  badge={invitation.status}
                  badgeTone={
                    invitation.status === 'ACCEPTED' ? 'success' : invitation.status === 'REJECTED' ? 'danger' : 'warning'
                  }
                >
                  <CardRow label="Sent on" value={new Date(invitation.createdAt).toLocaleString('en-IN')} />
                  {invitation.respondedAt ? (
                    <CardRow label="Responded" value={new Date(invitation.respondedAt).toLocaleString('en-IN')} />
                  ) : null}
                </Card>
              )}
            />
          </div>
        </>
      )}
    </section>
  );
};

export default ManageFamilyPage;
