import Stripe from "stripe";
import { config } from "../../config/index.js";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertStripePriceId, getStripeClient } from "../../utils/stripe.js";

type CheckoutPlanType = "starter" | "professional";
type CheckoutMode = "hosted" | "embedded";

interface CheckoutSessionOptions {
  cancelUrl?: string | null;
  mode?: CheckoutMode | null;
  returnUrl?: string | null;
  successUrl?: string | null;
  trialDays?: number | null;
}

interface CheckoutSessionStatusResponse {
  id: string;
  paymentStatus: string | null;
  status: string | null;
  subscriptionId: string | null;
}

export class BillingService {
  // Get current subscription and usage data for the billing screen
  async getBillingStatus(clinicId: string) {
    const [rows]: any = await pool.execute(
      `SELECT
          id,
          subscription_plan as subscriptionPlan,
          subscription_status as subscriptionStatus,
          stripe_subscription_id as stripeSubscriptionId,
          plan_expires_at as planExpiresAt,
          max_users as maxUsers
       FROM clinic
       WHERE id = ? AND deleted_at IS NULL`,
      [clinicId],

      
    );

    if (rows.length === 0) throw ApiError.notFound("Clinic not found");
    const clinic = rows[0];

    const [usageRows]: any = await pool.execute(
      `SELECT
          (SELECT COUNT(*) FROM user WHERE clinic_id = ? AND deleted_at IS NULL) as teamMembers,
          (SELECT COUNT(*) FROM clinic_location WHERE clinic_id = ? AND deleted_at IS NULL) as locations,
          (SELECT COUNT(*) FROM contact WHERE clinic_id = ? AND deleted_at IS NULL) as contacts`,
      [clinicId, clinicId, clinicId],
    );

    return {
      subscriptionPlan: clinic.subscriptionPlan,
      subscriptionStatus: clinic.subscriptionStatus,
      planExpiresAt: clinic.planExpiresAt ? new Date(clinic.planExpiresAt).toISOString() : null,
      hasStripeSubscription: !!clinic.stripeSubscriptionId,
      usage: {
        teamMembers: Number(usageRows[0]?.teamMembers || 0),
        maxUsers: Number(clinic.maxUsers || 0),
        locations: Number(usageRows[0]?.locations || 0),
        contacts: Number(usageRows[0]?.contacts || 0),
      },
    };
  }

