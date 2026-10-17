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
    } else if (process.env.NODE_ENV !== 'production') {
      // Local development only: accept unsigned events (e.g. `stripe trigger`) when no secret is set
      event = JSON.parse(body) as Stripe.Event
    } else {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : err)
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
      // Stripe retries webhooks: skip if this checkout session was already recorded
      const already = await prisma.payment.findUnique({ where: { stripeChargeId: session.id } })
      if (!already) {
        await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              // Payment.userId references players.id in the schema
              userId: playerId,
              stripePaymentIntentId: (session.payment_intent as string | null) ?? null,
              stripeChargeId: session.id,
              amount: (session.amount_total || 0) / 100, // cents → dollars
              currency: session.currency || 'usd',
              status: 'PAID',
              paymentType: 'REGISTRATION_FEE',
              relatedEntityType: 'registration',
              relatedEntityId: registrationId,
              paidAt: new Date(),
            },
          })
          await tx.registration.update({
            where: { id: registrationId },
            data: { paymentStatus: 'PAID', paymentId: payment.id },
          })
        })
      }

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