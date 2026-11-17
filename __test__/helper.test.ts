import { describe, it, expect } from "vitest";
import {
  getTextContent,
  parseDailyHealthData,
  parseDevices,
  parseRecoveryStatus,
  parseTrainingSchedule,
  parseUserInfo,
  toCamelCase,
} from "../src/helper.ts";
import { DAILY_HEALTH_DATA } from "../__mocks__/daily-health-data.ts";
import { DEVICES } from "../__mocks__/devices.ts";
import { RECOVERY_STATUS } from "../__mocks__/recovery-status.ts";
import { TRAINING_SCHEDULE } from "../__mocks__/training-schedule.ts";
import { USER_INFO } from "../__mocks__/user-info.ts";

const HEADER =
  "Daily Health Data — Last 1 days | Resting HR: 55 bpm | HRV Baseline: 48 ms\nNote: sleep entries are dated by their wake-up day.";

describe("parseDailyHealthData", () => {
  it("parses the full COROS response", () => {
    expect(parseDailyHealthData(DAILY_HEALTH_DATA.content[0].text)).toEqual({
      name: "Daily Health Data — Last 2 days",
      summary: { restingHr: "55 bpm", hrvBaseline: "48 ms" },
      note: "sleep entries are dated by their wake-up day.",
      days: [
        {
          date: "20260101",
          summary: {
            steps: "8,420",
            calories: "512 kcal",
            exercise: "45 min",
            stress: {
              avg: "31",
            },
            sleep: {
              total: "7h 12min",
              deep: "1h 25min",
              light: "4h 11min",
              rem: "1h 18min",
              awake: "18 min",
            },
            sleepHr: {
              avg: "58 bpm",
              min: "49 bpm",
              max: "71 bpm",
            },
          },
        },
        {
          date: "20260102",
          summary: {
            steps: "12,305",
            calories: "734 kcal",
            exercise: "1h 10min",
            stress: { avg: "42" },
            sleep: {
              total: "6h 30min",
              deep: "1h 10min",
              light: "3h 32min",
              rem: "1h 32min",
              awake: "16 min",
            },
            sleepHr: {
              avg: "61 bpm",
              min: "52 bpm",
              max: "77 bpm",
            },
          },
        },
      ],
    });
  });

  it("parses a day without sleep data", () => {
    const result = parseDailyHealthData(
      `${HEADER}\n\n--- 20260101 ---\nSteps: 8,420 | Calories: 512 kcal | Exercise: 45 min\nStress: Avg 31`,
    );
    expect(result).not.toBeNull();
    expect(result?.days).toEqual([
      {
        date: "20260101",
        summary: {
          steps: "8,420",
          calories: "512 kcal",
          exercise: "45 min",
          stress: {
            avg: "31",
          },
        },
      },
    ]);
  });

  it("does not throw when Sleep HR row is missing", () => {
    const result = parseDailyHealthData(
      `${HEADER}\n\n--- 20260101 ---\nSteps: 8,420 | Calories: 512 kcal | Exercise: 45 min\nStress: Avg 31\nSleep Summary:\n  Total: 7h 12min | Deep: 1h 25min | Light: 4h 11min | REM: 1h 18min | Awake: 18 min`,
    );
    expect(result).not.toBeNull();
    expect(result?.days[0].summary).toMatchObject({
      sleep: { total: "7h 12min" },
    });
    expect(result?.days[0].summary).not.toHaveProperty("sleepHr");
  });

  it("parses header with a single field", () => {
    const result = parseDailyHealthData(
      `Daily Health Data — Last 1 days | Resting HR: 55 bpm\nNote: n\n\n--- 20260101 ---\nSteps: 8,420 | Calories: 512 kcal | Exercise: 45 min\nStress: Avg 31`,
    );
    expect(result?.summary).toEqual({ restingHr: "55 bpm" });
  });

  it("keeps values that contain a colon", () => {
    const result = parseDailyHealthData(
      `${HEADER}\n\n--- 20260101 ---\nSteps: 8,420 | Calories: 512 kcal | Exercise: 45 min\nStress: Avg 31\nSleep Summary:\n  Bedtime: 23:10 | Wake: 06:30\n  Sleep HR: Avg 58 bpm | Min 49 bpm | Max 71 bpm`,
    );
    expect(result?.days[0].summary?.sleep).toEqual({
      bedtime: "23:10",
      wake: "06:30",
    });
  });

  it("parses header without a Note line", () => {
    const result = parseDailyHealthData(
      `Daily Health Data — Last 1 days | Resting HR: 55 bpm\n\n--- 20260101 ---\nSteps: 8,420 | Calories: 512 kcal | Exercise: 45 min`,
    );
    expect(result?.note).toBe("");
    expect(result?.days).toEqual([
      {
        date: "20260101",
        summary: { steps: "8,420", calories: "512 kcal", exercise: "45 min" },
      },
    ]);
  });

  it("handles extra whitespace in rows", () => {
    const result = parseDailyHealthData(
      `${HEADER}\n\n--- 20260101 ---\nStress: Avg 31\nSleep Summary:\n   Total: 7h 12min |  Deep: 1h 25min\n   Sleep HR: Avg   58 bpm |  Min 49 bpm`,
    );
    expect(result?.days[0].summary).toEqual({
      stress: { avg: "31" },
      sleep: { total: "7h 12min", deep: "1h 25min" },
      sleepHr: { avg: "58 bpm", min: "49 bpm" },
    });
  });

  it("returns empty days when the response has no day blocks", () => {
    expect(parseDailyHealthData(HEADER)).toEqual({
      name: "Daily Health Data — Last 1 days",
      summary: { restingHr: "55 bpm", hrvBaseline: "48 ms" },
      note: "sleep entries are dated by their wake-up day.",
      days: [],
    });
  });

  it("returns null when text is not daily health data", () => {
    expect(parseDailyHealthData("")).toBeNull();
    expect(parseDailyHealthData("Something else")).toBeNull();
  });
});

