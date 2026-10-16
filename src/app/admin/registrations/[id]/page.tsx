import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { ApproveRegistrationForm } from "./approve-form"

export default async function RegistrationReviewPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect("/login")
  }

  const registration = await prisma.registration.findUnique({
    where: { id: params.id },
    include: {
      player: {
        include: {
          user: true
        }
      },
      season: true
    }
  })

  if (!registration) {
    notFound()
  }

  // Get all available teams for this season
  const teams = await prisma.team.findMany({
    where: {
      seasonId: registration.seasonId,
      status: 'ACTIVE'
    },
    include: {
      division: true,
      _count: {
        select: {
          roster: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <a href="/admin/registrations" className="text-blue-600 hover:underline">
            ← Back to Registrations
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6">Review Registration</h1>

          {/* Player Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Player Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Name</p>
                <p className="font-medium">
                  {registration.player.firstName} {registration.player.lastName}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Email</p>
                <p className="font-medium">{registration.player.user.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium">{registration.player.phone}</p>
              </div>
              <div>
                <p className="text-gray-600">Date of Birth</p>
                <p className="font-medium">
                  {new Date(registration.player.dob).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Gender</p>
                <p className="font-medium">{registration.player.gender}</p>
              </div>
              <div>
                <p className="text-gray-600">Position</p>
                <p className="font-medium">{registration.player.position}</p>
              </div>
              <div>
                <p className="text-gray-600">T-Shirt Size</p>
                <p className="font-medium">{registration.player.tshirtSize}</p>
              </div>
              <div>
                <p className="text-gray-600">Address</p>
                <p className="font-medium">
                  {registration.player.address}, {registration.player.city}, {registration.player.state} {registration.player.zip}
                </p>
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div className="mb-8 bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Registration Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Season</p>
                <p className="font-medium">{registration.season.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Type</p>
                <p className="font-medium">{registration.registrationType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-600">Payment Status</p>
                <p className="font-medium">
                  <span className={`inline-block px-2 py-1 rounded text-xs ${
                    registration.paymentStatus === 'PAID' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {registration.paymentStatus}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-gray-600">Amount</p>
                <p className="font-medium">${registration.totalAmount.toString()}</p>
              </div>
            </div>
          </div>

          {/* Approval Form */}
          <ApproveRegistrationForm
            registration={registration}
            player={registration.player}
            teams={teams}
          />
        </div>
      </div>
    </div>
  )
}