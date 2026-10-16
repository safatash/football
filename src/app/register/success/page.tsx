import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function RegistrationSuccessPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Registration Complete!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Thank you for registering with NVASA. Your payment has been processed successfully.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Your registration is pending admin approval</li>
            <li>• You'll receive an email confirmation shortly</li>
            <li>• Once approved, you'll be assigned to a team</li>
            <li>• Check your portal for updates</li>
          </ul>
        </div>

        <div className="space-y-3">
          {session ? (
            <Link href="/portal">
              <Button className="w-full">
                Go to My Portal
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button className="w-full">
                Login to Your Account
              </Button>
            </Link>
          )}
          
          <Link href="/">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}