describe("toCamelCase", () => {
  it("joins words in camelCase", () => {
    expect(toCamelCase("abc")).toBe("abc");
    expect(toCamelCase("abc cde")).toBe("abcCde");
    expect(toCamelCase("Resting HR")).toBe("restingHr");
  });

  it("collapses repeated whitespace", () => {
    expect(toCamelCase("  Sleep   HR ")).toBe("sleepHr");
  });
});

describe("getTextContent", () => {
  it("returns the first text item", () => {
    expect(
      getTextContent({
        content: [
          { type: "image", data: "", mimeType: "image/png" },
          { type: "text", text: "hello" },
        ],
      }),
    ).toBe("hello");
  });

  it("returns null when there is no text item", () => {
    expect(getTextContent({ content: [] })).toBeNull();
  });

  it("decodes JSON-encoded text from COROS", () => {
    const raw = DAILY_HEALTH_DATA.content[0].text;
    const text = getTextContent({
      content: [{ type: "text", text: JSON.stringify(raw) }],
    });
    expect(text).toBe(raw);
    expect(parseDailyHealthData(text ?? "")?.days).toHaveLength(2);
  });

  it("keeps plain text that only looks quoted", () => {
    const text = '"a" and "b"';
    expect(getTextContent({ content: [{ type: "text", text }] })).toBe(text);
  });
});

describe("toCamelCase (camelCase words)", () => {
  it("keeps a single word that is already camelCase", () => {
    expect(toCamelCase("idInPlan")).toBe("idInPlan");
  });

  it("still lowercases all-caps words", () => {
    expect(toCamelCase("HRV")).toBe("hrv");
    expect(toCamelCase("HRV Baseline")).toBe("hrvBaseline");
  });
});

