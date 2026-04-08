import { describe, expect, it } from "vitest";
import { classifyInput } from "./input-intent";

describe("classifyInput", () => {
  it("keeps casual chat out of the token workflow", () => {
    expect(classifyInput("whats cooking")).toEqual({ mode: "chat" });
    expect(classifyInput("hey")).toEqual({ mode: "chat" });
  });

  it("requires a token when the prompt is market-oriented but missing one", () => {
    expect(classifyInput("what's the price right now")).toEqual({
      mode: "need-token"
    });
  });

  it("extracts token symbols from trade questions", () => {
    expect(classifyInput("Should I buy BONK?")).toEqual({
      mode: "investigation",
      tokenQuery: "BONK"
    });
  });

  it("treats general deep research as non-token research", () => {
    expect(classifyInput("do a deep research on the history of Solana")).toEqual({
      mode: "research"
    });
  });
});
