import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function AdminRegistrationsPage() {
  const session = await getServerSession(authOptions)
  
  // TODO: Add proper admin check
  if (!session?.user) {
    redirect("/login")
  }

  // Get all pending registrations
  const pendingRegistrations = await prisma.registration.findMany({
    where: {
      status: 'PENDING'
    },
    include: {
      player: {
        include: {
          user: true
        }
      },
      season: true
    },
    orderBy: {
      submittedAt: 'desc'
    }
  })

  // Get approved registrations for reference
  const approvedRegistrations = await prisma.registration.findMany({
    where: {
      status: 'APPROVED'
    },
    include: {
      player: {
        include: {
          user: true,
          teamMemberships: {
            include: {
              team: {
                include: {
                  division: true
                }
              }
            }
          }
        }
      },
      season: true
    },
    orderBy: {
      approvedAt: 'desc'
    },
    take: 10
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Registration Management</h1>
          <p className="text-gray-600 mt-2">Review and approve player registrations</p>
        </div>

        {/* Pending Registrations */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Pending Registrations ({pendingRegistrations.length})
          </h2>

          {pendingRegistrations.length === 0 ? (
            <p className="text-gray-500">No pending registrations</p>
          ) : (
            <div className="space-y-4">
              {pendingRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {reg.player.firstName} {reg.player.lastName}
                      </h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Email</p>
                          <p className="font-medium">{reg.player.user.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Phone</p>
                          <p className="font-medium">{reg.player.phone}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">DOB / Gender</p>
                          <p className="font-medium">
                            {new Date(reg.player.dob).toLocaleDateString()} / {reg.player.gender}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Address</p>
                          <p className="font-medium">
                            {reg.player.city}, {reg.player.state} {reg.player.zip}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Position</p>
                          <p className="font-medium">{reg.player.position}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">T-Shirt</p>
                          <p className="font-medium">{reg.player.tshirtSize}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Payment Status</p>
                          <p className="font-medium">
                            <span className={`inline-block px-2 py-1 rounded text-xs ${
                              reg.paymentStatus === 'PAID' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {reg.paymentStatus}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Submitted</p>
                          <p className="font-medium">
                            {new Date(reg.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <Link
                        href={`/admin/registrations/${reg.id}`}
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Review & Assign
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Approved */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            Recently Approved ({approvedRegistrations.length})
          </h2>

          {approvedRegistrations.length === 0 ? (
            <p className="text-gray-500">No approved registrations yet</p>
          ) : (
            <div className="space-y-3">
              {approvedRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="border border-green-200 bg-green-50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {reg.player.firstName} {reg.player.lastName}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {reg.player.teamMemberships.length > 0 ? (
                          <>
                            Assigned to: {reg.player.teamMemberships.map(m => m.team.name).join(', ')}
                          </>
                        ) : (
                          'No team assigned yet'
                        )}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p>Approved: {reg.approvedAt ? new Date(reg.approvedAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}