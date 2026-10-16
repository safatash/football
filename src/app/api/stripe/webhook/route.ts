import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    // For local testing, we'll skip signature verification
    // In production, you MUST verify the signature
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } else {
      // Local development - parse without verification
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const registrationId = session.metadata?.registrationId
    const playerId = session.metadata?.playerId
    const userId = session.metadata?.userId

    if (!registrationId || !playerId || !userId) {
      console.error('Missing metadata in webhook')
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    try {
      // Create payment record
      await prisma.payment.create({
        data: {
          userId: userId,
          stripePaymentIntentId: session.payment_intent as string,
          stripeChargeId: session.id,
          amount: (session.amount_total || 0) / 100, // Convert cents to dollars
          currency: session.currency || 'usd',
          status: 'PAID',
          paymentType: 'REGISTRATION_FEE',
          relatedEntityType: 'registration',
          relatedEntityId: registrationId,
          paidAt: new Date(),
        }
      })

      // Update registration payment status
      await prisma.registration.update({
        where: { id: registrationId },
        data: { 
          paymentStatus: 'PAID',
          paymentId: session.payment_intent as string,
        }
      })

      console.log('✅ Payment recorded for registration:', registrationId)
    } catch (error) {
      console.error('Error processing webhook:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ received: true })
}