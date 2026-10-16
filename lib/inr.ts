export function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: amount % 1 ? 2 : 0 })}`;
}
