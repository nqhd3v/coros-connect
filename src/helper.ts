import {
  CorosDailyHealthParsed,
  CorosDailyHealthParsedData,
  CorosDailyHealthSummary,
  CorosDeviceParsed,
  CorosRecoveryStatus,
  CorosRecoveryStatusResult,
  CorosToolResult,
  CorosTraining,
  CorosUserInfo,
} from "./types.ts";

// a single word that is already camelCase (e.g. `idInPlan`) is kept as is
const RG_CAMEL_CASE_WORD = /^[a-z]+[A-Z][a-zA-Z]*$/;

export const toCamelCase = (fieldName: string) => {
  if (RG_CAMEL_CASE_WORD.test(fieldName.trim())) return fieldName.trim();

  return fieldName
    .trim()
    .split(/\s+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : [word[0].toUpperCase(), word.slice(1).toLowerCase()].join(""),
    )
    .join("");
};

enum FieldRowFormat {
  OBJECT_FIELD = "Object-Field", // Parent Field: Field1 200 unit | Field2 300 unit1
  LIST_FIELD = "List-Field", // Field1: 200 unit | Field2: 300 unit1
}
const getFieldRowFormat = (fieldRow: string) => {
  const fields = fieldRow.split(" | ");
  return fields.every((field) => field.includes(":"))
    ? FieldRowFormat.LIST_FIELD
    : FieldRowFormat.OBJECT_FIELD;
};
// split at the first ":" only, so values like `23:10` stay whole
const splitFieldAtColon = (field: string): [string, string] => {
  const colonIndex = field.indexOf(":");
  if (colonIndex === -1) return [field, ""];
  return [field.slice(0, colonIndex), field.slice(colonIndex + 1)];
};
// keys come from free text, so the shape can only be asserted, not checked
const mapFieldRowToSummary = <T extends object = Record<string, string>>(
  fieldRow: string,
  format: FieldRowFormat = getFieldRowFormat(fieldRow),
): T => {
  const res: Record<string, string> = {};
  if (!fieldRow.trim()) return res as T;

  if (format === FieldRowFormat.LIST_FIELD) {
    // `Steps: 8,420 | Calories: 512 kcal | Exercise: 45 min`
    for (const field of fieldRow.split(" | ")) {
      const [fieldName, fieldValue] = splitFieldAtColon(field);
      res[toCamelCase(fieldName)] = fieldValue.trim();
    }
  } else {
    // `Sleep HR: Avg 58 bpm | Min 49 bpm | Max 71 bpm`
    for (const field of splitFieldAtColon(fieldRow)[1].split(" | ")) {
      const [fieldName, ...fieldValue] = field.trim().split(/\s+/);
      res[toCamelCase(fieldName)] = fieldValue.join(" ");
    }
  }
  return res as T;
};
const startsWithIgnoreCase = (input: string) => (prefix: string) =>
  input.trim().toLowerCase().startsWith(prefix);

// --- 20260102 ---
// Steps: 12,305 | Calories: 734 kcal | Exercise: 1h 10min
// Stress: Avg 42
// Sleep Summary:
//   Total: 6h 30min | Deep: 1h 10min | Light: 3h 32min | REM: 1h 32min | Awake: 16 min
//   Sleep HR: Avg 61 bpm | Min 52 bpm | Max 77 bpm
const parseDay = (block: string): CorosDailyHealthParsedData => {
  const [dateRow, ...fieldRows] = block.split("\n");
  const summary: Partial<CorosDailyHealthSummary> = {};
  let inSleepSection = false;

  for (const fieldRow of fieldRows) {
    const startsWith = startsWithIgnoreCase(fieldRow);
    if (startsWith("sleep summary")) {
      inSleepSection = true;
    } else if (startsWith("sleep hr")) {
      summary.sleepHr = mapFieldRowToSummary(
        fieldRow,
        FieldRowFormat.OBJECT_FIELD,
      ) as CorosDailyHealthParsedData["summary"]["sleepHr"];
    } else if (inSleepSection && /^\s/.test(fieldRow)) {
      summary.sleep = {
        ...summary.sleep,
        ...mapFieldRowToSummary(fieldRow),
      } as CorosDailyHealthParsedData["summary"]["sleep"];
    } else if (startsWith("stress")) {
      inSleepSection = false;
      summary.stress = mapFieldRowToSummary(
        fieldRow,
        FieldRowFormat.OBJECT_FIELD,
      ) as CorosDailyHealthParsedData["summary"]["stress"];
    } else if (startsWith("steps")) {
      inSleepSection = false;
      Object.assign(summary, mapFieldRowToSummary(fieldRow));
    }
  }

  return { date: dateRow.replaceAll("-", "").trim(), summary };
};

