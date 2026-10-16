import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // 1. Validate password strength
    const passwordValidation = validatePasswordStrength(data.password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(', ') },
        { status: 400 }
      )
    }

    // 2. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // 3. Check if email is blocked
    const blocked = await prisma.blocklist.findUnique({
      where: { email: data.email }
    })

    if (blocked) {
      return NextResponse.json(
        { error: 'This email is not eligible for registration' },
        { status: 400 }
      )
    }

    // 4. Validate zip code (Fairfax County only)
    const validZip = await prisma.allowedZipCode.findUnique({
      where: { zipCode: data.zip }
    })

    if (!validZip) {
      return NextResponse.json(
        { error: 'Registration is limited to Fairfax County residents' },
        { status: 400 }
      )
    }

    // 5. Get active season
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true }
    })

    if (!activeSeason) {
      return NextResponse.json(
        { error: 'No active season available for registration' },
        { status: 400 }
      )
    }

    // 6. Hash password
    const hashedPassword = await hashPassword(data.password)

    // 7. Create user and player in a transaction
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        player: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            dob: new Date(data.dob),
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            fairfaxCounty: true,
            position: data.position,
            tshirtSize: data.tshirtSize,
            contactMe: data.contactMe || false,
            social: data.social || false,
            tournaments: data.tournaments || false,
            boardMemberCode: data.boardMemberCode,
            discountCode: data.discountCode,
            teamPaidFullCode: data.teamPaidFullCode,
            finalApproval: 'NEEDS_REVIEW',
            status: 'ACTIVE',
          }
        }
      },
      include: { player: true }
    })

    // 8. Create registration record
    const registration = await prisma.registration.create({
      data: {
        playerId: user.player!.id,
        seasonId: activeSeason.id,
        registrationType: 'NEW_PLAYER',
        selectedTeams: JSON.stringify(data.teamIds || []),
        captainRequests: data.captainTeamIds ? JSON.stringify(data.captainTeamIds) : null,
        totalAmount: 125.00, // Base registration fee
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      }
    })

    // 9. Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'NVASA Season Registration',
            description: `${activeSeason.name} - ${data.firstName} ${data.lastName}`,
          },
          unit_amount: 12500, // $125.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_URL}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/register/new`,
      client_reference_id: registration.id,
      customer_email: data.email,
      metadata: {
        registrationId: registration.id,
        playerId: user.player!.id,
        userId: user.id,
      },
    })

    return NextResponse.json({ 
      success: true,
      checkoutUrl: session.url 
    })

  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    )
  }
}