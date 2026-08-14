import StripePaymentPlan from "@/components/stripe-payment-plan";

export default function PaymentPage() {
    return (
        <div style={{
            maxWidth: "1200px",
            margin: "40px auto",
            padding: "20px",
            minHeight: "600px"
        }}>
            <StripePaymentPlan />
        </div>
    );
}
