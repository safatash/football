import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add admin role check
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // }

    const { teamId, makeCaptain } = await req.json()

    // Get registration
    const registration = await prisma.registration.findUnique({
      where: { id: params.id },
      include: { player: true }
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    // Get team with division info
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { division: true }
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Update registration and create team membership in a transaction
    await prisma.$transaction([
      // Update registration status
      prisma.registration.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        }
      }),

      // Update player approval status
      prisma.player.update({
        where: { id: registration.playerId },
        data: {
          finalApproval: 'APPROVED',
        }
      }),

      // Create team roster membership
      prisma.teamRoster.create({
        data: {
          playerId: registration.playerId,
          teamId: teamId,
          divisionId: team.divisionId,
          membershipType: 'SEASONAL',
          isCaptain: makeCaptain,
          captainRequest: makeCaptain,
        }
      }),
    ])

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Approval error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve registration' },
      { status: 500 }
    )
  }
}