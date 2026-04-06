import { describe, expect, it } from "vitest";
import {
  MockInferenceProvider,
  MockPublicSignalsProvider
} from "@intentvault/providers";
import { runInvestigateTokenWorkflow } from "./investigate-token";

describe("runInvestigateTokenWorkflow", () => {
  it("returns a valid decision card for a token request", async () => {
    const response = await runInvestigateTokenWorkflow(
      {
        tokenQuery: "BONK",
        riskMode: "balanced",
        timeHorizon: "mid",
        notes: "I care about concentration risk.",
        walletContext: ""
      },
      {
        requestId: "iv-test",
        signalsProvider: new MockPublicSignalsProvider(),
        inferenceProvider: new MockInferenceProvider()
      }
    );

    expect(response.requestId).toBe("iv-test");
    expect(response.decision.topRisks.length).toBeGreaterThan(0);
    expect(response.runtime.signalsProvider).toContain("mock");
    expect(response.runtime.inferenceProvider).toContain("mock");
  });
});
