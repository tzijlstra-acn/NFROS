/**
 * The portfolio register and its history (NFR Workspace v3, migration 0010).
 *
 * The builder must be deterministic and must agree with the flagship day:
 * the stories the analysis finds are asserted here, so a change to the data
 * that would quietly break a demonstrated answer fails a test instead.
 */

import { describe, expect, it } from "vitest";
import * as risk from "@/scenario/data/risk";
import * as eventData from "@/scenario/data/event";
import { buildPortfolio, kriStatus, PORTFOLIO_MONTHS, PORTFOLIO_QUARTERS, providerKeyForName } from "@/scenario/data/portfolio";

function input() {
  const first = new Map<string, number>();
  for (const reading of [...risk.kriReadings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    if (!first.has(reading.kriId)) first.set(reading.kriId, reading.value);
  }
  return {
    controls: risk.controls.map((control) => ({
      id: control.id,
      currentEffectiveness: control.currentEffectiveness,
      isKeyControl: Boolean(control.isKeyControl),
      lastTestedOn: control.lastTestedOn ?? null,
    })),
    kris: risk.kris.map((kri) => ({
      id: kri.id,
      adverseDirection: kri.adverseDirection,
      amberThreshold: kri.amberThreshold,
      redThreshold: kri.redThreshold,
      firstValue: first.get(kri.id) ?? kri.currentValue,
    })),
  };
}

const portfolio = buildPortfolio("run-test", input());

describe("the portfolio builder", () => {
  it("is deterministic", () => {
    expect(buildPortfolio("run-test", input())).toStrictEqual(portfolio);
  });

  it("covers 24 months and 8 quarters", () => {
    expect(PORTFOLIO_MONTHS).toHaveLength(24);
    expect(PORTFOLIO_MONTHS[0]).toBe("2024-10");
    expect(PORTFOLIO_MONTHS.at(-1)).toBe("2026-09");
    expect(PORTFOLIO_QUARTERS.at(-1)).toBe("2026-Q3");
    const novalink = portfolio.thirdPartyMonthlyMetrics.filter((row) => row.thirdPartyId === "TP-0042");
    expect(novalink).toHaveLength(24);
  });

  it("gives Novalink the operational incident counts for August and September 2026", () => {
    const counted = (month: string) =>
      eventData.incidents.filter(
        (incident) => (incident.supplierIds as string[]).includes("TP-0042") && String(incident.occurredAt).startsWith(month),
      ).length;
    const metric = (month: string) =>
      portfolio.thirdPartyMonthlyMetrics.find((row) => row.thirdPartyId === "TP-0042" && row.period === month)?.incidents;
    expect(metric("2026-08")).toBe(counted("2026-08"));
    expect(metric("2026-09")).toBe(counted("2026-09"));
  });

  it("puts four critical third parties on Basalt Cloud, and every Basalt dependant has an August 2026 incident", () => {
    const basaltRegister = new Set(
      portfolio.portfolioProviderLinks.filter((link) => link.providerKey === "basalt").map((link) => link.thirdPartyId),
    );
    const critical = portfolio.portfolioThirdParties.filter((tp) => basaltRegister.has(tp.id) && tp.criticality === "critical");
    /* Three in the register, plus Sentinel (TP-0015) among the operational suppliers. */
    expect(critical.map((tp) => tp.id).sort()).toStrictEqual(["TP-0131", "TP-0158", "TP-0172"]);
    for (const id of [...basaltRegister, "TP-0015", "TP-0007"]) {
      const august = portfolio.thirdPartyMonthlyMetrics.find((row) => row.thirdPartyId === id && row.period === "2026-08");
      expect(august?.incidents ?? 0, id).toBeGreaterThanOrEqual(1);
    }
    expect(providerKeyForName("Basalt Cloud Infrastructure B.V.")).toBe("basalt");
  });

  it("shows CTL-PAY-014 failing its tests while recorded fully effective", () => {
    const control = risk.controls.find((entry) => entry.id === "CTL-PAY-014");
    expect(control?.currentEffectiveness).toBe("fully-effective");
    const results = portfolio.controlTestResults.filter((row) => row.controlId === "CTL-PAY-014").map((row) => row.result);
    expect(results.slice(-3)).toStrictEqual(["minor-exceptions", "minor-exceptions", "awaiting-conclusion"]);
  });

  it("never pre-concludes a test the day still has open", () => {
    const q3 = portfolio.controlTestResults.find((row) => row.controlId === "CTL-PAY-014" && row.period === "2026-Q3");
    expect(q3?.result).toBe("awaiting-conclusion");
    expect(q3?.controlTestId).toBe("TST-2026-0318");
  });

  it("keeps KRI-PAY-007 red only in July 2025, fourteen months before September 2026", () => {
    const red = portfolio.kriHistory.filter((row) => row.kriId === "KRI-PAY-007" && row.status === "red").map((row) => row.period);
    expect(red).toStrictEqual(["2025-07"]);
  });

  it("computes KRI status with the thresholds as the 2026 readings do", () => {
    expect(kriStatus({ adverseDirection: "up", amberThreshold: 2, redThreshold: 6 }, 2)).toBe("green");
    expect(kriStatus({ adverseDirection: "up", amberThreshold: 2.5, redThreshold: 3.5 }, 3.84)).toBe("red");
    expect(kriStatus({ adverseDirection: "down", amberThreshold: 95, redThreshold: 85 }, 87.5)).toBe("amber");
    expect(kriStatus({ adverseDirection: "down", amberThreshold: 90, redThreshold: 80 }, 78)).toBe("red");
  });

  it("holds seven acceptances expiring within 90 days of the scenario day, six on unmet conditions", () => {
    const soon = portfolio.riskAcceptances.filter(
      (row) => row.status === "active" && row.expiresOn >= "2026-10-06" && row.expiresOn <= "2027-01-04",
    );
    expect(soon).toHaveLength(7);
    expect(soon.filter((row) => !row.conditionsMet)).toHaveLength(6);
    expect(soon.find((row) => row.riskId === "RSK-0184" && row.subjectId === "TP-0042")?.expiresOn).toBe("2026-12-31");
  });

  it("records digital banking over tolerance with an unmapped Basalt dependency", () => {
    const row = portfolio.serviceResilienceTests.find((entry) => entry.serviceId === "IBS-0001");
    expect(row && row.observedMinutes > row.toleranceMinutes).toBe(true);
    expect(row?.unmappedDependency).toContain("Basalt");
  });
});