describe("parseDevices", () => {
  it("parses every device", () => {
    expect(parseDevices(DEVICES.content[0].text)).toEqual([
      {
        name: "COROS APEX 2",
        bluetoothId: "A1B2C3",
        modelName: "COROS W100",
        serialNumber: "W00TEST01",
        warrantyExpires: "2030-01-01 08:00:00",
      },
      {
        name: "COROS VERTIX 2",
        bluetoothId: "D4E5F6",
        modelName: "COROS W200",
        serialNumber: "W00TEST02",
        warrantyExpires: "2031-06-15 12:30:45",
      },
    ]);
  });

  it("parses more than 9 devices", () => {
    const text =
      "Bound Devices (12)\n========================\n\n" +
      Array.from(
        { length: 12 },
        (_, i) => `${i + 1}. COROS APEX 2\n   Serial Number: W${i}`,
      ).join("\n\n");
    const devices = parseDevices(text);
    expect(devices).toHaveLength(12);
    expect(devices?.[11]).toEqual({ name: "COROS APEX 2", serialNumber: "W11" });
  });

  it("returns an empty list when no device is bound", () => {
    expect(parseDevices("Bound Devices (0)\n========================")).toEqual(
      [],
    );
  });

  it("returns null for other text", () => {
    expect(parseDevices("")).toBeNull();
    expect(parseDevices("User Profile Information")).toBeNull();
  });
});

describe("parseUserInfo", () => {
  it("parses the profile and normalizes birthday", () => {
    expect(parseUserInfo(USER_INFO.content[0].text)).toEqual({
      height: "170.0 cm",
      weight: "65.0 kg",
      birthday: "19900115",
      gender: "Female",
      nickname: "Test User",
    });
  });

  it("returns null for other text", () => {
    expect(parseUserInfo("")).toBeNull();
    expect(parseUserInfo("User Profile Information")).toBeNull();
    expect(parseUserInfo("Recovery Status\n\nLevel: Normal")).toBeNull();
  });
});

describe("parseRecoveryStatus", () => {
  it("parses the recovery status", () => {
    expect(parseRecoveryStatus(RECOVERY_STATUS.content[0].text)).toEqual({
      recovery: "75%",
      level: "Normal",
      estimatedFullRecovery: "12h",
    });
  });

  it("returns null for other text", () => {
    expect(parseRecoveryStatus("")).toBeNull();
    expect(parseRecoveryStatus("Recovery Status")).toBeNull();
  });
});

describe("parseTrainingSchedule", () => {
  const WORKOUT_1 = {
    date: "20260105",
    unknownCode: "P10000",
    planId: "100000000000000001",
    idInPlan: "1",
    distance: "5.00 km",
    estimatedTime: "0:30:00",
    load: "50 TL",
  };

  it("parses workouts and skips the footer note", () => {
    expect(parseTrainingSchedule(TRAINING_SCHEDULE.content[0].text)).toEqual([
      WORKOUT_1,
      {
        date: "20260107",
        unknownCode: "P10001",
        planId: "100000000000000001",
        idInPlan: "2",
        distance: "10.00 km",
        estimatedTime: "1:05:30",
        load: "120 TL",
      },
    ]);
  });

  it("keeps the last workout when there is no footer", () => {
    const text = TRAINING_SCHEDULE.content[0].text
      .split("\n\n")
      .slice(0, -1)
      .join("\n\n");
    expect(parseTrainingSchedule(text)).toHaveLength(2);
  });

  it("parses a standalone workout without code row", () => {
    const text =
      "Training Schedule\n========================\n\n2026-01-05\nidInPlan: 7\nDistance: 5.00 km";
    expect(parseTrainingSchedule(text)).toEqual([
      {
        date: "20260105",
        unknownCode: "",
        idInPlan: "7",
        distance: "5.00 km",
      },
    ]);
  });

  it("returns an empty list for a week without workouts", () => {
    expect(
      parseTrainingSchedule("Training Schedule\n========================"),
    ).toEqual([]);
  });

  it("returns null for other text", () => {
    expect(parseTrainingSchedule("")).toBeNull();
    expect(parseTrainingSchedule("Training Schdule\n\n2026-01-05")).toBeNull();
  });
});
