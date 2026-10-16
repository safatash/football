'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type RegistrationData = {
  // Personal Info
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  dob: string
  gender: 'MALE' | 'FEMALE' | ''
  
  // Address
  address: string
  city: string
  state: string
  zip: string
  
  // Soccer Info
  position: string
  tshirtSize: string
  
  // Preferences
  contactMe: boolean
  social: boolean
  tournaments: boolean
  
  // Team Selection
  teamIds: string[]
  captainTeamIds: string[]
  
  // Optional Codes
  boardMemberCode?: string
  discountCode?: string
  teamPaidFullCode?: string
}

export default function NewPlayerRegistrationPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    dob: '',
    gender: '',
    address: '',
    city: '',
    state: 'VA',
    zip: '',
    position: '',
    tshirtSize: '',
    contactMe: false,
    social: false,
    tournaments: false,
    teamIds: [],
    captainTeamIds: [],
  })

  const updateField = (field: keyof RegistrationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setError('')
    // Basic validation before moving to next step
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
        setError('Please fill in all required fields')
        return
      }
    }
    setStep(step + 1)
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/register/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {step} of 4</span>
            <span className="text-sm text-gray-500">New Player Registration</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Personal Information</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="(703) 555-1234"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => updateField('dob', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNext} className="px-8">
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Address</h2>

              <div>
                <label className="block text-sm font-medium mb-1">Street Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="VA">Virginia</option>
                    <option value="MD">Maryland</option>
                    <option value="DC">Washington DC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ZIP Code *</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => updateField('zip', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="22030"
                  maxLength={5}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Registration is limited to Fairfax County residents
                </p>
              </div>

              <div className="flex justify-between">
                <Button onClick={handleBack} variant="outline">
                  Back
                </Button>
                <Button onClick={handleNext} className="px-8">
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Soccer Info */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Soccer Information</h2>

              <div>
                <label className="block text-sm font-medium mb-1">Preferred Position *</label>
                <select
                  value={formData.position}
                  onChange={(e) => updateField('position', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select position...</option>
                  <option value="Goalkeeper">Goalkeeper</option>
                  <option value="Defender">Defender</option>
                  <option value="Midfielder">Midfielder</option>
                  <option value="Forward">Forward</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">T-Shirt Size *</label>
                <select
                  value={formData.tshirtSize}
                  onChange={(e) => updateField('tshirtSize', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select size...</option>
                  <option value="Youth S">Youth S</option>
                  <option value="Youth M">Youth M</option>
                  <option value="Youth L">Youth L</option>
                  <option value="Adult S">Adult S</option>
                  <option value="Adult M">Adult M</option>
                  <option value="Adult L">Adult L</option>
                  <option value="Adult XL">Adult XL</option>
                  <option value="Adult 2XL">Adult 2XL</option>
                  <option value="Adult 3XL">Adult 3XL</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.contactMe}
                    onChange={(e) => updateField('contactMe', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Contact me about NVASA events and news</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.social}
                    onChange={(e) => updateField('social', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include me in social media posts</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.tournaments}
                    onChange={(e) => updateField('tournaments', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Interested in tournament opportunities</span>
                </label>
              </div>

              <div className="flex justify-between">
                <Button onClick={handleBack} variant="outline">
                  Back
                </Button>
                <Button onClick={handleNext} className="px-8">
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Review & Submit</h2>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{formData.firstName} {formData.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{formData.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{formData.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">
                    {formData.address}, {formData.city}, {formData.state} {formData.zip}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Registration Fee</p>
                  <p className="font-medium text-2xl">$125.00</p>
                  <p className="text-sm text-gray-500 mt-1">Spring 2026 Season</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  You'll be redirected to Stripe to complete your payment securely.
                </p>
              </div>

              <div className="flex justify-between">
                <Button onClick={handleBack} variant="outline">
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="px-8"
                >
                  {loading ? 'Processing...' : 'Continue to Payment'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}