import React, { useEffect, useMemo, useState } from 'react'
import { apiService } from '@/services/apiService'
import styles from '@/styles/App.module.css'

type AdminUser = {
  id: number
  username: string
  email: string
  is_admin: boolean
  is_active: boolean
  selected_character: string | null
  character_level: number
  experience_points: number
  avatar_url: string | null
  timezone: string | null
  created_at: string
  last_login: string | null
}

export const AdminPanel: React.FC = () => {
  const currentUser = apiService.getCurrentUser()
  const isAdmin = !!currentUser?.isAdmin

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState<{ username: string; email: string; password: string; is_admin: boolean; is_active: boolean}>({
    username: '',
    email: '',
    password: '',
    is_admin: false,
    is_active: true,
  })

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  }, [users, search])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getAdminUsers(new URLSearchParams({ limit: '50', sort: 'created_at', dir: 'DESC' }))
      if (res.success && res.data) {
        setUsers(res.data.items as AdminUser[])
      } else {
        setError(res.error || 'Failed to load users')
      }
    } catch (e) {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  if (!isAdmin) {
    return (
      <div className={styles.card} role="alert" aria-live="polite">
        <h2>Unauthorized</h2>
        <p>You need admin privileges to access this page.</p>
      </div>
    )
  }

  const handleFieldChange = (id: number, field: keyof AdminUser, value: unknown) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } as AdminUser : u))
  }

  const handleSave = async (u: AdminUser) => {
    setSavingId(u.id)
    setMessage(null)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        username: u.username,
        email: u.email,
        is_admin: !!u.is_admin,
        is_active: !!u.is_active,
        selected_character: u.selected_character,
        character_level: Number(u.character_level),
        experience_points: Number(u.experience_points),
        avatar_url: u.avatar_url,
        timezone: u.timezone
      }
      const res = await apiService.updateUser(u.id, payload)
      if (res.success) {
        setMessage(`Saved changes for ${u.username}`)
      } else {
        setError(res.error || 'Save failed')
      }
    } catch (e) {
      setError('Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const handleClearLobbies = async () => {
    if (!confirm('Clear all lobbies? This cannot be undone.')) return
    setMessage(null)
    setError(null)
    try {
      const res = await apiService.clearLobbies()
      if (res.success) {
        setMessage(`Cleared ${res.data?.deleted.lobbies ?? 0} lobbies`)
      } else {
        setError(res.error || 'Failed to clear lobbies')
      }
    } catch (e) {
      setError('Failed to clear lobbies')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setMessage(null)
    setError(null)
    try {
      if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password || newUser.password.length < 8) {
        setError('Provide username, valid email and password (>= 8 chars)')
        return
      }
      const res = await apiService.createUser({
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        is_admin: newUser.is_admin,
        is_active: newUser.is_active,
      })
      const createdUser = (res.data as any)?.user as AdminUser | undefined
      if (res.success && createdUser) {
        setMessage(`Created user ${createdUser.username}`)
        setUsers(prev => [createdUser, ...prev])
        setNewUser({ username: '', email: '', password: '', is_admin: false, is_active: true })
      } else {
        setError(res.error || 'Failed to create user')
      }
    } catch {
      setError('Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setError(null)
    setMessage(null)
    try {
      const res = await apiService.deleteUser(id)
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== id))
        setMessage(`Deleted user ${id}`)
      } else {
        setError(res.error || 'Failed to delete user')
      }
    } catch {
      setError('Failed to delete user')
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.flex} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Admin Panel</h2>
        <div className={styles.flex} style={{ gap: 8 }}>
          <button className={styles.button} onClick={loadUsers} disabled={loading}>Refresh Users</button>
          <button className={styles.buttonOutline} onClick={handleClearLobbies}>Clear Lobbies</button>
        </div>
      </div>

      <div className={styles.flex} style={{ gap: 8, margin: '8px 0' }}>
        <input
          type="text"
          placeholder="Search users by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      {/* Create User */}
      <div className={styles.card} style={{ marginBottom: 12 }}>
        <h3>Create User</h3>
        <form onSubmit={handleCreateUser} className={styles.flex} style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
          <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={newUser.is_admin} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} /> Admin
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={newUser.is_active} onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })} /> Active
          </label>
          <button className={styles.button} type="submit" disabled={creating}>Create</button>
        </form>
      </div>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Active</th>
              <th>Level</th>
              <th>XP</th>
              <th>Character</th>
              <th>Timezone</th>
              <th>Avatar URL</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>
                  <input value={u.username} onChange={(e) => handleFieldChange(u.id, 'username', e.target.value)} />
                </td>
                <td>
                  <input value={u.email} onChange={(e) => handleFieldChange(u.id, 'email', e.target.value)} />
                </td>
                <td>
                  <input type="checkbox" checked={u.is_admin} onChange={(e) => handleFieldChange(u.id, 'is_admin', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={u.is_active} onChange={(e) => handleFieldChange(u.id, 'is_active', e.target.checked)} />
                </td>
                <td>
                  <input type="number" value={u.character_level} onChange={(e) => handleFieldChange(u.id, 'character_level', parseInt(e.target.value || '0', 10))} style={{ width: 80 }} />
                </td>
                <td>
                  <input type="number" value={u.experience_points} onChange={(e) => handleFieldChange(u.id, 'experience_points', parseInt(e.target.value || '0', 10))} style={{ width: 100 }} />
                </td>
                <td>
                  <input value={u.selected_character || ''} onChange={(e) => handleFieldChange(u.id, 'selected_character', e.target.value)} />
                </td>
                <td>
                  <input value={u.timezone || ''} onChange={(e) => handleFieldChange(u.id, 'timezone', e.target.value)} />
                </td>
                <td>
                  <input value={u.avatar_url || ''} onChange={(e) => handleFieldChange(u.id, 'avatar_url', e.target.value)} />
                </td>
                <td>
                  <div className={styles.flex} style={{ gap: 6 }}>
                    <button className={styles.button} onClick={() => handleSave(u)} disabled={savingId === u.id}>Save</button>
                    <button className={styles.buttonOutline} onClick={() => handleDelete(u.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPanel
