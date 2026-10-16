'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Team = {
  id: string
  name: string
  division: { name: string }
  maxPlayers: number
  _count: { roster: number }
}

type Props = {
  registration: any
  player: any
  teams: Team[]
}

export function ApproveRegistrationForm({ registration, player, teams }: Props) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [makeCaptain, setMakeCaptain] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleApprove() {
    if (!selectedTeamId) {
      setError('Please select a team')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/registrations/${registration.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          makeCaptain,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve registration')
      }

      router.push('/admin/registrations')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Assign to Team</h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Team</label>
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">Choose a team...</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.division.name}) - {team._count.roster}/{team.maxPlayers} players
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={makeCaptain}
            onChange={(e) => setMakeCaptain(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Make this player a team captain</span>
        </label>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          disabled={loading || !selectedTeamId}
          className="px-8"
        >
          {loading ? 'Approving...' : 'Approve & Assign to Team'}
        </Button>

        <Button
          variant="outline"
          onClick={() => router.push('/admin/registrations')}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}