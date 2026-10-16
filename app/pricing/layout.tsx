import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing · InField 7",
  description: "Credits, not seats. One Basic AI plan for Indian field teams. Calculate a rupee estimate before you sign in.",
  openGraph: {
    title: "InField 7 pricing",
    description: "Monthly AI credit pool. Basic is sold. Premium, Ultra, air-gap, and Singapore stay off this product.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
