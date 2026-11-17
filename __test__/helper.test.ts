import { describe, it, expect } from "vitest";
import {
  getTextContent,
  parseDailyHealthData,
  toCamelCase,
} from "../src/helper.ts";
import { DAILY_HEALTH_DATA } from "../__mocks__/daily-health-data.ts";

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
