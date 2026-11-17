import { describe, it, expect } from "vitest";
import { CorosConnect } from "../src/coros.ts";

const createCoros = () =>
  new CorosConnect({ redirect: "http://localhost:3000/callback" });

describe("CorosConnect.availableTools", () => {
  it("lists every tool that has a handler", () => {
    const { tools, handler } = createCoros().availableTools;
    expect(tools).toEqual(Object.keys(handler));
  });

  it("maps each tool to an existing method", () => {
    const coros = createCoros();
    for (const method of Object.values(coros.availableTools.handler)) {
      expect(typeof coros[method]).toBe("function");
    }
  });
});

describe("CorosConnect argument validation", () => {
  it("rejects invalid days before calling COROS", async () => {
    const coros = createCoros();
    await expect(coros.getDailyHealthData(0)).rejects.toThrow(RangeError);
    await expect(coros.getDailyHealthData(1.5)).rejects.toThrow(RangeError);
  });

  it("rejects dates not in yyyyMMdd format", async () => {
    const coros = createCoros();
    await expect(
      coros.getTrainingSchedule({ startDate: "2026-01-05" }),
    ).rejects.toThrow("startDate must be in yyyyMMdd format");
    await expect(
      coros.getTrainingSchedule({ endDate: "202601" }),
    ).rejects.toThrow("endDate must be in yyyyMMdd format");
  });

  it("requires a connection for valid arguments", async () => {
    await expect(
      createCoros().getTrainingSchedule({ startDate: "20260105" }),
    ).rejects.toThrow("Not connected. Call connect() first.");
  });
});
