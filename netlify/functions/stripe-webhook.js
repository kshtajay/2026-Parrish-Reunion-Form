const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed"
      };
    }

    const signature =
      event.headers["stripe-signature"] ||
      event.headers["Stripe-Signature"];

    if (!signature) {
      return {
        statusCode: 400,
        body: "Missing Stripe signature"
      };
    }

    let stripeEvent;

    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Invalid Stripe signature:", err.message);
      return {
        statusCode: 400,
        body: "Invalid signature"
      };
    }

    console.log("Stripe event received:", stripeEvent.type, stripeEvent.id);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      if (session.payment_status === "paid") {
        const sessionId = session.id;

        const appsScriptUrl =
          `${process.env.APPS_SCRIPT_WEBAPP_URL}` +
          `?action=verify_payment` +
          `&session_id=${encodeURIComponent(sessionId)}` +
          `&token=${encodeURIComponent(process.env.APPS_SCRIPT_SHARED_TOKEN)}`;

        const response = await fetch(appsScriptUrl, {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });

        const text = await response.text();

        console.log("Apps Script response status:", response.status);
        console.log("Apps Script response body:", text);

        if (!response.ok) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: "Apps Script verification failed",
              status: response.status,
              response: text
            })
          };
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (err) {
    console.error("Netlify webhook error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
