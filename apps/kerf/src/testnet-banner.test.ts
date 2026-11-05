import { describe, it, expect } from "vitest";
import { TestnetBanner } from "./components/TestnetBanner";

describe("TestnetBanner Component", () => {
  it("renders a permanent alert banner with testnet demo warnings", () => {
    const element = TestnetBanner();
    expect(element).toBeDefined();
    expect(element.props.role).toBe("alert");
    expect(element.props["aria-label"]).toBe("Testnet warning banner");

    // Serialize children to string to verify required phrases
    const jsonStr = JSON.stringify(element);
    expect(jsonStr).toContain("Testnet demo. Test funds only.");
    expect(jsonStr).toContain("Testnet Only");
  });
});

