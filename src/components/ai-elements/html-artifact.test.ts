import { describe, expect, it } from "vitest";
import { PREVIEW_SANDBOX, resolveView } from "./html-artifact";

describe("HTML Live Preview", () => {
  it("defaults to Live Preview once the HTML block is complete", () => {
    expect(resolveView(null, false)).toBe("preview");
  });

  it("respects the user's Code choice", () => {
    expect(resolveView("code", false)).toBe("code");
  });

  it("never lets previewed pages share the app's origin (API keys stay private)", () => {
    expect(PREVIEW_SANDBOX).toContain("allow-scripts");
    expect(PREVIEW_SANDBOX).not.toContain("allow-same-origin");
  });
});
