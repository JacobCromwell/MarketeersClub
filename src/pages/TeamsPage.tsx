import { Check, Crown, Plus, Search, UserPlus, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, Modal, PageHeader } from '../components/Ui'
import { supabase } from '../lib/supabase'
import type { Profile, Team, TeamMember } from '../types'

export function TeamsPage() {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [inviteTeam, setInviteTeam] = useState<Team | null>(null)
  const [search, setSearch] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)

  async function loadTeams() {
    const { data, error: queryError } = await supabase
      .from('teams')
      .select('*, team_members(*, profiles(*))')
      .order('name')
    if (queryError) setError(queryError.message)
    else setTeams((data ?? []) as unknown as Team[])
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => void loadTeams()) }, [])

  async function createTeam(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    const { error: insertError } = await supabase.from('teams').insert({ name: teamName.trim(), owner_id: user.id })
    if (insertError) setError(insertError.message)
    else { setCreateOpen(false); setTeamName(''); await loadTeams() }
  }

  async function searchProfiles(event: FormEvent) {
    event.preventDefault()
    setSearching(true)
    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('display_name', `%${search.trim()}%`)
      .neq('id', user?.id ?? '')
      .limit(12)
    if (searchError) setError(searchError.message)
    else setProfiles((data ?? []) as Profile[])
    setSearching(false)
  }

  async function invite(profile: Profile) {
    if (!inviteTeam) return
    const { error: inviteError } = await supabase.rpc('invite_team_member', {
      p_team_id: inviteTeam.id,
      p_profile_id: profile.id,
    })
    if (inviteError) setError(inviteError.message)
    else { setInviteTeam(null); setProfiles([]); setSearch(''); await loadTeams() }
  }

  async function acceptInvite(member: TeamMember) {
    const { error: acceptError } = await supabase.rpc('accept_team_invite', { p_membership_id: member.id })
    if (acceptError) setError(acceptError.message)
    else await loadTeams()
  }

  const pendingInvites = teams.flatMap((team) =>
    (team.team_members ?? []).filter((member) => member.profile_id === user?.id && member.status === 'pending').map((member) => ({ team, member })),
  )
  const activeTeams = teams.filter((team) =>
    team.owner_id === user?.id || team.team_members?.some((member) => member.profile_id === user?.id && member.status === 'active'),
  )

  return (
    <div className="page">
      <PageHeader title="Teams" description="Friend groups can coordinate trips, while every member’s catalog stays private." action={<button className="button button--primary" onClick={() => setCreateOpen(true)}><Plus size={18} /> Create team</button>} />
      {error && <ErrorMessage message={error} />}
      {pendingInvites.length > 0 && (
        <section className="invite-strip">
          <div><p className="eyebrow">Pending invitations</p><h2>You’ve been invited</h2></div>
          {pendingInvites.map(({ team, member }) => <button className="button button--secondary" key={member.id} onClick={() => void acceptInvite(member)}><Check size={17} /> Join {team.name}</button>)}
        </section>
      )}

      {loading ? <LoadingState /> : activeTeams.length === 0 ? (
        <EmptyState title="Start a selling circle" description="Create a team, then invite friends by display name." action={<button className="button button--secondary" onClick={() => setCreateOpen(true)}>Create your first team</button>} />
      ) : (
        <section className="team-grid">
          {activeTeams.map((team) => {
            const activeMembers = (team.team_members ?? []).filter((member) => member.status === 'active')
            const isOwner = team.owner_id === user?.id
            return (
              <article className="team-card" key={team.id}>
                <header><div className="team-icon"><Users /></div>{isOwner && <span className="status"><Crown size={14} /> Owner</span>}</header>
                <h2>{team.name}</h2>
                <p>{activeMembers.length} active {activeMembers.length === 1 ? 'member' : 'members'}</p>
                <div className="member-stack">
                  {activeMembers.slice(0, 5).map((member) => <span title={member.profiles?.display_name} key={member.id}>{member.profiles?.display_name?.slice(0, 1).toUpperCase() || '?'}</span>)}
                </div>
                {isOwner && <button className="button button--ghost button--full" onClick={() => { setInviteTeam(team); setProfiles([]); setSearch('') }}><UserPlus size={17} /> Invite member</button>}
              </article>
            )
          })}
        </section>
      )}

      {createOpen && <Modal title="Create a team" onClose={() => setCreateOpen(false)}><form onSubmit={(event) => void createTeam(event)}><label>Team name<input value={teamName} onChange={(event) => setTeamName(event.target.value)} required minLength={2} maxLength={80} autoFocus /></label><div className="form-actions"><button type="button" className="button button--ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button className="button button--primary">Create team</button></div></form></Modal>}

      {inviteTeam && (
        <Modal title={`Invite to ${inviteTeam.name}`} onClose={() => setInviteTeam(null)}>
          <p>Search by display name. Email addresses and inventory are never shown.</p>
          <form className="inline-form" onSubmit={(event) => void searchProfiles(event)}><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} required minLength={2} placeholder="Search members" autoFocus /></label><button className="button button--secondary" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button></form>
          <div className="search-results">
            {profiles.map((profile) => {
              const alreadyMember = inviteTeam.team_members?.some((member) => member.profile_id === profile.id)
              return <div className="profile-row" key={profile.id}><div className="avatar">{profile.display_name.slice(0, 1).toUpperCase()}</div><strong>{profile.display_name}</strong><button className="button button--ghost" disabled={alreadyMember} onClick={() => void invite(profile)}>{alreadyMember ? 'Already invited' : 'Invite'}</button></div>
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}