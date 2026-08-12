"use client";

import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe, StripeEmbeddedCheckout } from "@stripe/stripe-js";
import "../styles/payment-plan.css";
import { APP_CONFIG } from "@/app/config/config";

// Initialize Stripe
const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    "pk_test_51K1z56Eeg15rVxNiepHNptvdxEqD6psBw1eSLcSuQPEz0xlqCnRjdEQo8OMhfO6tfSog5wbQtfZ46cggsXU2rEOH00mmmTAFQa"
);

// Workflow endpoints
const WORKFLOW_BASE_URL = APP_CONFIG.PUBLIC_API_URL.replace(/\/$/, '');
const CREATE_SESSION_WORKFLOW = APP_CONFIG.CREATE_SESSION_WF;
const PAYMENT_MAIL_WORKFLOW = APP_CONFIG.PAYMENT_MAIL_WF;
const PRICING_DETAILS_WORKFLOW = APP_CONFIG.PRICING_DETAILS_WF;

interface StripePaymentPlanProps {
    onClose?: () => void;
}

interface PricingData {
    monthly_price?: string;
    yearly_price?: string;
    yearly_original_price?: string;
    savings?: string;
    monthly_end_date?: string;
    yearly_end_date?: string;
    monthly_due_today?: string;
    yearly_due_today?: string;
    monthly_price_id?: string;
    yearly_price_id?: string;
    monthly_users?: string;
    yearly_users?: string;
}

