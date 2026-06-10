'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { User, Building2, Users, UserPlus, Save, Trash2, Shield, KeyRound, Eye, EyeOff, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { format } from 'date-fns'

interface User { id: string; name: string; email: string }
interface Project { id: string; name: string; companyName: string; description: string; obsidianVaultPath?: string }
interface Member {
  id: string
  userId: string
  role: string
  name: string
  email: string
  createdAt: string
}

interface Props {
  user: User
  project: Project
  myRole: string
  members: Member[]
}

export function SettingsClient({ user, project, myRole, members }: Props) {
  const router = useRouter()

  // profile
  const [name, setName] = useState(user?.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // project
  const [projName, setProjName] = useState(project?.name ?? '')
  const [companyName, setCompanyName] = useState(project?.companyName ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [obsidianVaultPath, setObsidianVaultPath] = useState(project?.obsidianVaultPath ?? '')
  const [savingProject, setSavingProject] = useState(false)
  const [syncingVault, setSyncingVault] = useState(false)
  const [exportingVault, setExportingVault] = useState(false)

  // invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // change my password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // admin reset-password modal — when admin clicks Reset password on a
  // member row, we open a modal that lets them type the new password and
  // shows it back so they can copy + share it out-of-band with the user.
  const [resetTarget, setResetTarget] = useState<Member | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetShow, setResetShow] = useState(false)
  const [resetting, setResetting] = useState(false)

  const isAdmin = myRole === 'admin'

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not update profile')
        return
      }
      toast.success('Profile updated')
      router.refresh()
    } finally {
      setSavingProfile(false)
    }
  }

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProject(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projName, companyName, description, obsidianVaultPath }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not update project')
        return
      }
      toast.success('Workspace updated')
      router.refresh()
    } finally {
      setSavingProject(false)
    }
  }

  const syncObsidianVault = async () => {
    if (!obsidianVaultPath.trim()) {
      toast.error('Please configure the Obsidian vault path first')
      return
    }
    setSyncingVault(true)
    try {
      const res = await fetch('/api/obsidian/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to sync Obsidian vault')
        return
      }
      toast.success(`Synced Obsidian vault: ${data.fileCount ?? 0} chunks`) 
    } finally {
      setSyncingVault(false)
    }
  }

  const exportToObsidian = async () => {
    if (!obsidianVaultPath.trim()) {
      toast.error('Please configure the Obsidian vault path first')
      return
    }
    setExportingVault(true)
    try {
      const res = await fetch('/api/obsidian/export', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to export project to Obsidian')
        return
      }
      toast.success(`Exported ${data.createdFiles?.length ?? 0} files to Obsidian`) 
    } finally {
      setExportingVault(false)
    }
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not add member')
        return
      }
      toast.success('Member added')
      setInviteEmail('')
      router.refresh()
    } finally {
      setInviting(false)
    }
  }

  const changeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Could not change password'); return }
      toast.success('Password updated')
      setCurrentPw(''); setNewPw(''); setConfirmPw(''); setShowPw(false)
    } finally { setSavingPw(false) }
  }

  // Generates a memorable-but-decent 16-char password so the admin doesn't
  // have to invent one on the spot. Mix of upper/lower/digit ensures the
  // bcrypt entropy is fine. Operator can edit or replace it freely.
  function generatePassword(): string {
    const lower = 'abcdefghjkmnpqrstuvwxyz'
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const digit = '23456789'
    const all = lower + upper + digit
    let out = ''
    const arr = new Uint32Array(16)
    crypto.getRandomValues(arr)
    for (let i = 0; i < 16; i++) out += all[arr[i] % all.length]
    return out
  }

  const submitAdminReset = async () => {
    if (!resetTarget) return
    if (resetPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setResetting(true)
    try {
      const res = await fetch(`/api/users/${resetTarget.userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data?.error ?? 'Could not reset password'); return }
      toast.success(`Password reset for ${resetTarget.name || resetTarget.email}`)
      // Leave modal open with the password visible so admin can copy it.
      setResetShow(true)
    } finally { setResetting(false) }
  }

  function closeReset() {
    setResetTarget(null); setResetPw(''); setResetShow(false); setResetting(false)
  }

  async function copyResetPw() {
    try {
      await navigator.clipboard.writeText(resetPw)
      toast.success('Password copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${memberId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Could not remove member')
        return
      }
      toast.success('Member removed')
      router.refresh()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile */}
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">Your profile</h2>
        </div>
        <form onSubmit={saveProfile} className="p-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} disabled />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={savingProfile}>
              <Save className="h-4 w-4" /> Save profile
            </Button>
          </div>
        </form>
      </section>

      {/* Change my password */}
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">Change password</h2>
        </div>
        <form onSubmit={changeMyPassword} className="p-6 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currentPw">Current password</Label>
            <Input id="currentPw" type={showPw ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPw">New password</Label>
            <Input id="newPw" type={showPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPw">Confirm new</Label>
            <Input id="confirmPw" type={showPw ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="md:col-span-3 flex items-center justify-between">
            <button type="button" onClick={() => setShowPw((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPw ? 'Hide passwords' : 'Show passwords'}
            </button>
            <Button type="submit" loading={savingPw}>
              <Save className="h-4 w-4" /> Update password
            </Button>
          </div>
        </form>
      </section>

      {/* Workspace */}
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">Workspace</h2>
        </div>
        <form onSubmit={saveProject} className="p-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="projName">Workspace name</Label>
            <Input id="projName" value={projName} onChange={(e) => setProjName(e.target.value)} disabled={!isAdmin} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company</Label>
            <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!isAdmin} required />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="obsidianVaultPath">Obsidian vault path</Label>
            <Input
              id="obsidianVaultPath"
              value={obsidianVaultPath}
              onChange={(e) => setObsidianVaultPath(e.target.value)}
              disabled={!isAdmin}
              placeholder="/Users/you/ObsidianVault"
            />
            <p className="text-xs text-muted-foreground">The path to your local Obsidian vault. Used for project export and vault sync.</p>
          </div>
          {isAdmin ? (
            <div className="md:col-span-2 flex flex-col gap-3">
              <div className="flex flex-wrap gap-3 justify-end">
                <Button type="submit" loading={savingProject}>
                  <Save className="h-4 w-4" /> Save workspace
                </Button>
                <Button type="button" variant="outline" loading={syncingVault} onClick={syncObsidianVault}>
                  Sync vault
                </Button>
                <Button type="button" variant="secondary" loading={exportingVault} onClick={exportToObsidian}>
                  Export to Obsidian
                </Button>
              </div>
            </div>
          ) : (
            <p className="md:col-span-2 text-xs text-muted-foreground">Only workspace admins can edit these fields.</p>
          )}
        </form>
      </section>

      {/* Team */}
      <section className="bg-card border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-lg tracking-tight">Team</h2>
        </div>
        <div className="p-6 space-y-6">
          {isAdmin ? (
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px] space-y-2">
                <Label htmlFor="inviteEmail">Invite by email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-10 px-3 text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" loading={inviting}>
                <UserPlus className="h-4 w-4" /> Add member
              </Button>
            </form>
          ) : null}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Members ({members?.length ?? 0})
            </p>
            <div className="border border-border divide-y divide-border">
              {(members ?? []).map((m) => (
                <div key={m?.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center bg-accent text-accent-foreground text-xs font-semibold">
                    {m?.name?.[0]?.toUpperCase?.() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m?.name} {m?.userId === user?.id ? <span className="text-xs text-muted-foreground font-normal">(you)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m?.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest bg-secondary px-2 py-1 font-semibold">
                    <Shield className="h-3 w-3" />
                    {m?.role}
                  </span>
                  <span className="hidden md:block text-xs text-muted-foreground">
                    Since {m?.createdAt ? format(new Date(m.createdAt), 'MMM d, yyyy') : ''}
                  </span>
                  {isAdmin && m?.userId !== user?.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setResetTarget(m); setResetPw(generatePassword()); setResetShow(false) }}
                        aria-label="Reset password"
                        title="Reset password"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeMember(m?.id)}
                        disabled={removingId === m?.id}
                        aria-label="Remove member"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Admin: reset another user's password.  Stays open after the
          server confirms so the admin can copy the password and share it
          out-of-band (chat / verbally) with the user — we never email it. */}
      <Dialog open={resetTarget !== null} onOpenChange={(o) => { if (!o) closeReset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Reset password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetTarget?.name || resetTarget?.email}</strong>. Share it with them through a private channel — we don't email it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="resetPw">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="resetPw"
                  type={resetShow ? 'text' : 'password'}
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  className="font-mono"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setResetShow((v) => !v)}
                  aria-label={resetShow ? 'Hide password' : 'Show password'}
                >
                  {resetShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyResetPw}
                  aria-label="Copy password"
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <button
                type="button"
                onClick={() => { setResetPw(generatePassword()); setResetShow(true) }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Generate a new random password
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeReset} disabled={resetting}>Cancel</Button>
            <Button onClick={submitAdminReset} loading={resetting}>
              <KeyRound className="h-4 w-4" /> Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