// Daily Health Data — Last 2 days | Resting HR: 55 bpm | HRV Baseline: 48 ms
// Note: sleep entries are dated by their wake-up day.
//
// <day blocks, see parseDay>
export const parseDailyHealthData = (
  text: string,
): CorosDailyHealthParsed | null => {
  const [headerBlock, ...dayBlocks] = text.split("\n\n");
  if (!startsWithIgnoreCase(headerBlock)("daily health")) return null;

  const [headerRow, noteRow] = headerBlock.split("\n");
  const [name, ...fields] = headerRow.split(" | ");
  return {
    name: name.trim(),
    summary: mapFieldRowToSummary(fields.join(" | ")),
    note: noteRow?.replace(/^Note:\s*/, "") ?? "",
    days: dayBlocks
      .filter((block) => startsWithIgnoreCase(block)("---"))
      .map(parseDay),
  };
};

// splits `<Title>\n=====\n\n<body>` into its title and body blocks,
// or null when the title does not match
const splitTitledBlocks = (text: string, title: string): string[] | null => {
  const [header, ...blocks] = text.split("\n\n");
  if (!header?.trim().startsWith(title)) return null;
  return blocks;
};
// `Key: value` rows, one per line
const mapRowsToSummary = <T extends object>(rows: string[]): T =>
  mapFieldRowToSummary<T>(
    rows
      .map((row) => row.trim())
      .filter(Boolean)
      .join(" | "),
    FieldRowFormat.LIST_FIELD,
  );

// Bound Devices (1)
// ========================
//
// 1. COROS APEX 2
//    Bluetooth ID: A1B2C3
//    Model Name: COROS W100
//    Serial Number: W00TEST0
//    Warranty Expires: 2030-01-01 08:00:00
export const parseDevices = (text: string): CorosDeviceParsed[] | null => {
  const blocks = splitTitledBlocks(text, "Bound Devices");
  if (!blocks) return null;

  return blocks
    .filter((block) => /^\d+\.\s/.test(block.trim()))
    .map((block) => {
      const [nameRow, ...infoRows] = block.trim().split("\n");
      return {
        ...mapRowsToSummary<Omit<CorosDeviceParsed, "name">>(infoRows),
        name: nameRow.replace(/^\d+\.\s*/, "").trim(),
      };
    });
};

// User Profile Information
// ========================
//
// Height: 170.0 cm
// Birthday: 1990-01-15 (Age: 36)
// ...
export const parseUserInfo = (text: string): CorosUserInfo | null => {
  const blocks = splitTitledBlocks(text, "User Profile");
  if (!blocks?.length) return null;

  const profile = mapRowsToSummary<CorosUserInfo>(blocks.join("\n").split("\n"));
  if (profile.birthday) {
    // `1990-01-15 (Age: 36)` -> `19900115`
    profile.birthday = profile.birthday.split(" ")[0].replaceAll("-", "");
  }
  return profile;
};

const RG_SCHEDULE_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Training Schedule
// ========================
//
// 2026-01-05
// P10000
// Plan ID: 100000000000000001
// idInPlan: 1
// Distance: 5.00 km
// Estimated Time: 0:30:00
// Load: 50 TL
//
// <footer note>
export const parseTrainingSchedule = (
  text: string,
): CorosTraining[] | null => {
  const blocks = splitTitledBlocks(text, "Training Schedule");
  if (!blocks) return null;

  return blocks
    .map((block) => block.trim().split("\n"))
    .filter(([dateRow]) => RG_SCHEDULE_DATE.test(dateRow?.trim() ?? ""))
    .map(([dateRow, ...rows]) => {
      // standalone workouts may not have the code row, so only take it
      // when it is not a `Key: value` row
      const hasCode = rows[0] !== undefined && !rows[0].includes(":");
      const fieldRows = hasCode ? rows.slice(1) : rows;
      return {
        ...mapRowsToSummary<Omit<CorosTraining, "date" | "unknownCode">>(
          fieldRows,
        ),
        date: dateRow.trim().replaceAll("-", ""),
        unknownCode: hasCode ? rows[0].trim() : "",
      };
    });
};

// Recovery Status
// ========================
//
// Recovery: 75%
// Level: Normal
// Estimated Full Recovery: 12h
export const parseRecoveryStatus = (
  text: string,
): CorosRecoveryStatus | null => {
  const blocks = splitTitledBlocks(text, "Recovery Status");
  if (!blocks?.length) return null;
  return mapRowsToSummary<CorosRecoveryStatus>(blocks.join("\n").split("\n"));
};

// COROS sends some text as a JSON-encoded string (`"Daily ...\\n..."`),
// so unwrap it once to get real newlines back
const decodeJsonString = (text: string): string => {
  if (!text.startsWith('"') || !text.endsWith('"')) return text;
  try {
    const decoded: unknown = JSON.parse(text);
    return typeof decoded === "string" ? decoded : text;
  } catch {
    return text;
  }
};

export const getTextContent = (result: CorosToolResult): string | null => {
  if (!Array.isArray(result.content)) return null;
  const item = result.content.find((content) => content.type === "text");
  return item?.type === "text" ? decodeJsonString(item.text) : null;
};