  //Create a Stripe Checkout session for a clinic
  async createCheckoutSession(
    clinicId: string,
    planType: CheckoutPlanType,
    options: CheckoutSessionOptions = {},
  ) {
    const stripe = getStripeClient();

    // 1. Get clinic details
    const [rows]: any = await pool.execute(
      "SELECT name, email, stripe_customer_id FROM clinic WHERE id = ?",
      [clinicId]
    );

    if (rows.length === 0) throw ApiError.notFound("Clinic not found");
    const clinic = rows[0];

    // 2. Map plan type to Stripe Price ID
    const priceId = assertStripePriceId(config.stripe.plans[planType]);
    const appUrl = config.frontendUrl.replace(/\/$/, "");

    // 3. Create or fetch Stripe Customer
    let customerId = clinic.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clinic.email,
        name: clinic.name,
        metadata: { clinicId }
      });
      customerId = customer.id;
      
      // Save the customer ID to our DB
      await pool.execute(
        "UPDATE clinic SET stripe_customer_id = ? WHERE id = ?",
        [customerId, clinicId]
      );
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      metadata: { clinicId, planType },
    };

    if (options.trialDays) {
      sessionParams.subscription_data = {
        trial_period_days: options.trialDays,
      };
    }

    // 4. Create the Checkout Session
    if (options.mode === "embedded") {
      const session = await stripe.checkout.sessions.create({
        ...sessionParams,
        ui_mode: "embedded_page",
        redirect_on_completion: "if_required",
        return_url:
          options.returnUrl ||
          `${appUrl}/signup/payment?checkout_session_id={CHECKOUT_SESSION_ID}`,
      });

      if (!session.client_secret) {
        throw ApiError.internal("Stripe did not return an embedded checkout client secret.");
      }

      return {
        clientSecret: session.client_secret,
        sessionId: session.id,
        url: null,
      };
    }

    const session = await stripe.checkout.sessions.create({
      ...sessionParams,
      success_url: options.successUrl || `${appUrl}/app/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: options.cancelUrl || `${appUrl}/app/settings/billing?canceled=true`,
    });

    return { clientSecret: null, sessionId: session.id, url: session.url };
  }

  async getCheckoutSessionStatus(
    clinicId: string,
    sessionId: string,
  ): Promise<CheckoutSessionStatusResponse> {
    if (!sessionId?.startsWith("cs_")) {
      throw ApiError.badRequest("Invalid checkout session ID.");
    }

    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);

    if (session.metadata?.clinicId !== clinicId) {
      throw ApiError.forbidden("Checkout session does not belong to this clinic.");
    }

    if (session.status === "complete") {
      await this.applyCompletedSubscriptionSession(session);
    }

    return {
      id: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      subscriptionId:
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || null,
    };
  }

  // Cancel an active subscription
   
  async cancelSubscription(clinicId: string) {
    const [rows]: any = await pool.execute(
      "SELECT stripe_subscription_id FROM clinic WHERE id = ?",
      [clinicId]
    );

    const subscriptionId = rows[0]?.stripe_subscription_id;
    if (!subscriptionId) throw ApiError.badRequest("No active subscription found");

    // Cancel at end of period (standard practice)
    await getStripeClient().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    await pool.execute(
      "UPDATE clinic SET subscription_status = 'canceling' WHERE id = ?",
      [clinicId]
    );
  }




  
  // Process Stripe Webhooks (Updates DB on payment success/failure)
  async handleWebhook(rawBody: any, signature: string) {
    let event: Stripe.Event;

    try {
      event = getStripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        config.stripe.webhookSecret.trim()
      );
    } catch (err: any) {
      throw ApiError.badRequest(`Webhook Signature Verification Failed: ${err.message}`);
    }

    // Handle different Stripe events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const depositId = metadata.depositId as string | undefined;

        await this.applyCompletedSubscriptionSession(session);

        if (depositId) {
          await pool.execute(
            `UPDATE deposit_record
             SET status = 'paid',
                 payment_status = 'paid',
                 stripe_session_id = ?,
                 stripe_payment_intent_id = ?,
                 paid_at = CURRENT_TIMESTAMP,
                 deposit_paid = 1,
                 paid_date = CURRENT_DATE
             WHERE id = ? AND clinic_id = ?`,
            [session.id, session.payment_intent as string || null, depositId, metadata.clinicId || null],
          );

          console.log(`[STRIPE] Deposit ${depositId} marked paid via session ${session.id}`);
        }

        break;
      }


      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const metadata = (pi.metadata || {}) as any;
        const depositId = metadata.depositId as string | undefined;
        if (depositId) {
          await pool.execute(
            `UPDATE deposit_record
             SET status = 'failed',
                 payment_status = 'failed',
                 provider_response = ?,
                 provider_error = ?,
                 payment_attempted_at = CURRENT_TIMESTAMP
             WHERE id = ? AND clinic_id = ?`,
            [JSON.stringify(pi.last_payment_error || {}), pi.last_payment_error?.message || null, depositId, metadata.clinicId || null],
          );
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const metadata = (charge.metadata || {}) as any;
        const depositId = metadata.depositId as string | undefined;
        if (depositId) {
          await pool.execute(
            `UPDATE deposit_record
             SET status = 'refunded',
                 payment_status = 'refunded',
                 refunded_at = CURRENT_TIMESTAMP
             WHERE id = ? AND clinic_id = ?`,
            [depositId, metadata.clinicId || null],
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await pool.execute(
          "UPDATE clinic SET subscription_status = 'inactive', stripe_subscription_id = NULL WHERE stripe_subscription_id = ?",
          [subscription.id]
        );
        break;
      }
    }
  }

  private async applyCompletedSubscriptionSession(session: Stripe.Checkout.Session) {
    const metadata = session.metadata || {};
    const { clinicId, planType } = metadata;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (!clinicId || !subscriptionId) return;

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;
    const expiresAt = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;

    await pool.execute(
      `UPDATE clinic SET 
        stripe_subscription_id = ?, 
        subscription_plan = ?, 
        subscription_status = ?,
        plan_expires_at = ?
      WHERE id = ?`,
      [subscriptionId, planType ?? null, subscription.status, expiresAt, clinicId]
    );
    console.log(`[STRIPE] Clinic ${clinicId} upgraded to ${planType}`);
  }

}

export const billingService = new BillingService();