export default function StripePaymentPlan({ onClose }: StripePaymentPlanProps) {
    const [selectedPlan, setSelectedPlan] = useState("");
    const [showCheckout, setShowCheckout] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState("");
    const [checkout, setCheckout] = useState<StripeEmbeddedCheckout | null>(null);
    const [sessionId, setSessionId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [pricingData, setPricingData] = useState<PricingData | null>(null);
    const [loadingPricing, setLoadingPricing] = useState(true);
    const [currency, setCurrency] = useState<string>("USD");
    const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);

    // Helper function to get currency symbol
    const getCurrencySymbol = (currencyCode: string): string => {
        switch (currencyCode?.toUpperCase()) {
            case "USD":
                return "$";
            case "JPY":
            case "YEN":
                return "¥";
            default:
                return "$";
        }
    };

    const initializeCheckout = async (priceId: string) => {
        setLoading(true);
        setError("");

        try {
            const stripe = await stripePromise;
            if (!stripe) {
                throw new Error("Stripe failed to load. Please check your internet connection.");
            }

            // Destroy previous checkout if exists
            if (checkout) {
                checkout.destroy();
            }

            let currentSessionId = ""; // Local variable to capture session ID

            const fetchClientSecret = async () => {
                const data = new FormData();
                data.append("data", JSON.stringify([{ price: priceId }]));

                const response = await fetch(
                    `${WORKFLOW_BASE_URL}/${CREATE_SESSION_WORKFLOW}`,
                    { method: "POST", body: data }
                );

                if (!response.ok) {
                    throw new Error("Failed to create checkout session");
                }

                const json = await response.json();
                const parsed = JSON.parse(json[0]["0.0.result"]);

                currentSessionId = parsed.id; // Capture in local variable
                setSessionId(parsed.id);
                return parsed.client_secret;
            };

            const embeddedCheckout = await stripe.initEmbeddedCheckout({
                fetchClientSecret,
                onComplete: async () => {
                    // Hide checkout and show success screen
                    setShowCheckout(false);
                    setShowSuccess(true);

                    // Call payment confirmation workflow with captured session ID
                    const data = new FormData();
                    data.append("data", JSON.stringify([{ session_id: currentSessionId }]));

                    try {
                        const response = await fetch(
                            `${WORKFLOW_BASE_URL}/${PAYMENT_MAIL_WORKFLOW}`,
                            { method: "POST", body: data }
                        );

                        const result = await response.json();
                        const receiptUrlFromResponse = result[0]?.receipt_url;

                        if (receiptUrlFromResponse) {
                            setReceiptUrl(receiptUrlFromResponse);
                        } else {
                            console.error("Receipt URL not found");
                        }
                    } catch (error) {
                        console.error("Error fetching receipt:", error);
                    }

                    // Trigger subscription status update workflow
                    try {
                        const subscriptionData = new FormData();
                        subscriptionData.append("data", JSON.stringify([{ identifier: 'subscribed' }]));

                        const subscriptionResponse = await fetch(
                            `${WORKFLOW_BASE_URL}/${PRICING_DETAILS_WORKFLOW}`,
                            { method: "POST", body: subscriptionData }
                        );

                        if (subscriptionResponse.ok) {
                            const subscriptionResult = await subscriptionResponse.json();
                            // Store the first item from the response array
                            if (subscriptionResult && subscriptionResult.length > 0) {
                                setSubscriptionDetails(subscriptionResult[0]);
                            }
                        }
                    } catch (error) {
                        console.error("Error updating subscription status:", error);
                    }
                },
            });

            setCheckout(embeddedCheckout);
            embeddedCheckout.mount("#checkout");
            setLoading(false);
        } catch (error) {
            console.error("Error initializing checkout:", error);
            setError(error instanceof Error ? error.message : "Failed to initialize checkout. Please try again.");
            setLoading(false);
            setShowCheckout(false);
        }
    };

    const handleNextClick = () => {
        if (!selectedPlan) {
            alert("Please select a plan before continuing.");
            return;
        }

        initializeCheckout(selectedPlan);
        setShowCheckout(true);
    };

    // Fetch pricing data from workflow
    const fetchPricingData = async () => {
        try {
            setLoadingPricing(true);
            const data = new FormData();
            data.append("data", JSON.stringify([{ identifier: 'SubPlan' }]));

            const response = await fetch(
                `${WORKFLOW_BASE_URL}/${PRICING_DETAILS_WORKFLOW}`,
                { method: "POST", body: data }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch pricing details");
            }

            const result = await response.json();

            // Response is an array with monthly and yearly objects
            const monthlyPlan = result.find((item: any) => item.product?.includes("monthly"));
            const yearlyPlan = result.find((item: any) => item.product?.includes("yearly"));

            if (monthlyPlan && yearlyPlan) {
                const monthlyPrice = parseFloat(monthlyPlan.price);
                const yearlyPrice = parseFloat(yearlyPlan.price);
                const savings = (monthlyPrice * 12) - yearlyPrice;
                const currencyCode = monthlyPlan.currency || "USD";
                const symbol = getCurrencySymbol(currencyCode);

                // Store currency
                setCurrency(currencyCode);

                // Calculate end dates
                const monthlyEndDate = new Date();
                monthlyEndDate.setMonth(monthlyEndDate.getMonth() + 1);
                const formattedMonthlyEndDate = monthlyEndDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const yearlyEndDate = new Date();
                yearlyEndDate.setFullYear(yearlyEndDate.getFullYear() + 1);
                const formattedYearlyEndDate = yearlyEndDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const pricingInfo: PricingData = {
                    monthly_price: `${symbol}${monthlyPrice.toLocaleString()}`,
                    yearly_price: `${symbol}${yearlyPrice.toLocaleString()}`,
                    yearly_original_price: `${symbol}${(monthlyPrice * 12).toLocaleString()}`,
                    savings: `${symbol}${savings.toLocaleString()}`,
                    monthly_end_date: formattedMonthlyEndDate,
                    yearly_end_date: formattedYearlyEndDate,
                    monthly_due_today: `${symbol}${monthlyPrice.toLocaleString()}`,
                    yearly_due_today: `${symbol}${yearlyPrice.toLocaleString()}`,
                    monthly_price_id: monthlyPlan.price_Id,
                    yearly_price_id: yearlyPlan.price_Id,
                    monthly_users: monthlyPlan.access_users,
                    yearly_users: yearlyPlan.access_users,
                };

                setPricingData(pricingInfo);

                // Set default selected plan to yearly
                if (pricingInfo.yearly_price_id) {
                    setSelectedPlan(pricingInfo.yearly_price_id);
                }
            }
        } catch (error) {
            console.error("Error fetching pricing data:", error);
            // Keep using default values if fetch fails
        } finally {
            setLoadingPricing(false);
        }
    };

    // Fetch pricing data on component mount
    useEffect(() => {
        fetchPricingData();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (checkout) {
                checkout.destroy();
            }
        };
    }, [checkout]);

    return (
        <div className="flex justify-between flex-1 bg-[#1b1b1b] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden h-full relative">
            {/* Loading State */}
            {loadingPricing && !showCheckout && !showSuccess && (
                <>
                    <div className="flex flex-col flex-1 p-0 justify-center items-center bg-[#1b1b1b]">
                        <div className="text-center">
                            <div className="w-[50px] h-[50px] border-4 border-[rgba(91,159,255,0.2)] border-t-[#5B9FFF] rounded-full animate-spin mx-auto mb-5"></div>
                            <div className="text-white text-base">Loading plans...</div>
                        </div>
                    </div>
                    <div className="flex-1 bg-cover bg-center bg-no-repeat opacity-60 w-full h-full rounded-2xl shadow-md overflow-hidden rounded-tl-none rounded-bl-none" style={{ backgroundImage: "url('https://static.vizru.com/rover/payment-bg.webp')" }}></div>
                </>
            )}

            {/* Plan Selection UI */}
            {!loadingPricing && !showCheckout && !showSuccess && (
                <>
                    <div className="flex flex-col flex-1 p-0 justify-between bg-[#1b1b1b]">
                        <div className="p-10 px-[30px]">
                            <div className="text-[1.4rem] font-semibold text-white mb-2">Choose your plan</div>
                            <div className="text-[0.85rem] text-[rgba(156,156,156,1)] !mt-0 !mb-[30px]">
                                Unlock all premium features, Pay only for what you use
                            </div>

                            <div className={`bg-[rgba(42,42,71,0.6)] relative mb-[15px] rounded-xl overflow-hidden p-0 border border-[rgba(75,75,95,0.8)] transition-all duration-300 hover:border-[rgba(95,95,115,1)] hover:bg-[rgba(48,48,78,0.7)] ${selectedPlan === pricingData?.monthly_price_id ? '!bg-white !border-[#5865F2]' : ''}`}>
                                <div className="p-5 bg-transparent relative rounded-xl overflow-hidden">
                                    <input
                                        className="absolute left-[-9999px]"
                                        type="radio"
                                        name="plan"
                                        id="monthly"
                                        value={pricingData?.monthly_price_id}
                                        checked={selectedPlan === (pricingData?.monthly_price_id)}
                                        onChange={(e) => setSelectedPlan(e.target.value)}
                                    />
                                    <label className="relative pr-7 cursor-pointer leading-5 inline-block w-full text-white" htmlFor="monthly">
                                        <div className="flex flex-col justify-between w-full">
                                            <span className={selectedPlan === pricingData?.monthly_price_id ? 'text-black' : ''}>
                                                <span className="flex-1 w-full font-semibold">Rover Pro </span>- Billed monthly</span>
                                            <span className={`flex-1 w-full text-base border-t border-dashed border-[rgba(96,96,96,0.4)] mt-3 pt-3 ${selectedPlan === pricingData?.monthly_price_id ? 'text-black' : 'text-white'}`}>
                                                1 Month <span className="font-bold">{pricingData?.monthly_price}</span> for {pricingData?.monthly_users} user{pricingData?.monthly_users !== "1" ? "s" : ""}
                                            </span>
                                        </div>
                                        {/* Custom radio button */}
                                        <span className={`absolute right-[-6px] top-0 w-5 h-5 border-2 ${selectedPlan === pricingData?.monthly_price_id ? 'border-[#5865F2]' : 'border-[#5865F2]'} rounded-full bg-transparent`}></span>
                                        {selectedPlan === pricingData?.monthly_price_id && (
                                            <span className="absolute right-[-2px] top-1 w-3 h-3 bg-[#5865F2] rounded-full transition-all duration-200"></span>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className={`bg-[rgba(42,42,71,0.6)] relative mb-[15px] rounded-xl overflow-hidden p-0 border border-[rgba(75,75,95,0.8)] transition-all duration-300 hover:border-[rgba(95,95,115,1)] hover:bg-[rgba(48,48,78,0.7)] ${selectedPlan === pricingData?.yearly_price_id ? '!bg-white !border-[#5865F2]' : ''}`}>
                                <div className="p-5 bg-transparent relative rounded-xl overflow-hidden">
                                    <input
                                        className="absolute left-[-9999px]"
                                        type="radio"
                                        name="plan"
                                        id="yearly"
                                        value={pricingData?.yearly_price_id}
                                        checked={selectedPlan === (pricingData?.yearly_price_id)}
                                        onChange={(e) => setSelectedPlan(e.target.value)}
                                    />
                                    <label className="relative pr-7 cursor-pointer leading-5 inline-block w-full text-white" htmlFor="yearly">
                                        <div className="flex flex-col justify-between w-full">
                                            <span className={`flex flex-1 justify-between w-full ${selectedPlan === pricingData?.yearly_price_id ? 'text-black' : ''}`}>
                                                <span>
                                                    <span className="font-semibold">Rover Pro</span> - Yearly
                                                </span>
                                                {pricingData?.savings && pricingData.savings !== "$0" && (
                                                    <span className={`${selectedPlan === pricingData?.yearly_price_id ? 'bg-[#4169E1] text-white' : 'bg-[#4169E1] text-white'} px-3 py-1 rounded-md text-xs whitespace-nowrap font-medium`}>
                                                        ⭐ Best Value -You Save {pricingData?.savings}!
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`flex-1 w-full text-base border-t border-dashed border-[rgba(96,96,96,0.4)] mt-3 pt-3 ${selectedPlan === pricingData?.yearly_price_id ? 'text-black' : 'text-white'}`}>
                                                12 Month {pricingData?.savings && pricingData.savings !== "$0" && (
                                                    <span className={`font-bold line-through ${selectedPlan === pricingData?.yearly_price_id ? 'text-[#666666]' : 'opacity-50'} mr-2`}>{pricingData?.yearly_original_price}</span>
                                                )} <span className={`font-bold ${selectedPlan === pricingData?.yearly_price_id ? 'text-[#00D66B]' : 'text-[#00D66B]'}`}>{pricingData?.yearly_price}</span> for {pricingData?.yearly_users} user{pricingData?.yearly_users !== "1" ? "s" : ""}
                                            </span>
                                        </div>
                                        {/* Custom radio button */}
                                        <span className={`absolute right-[-6px] top-0 w-5 h-5 border-2 ${selectedPlan === pricingData?.yearly_price_id ? 'border-[#5865F2]' : 'border-[#5865F2]'} rounded-full bg-transparent`}></span>
                                        {selectedPlan === pricingData?.yearly_price_id && (
                                            <span className="absolute right-[-2px] top-1 w-3 h-3 bg-[#5865F2] rounded-full transition-all duration-200"></span>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-4 py-0 px-[30px] pb-[30px]">
                            <div className="text-[0.95rem] flex justify-between items-center text-[rgba(180,180,180,1)] mb-2 !mt-[25px]">
                                <span>Ends on</span>
                                <span className="flex-1 h-px border-t border-dashed border-[rgba(96,96,96,0.4)] mx-[15px]"></span>
                                <span>
                                    {selectedPlan === pricingData?.monthly_price_id
                                        ? pricingData?.monthly_end_date
                                        : pricingData?.yearly_end_date}
                                </span>
                            </div>
                            <div className="text-[0.95rem] flex justify-between items-center text-white mb-2 font-semibold">
                                <span>Due Today</span>
                                <span className="flex-1 h-px border-t border-dashed border-[rgba(96,96,96,0.4)] mx-[15px]"></span>
                                <span>
                                    {selectedPlan === pricingData?.monthly_price_id
                                        ? pricingData?.monthly_due_today
                                        : pricingData?.yearly_due_today}
                                </span>
                            </div>
                            {error && (
                                <div className="bg-[rgba(254,67,67,0.15)] text-[#ff6b6b] p-3 rounded-lg mb-[10px] text-[0.9rem] border border-[rgba(254,67,67,0.3)]">
                                    {error}
                                </div>
                            )}
                            <button
                                className="w-full container-gradient text-white border-none font-semibold py-[14px] px-5 rounded-lg mt-5 mb-[10px] cursor-pointer transition-all duration-200 text-base hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                onClick={handleNextClick}
                                disabled={loading}
                            >
                                {loading ? "Loading..." : "Next"}
                            </button>
                            <p className="mt-2 text-left text-[0.8rem] text-[rgba(140,140,140,1)] leading-[1.4]">
                                By continuing, you agree to the <a href="#" className="text-[#5865F2] underline">Terms of Use</a> applicable to Rover Teams and confirm you have read our <a href="#" className="text-[#5865F2] underline">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 bg-cover bg-center bg-no-repeat opacity-60 w-full h-full rounded-2xl shadow-md overflow-hidden rounded-tl-none rounded-bl-none" style={{ backgroundImage: "url('https://static.vizru.com/rover/payment-bg.webp')" }}></div>
                </>
            )}


            {/* Success Screen */}
            {showSuccess && (
                <>
                    <div className="flex flex-col flex-1 p-0 justify-between bg-[#1b1b1b] relative">
                        <div className="p-0">
                            <div className="bg-gradient-to-r from-[#E0FFF0] to-[#BAFFDD] flex flex-col justify-center h-[360px] rounded-tl-[20px] items-center">
                                <div className="text-center">
                                    <img
                                        src="https://static.vizru.com/rover/payment-success.gif"
                                        alt="Payment success animation"
                                        className="w-[150px]"
                                    />
                                </div>
                                <div className="text-[22px] font-semibold text-[#1a1a1a]">Payment Successful!</div>
                                <div className="text-sm text-[#666] mt-2">
                                    You&apos;re now subscribed to Rover Pro. Thank you!
                                </div>
                            </div>

                            {/* Plan Details Section */}
                            <div className="bg-[#1b1b1b] py-[55px] px-[30px] border-t border-[rgba(75,75,95,0.3)]">

                                <div className="text-[0.95rem] font-semibold text-white mb-[15px] flex items-center">
                                    <span>Plan Details</span>
                                    <span className="flex-1 h-px border-t border-dashed border-[rgba(96,96,96,0.4)] mx-[15px]"></span>
                                </div>

                                <div className="flex justify-between items-center py-2 text-[0.9rem] text-white font-light">
                                    <span>{subscriptionDetails?.months}</span>
                                    <span className="text-white font-medium">
                                        {subscriptionDetails ?
                                            `${getCurrencySymbol(subscriptionDetails.currency)}${parseFloat(subscriptionDetails.price).toLocaleString()}`
                                            : (selectedPlan === pricingData?.monthly_price_id
                                                ? pricingData?.monthly_price
                                                : pricingData?.yearly_price)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 text-[0.9rem] text-white font-light">
                                    <span>Start Date</span>
                                    <span className="text-white font-medium">
                                        {new Date().toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 text-[0.9rem] text-white font-light">
                                    <span>Auto-Renewal</span>
                                    <span className="text-white font-medium">On</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-[15px] py-[25px] px-[30px] bg-[#1b1b1b] items-center absolute bottom-0 left-0 right-0 w-full box-border">
                                {receiptUrl && (
                                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                                        <button className="w-full bg-transparent border border-[rgba(153,153,153,1)] text-white font-semibold py-[14px] px-5 rounded-[10px] cursor-pointer transition-all duration-200 text-base hover:bg-[rgba(153,153,153,0.1)]">
                                            Download Invoice ⤓
                                        </button>
                                    </a>
                                )}
                                <button className="flex container-gradient border-none text-white font-semibold py-[14px] px-9 rounded-[10px] cursor-pointer transition-all duration-200 text-base hover:opacity-90" onClick={onClose}>
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-cover bg-center bg-no-repeat opacity-60 w-full h-full rounded-2xl shadow-md overflow-hidden rounded-tl-none rounded-bl-none bg-[position:-200px_center]" style={{ backgroundImage: "url('https://static.vizru.com/rover/payment-bg.webp')" }}></div>
                </>
            )}

            {/* Embedded Checkout */}
            <div
                id="checkout"
                style={{
                    display: showCheckout ? "flex" : "none",
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    backgroundColor: "#ffffffff",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            ></div>
        </div>
    );
}
