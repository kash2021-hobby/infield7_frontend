export type CsvTable = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n" || (char === "\r" && next === "\n")) {
      if (char === "\r") i += 1;
      row.push(cell.trim());
      if (row.some((part) => part)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  row.push(cell.trim());
  if (row.some((part) => part)) rows.push(row);
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  const width = Math.max(headers.length, ...rows.map((item) => item.length), 0);
  return {
    headers: headers.concat(Array.from({ length: Math.max(0, width - headers.length) }, (_, i) => `Column ${headers.length + i + 1}`)),
    rows: rows.map((item) => {
      const next = item.slice(0, width);
      while (next.length < width) next.push("");
      return next;
    }),
  };
}

export const IMPORT_FIELDS = [
  { id: "name", label: "Name" },
  { id: "phone", label: "Phone" },
  { id: "jobTitle", label: "Role" },
  { id: "department", label: "Department" },
  { id: "site", label: "Site" },
  { id: "aadhaar", label: "ID number" },
  { id: "ignore", label: "Ignore" },
] as const;

export type ImportFieldId = (typeof IMPORT_FIELDS)[number]["id"];

const ALIASES: Record<ImportFieldId, string[]> = {
  name: ["name", "full name", "employee", "employee name"],
  phone: ["phone", "mobile", "mobile number", "phone number"],
  jobTitle: ["role", "role/designation", "designation", "title", "job title"],
  department: ["dept", "department"],
  site: ["site", "site name"],
  aadhaar: ["aadhaar", "aadhar", "id number", "id"],
  ignore: ["wage", "salary", "base salary", "pay"],
};

export function guessMapping(headers: string[]): ImportFieldId[] {
  const used = new Set<ImportFieldId>();
  return headers.map((header) => {
    const key = header.trim().toLowerCase();
    const hit = (Object.keys(ALIASES) as ImportFieldId[]).find((id) => {
      if (id !== "ignore" && used.has(id)) return false;
      return ALIASES[id].includes(key);
    });
    if (hit && hit !== "ignore") used.add(hit);
    return hit ?? "ignore";
  });
}

export function toCsv(headers: string[], rows: string[][]) {
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  return [headers, ...rows].map((row) => row.map((cell) => escape(cell ?? "")).join(",")).join("\n");
}
