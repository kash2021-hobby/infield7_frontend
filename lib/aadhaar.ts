const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function aadhaarDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

function verhoeffOk(digits: string) {
  let c = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i += 1) {
    c = d[c][p[i % 8][reversed[i]]];
  }
  return c === 0;
}

export function isValidAadhaar(raw: string) {
  const digits = aadhaarDigits(raw);
  if (digits.length !== 12) return false;
  if (digits[0] === "0" || digits[0] === "1") return false;
  return verhoeffOk(digits);
}

export function maskAadhaar(raw: string) {
  const digits = aadhaarDigits(raw);
  if (digits.length < 4) return "";
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function panOk(raw: string) {
  const value = raw.trim().toUpperCase();
  if (!value) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}
