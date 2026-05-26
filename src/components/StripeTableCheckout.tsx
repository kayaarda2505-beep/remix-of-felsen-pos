import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

export function StripeTableCheckout({ qrToken, returnUrl }: { qrToken: string; returnUrl: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const response = await fetch("/api/public/payments/create-table-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken, returnUrl, environment: getStripeEnvironment() }),
    });
    if (!response.ok) throw new Error(await response.text());
    const { clientSecret } = await response.json();
    if (!clientSecret) throw new Error("Keine Checkout-Session erhalten");
    return clientSecret;
  };

  return (
    <div id="checkout" className="bg-white rounded-2xl overflow-hidden">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
