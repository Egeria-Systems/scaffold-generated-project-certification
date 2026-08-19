import { describe, expect, it } from "vitest";

import {
  parseContentConfiguration,
  parseYamlContent,
} from "../../src/content/content-schema";

describe("content configuration parsing", () => {
  it("accepts the generated locale contract", () => {
    const parsed = parseContentConfiguration(
      parseYamlContent(`
schemaVersion: 1.0.0
defaultLocale: en-CA
locales:
  - en-CA
`),
    );

    expect(parsed).toEqual({
      schemaVersion: "1.0.0",
      defaultLocale: "en-CA",
      locales: ["en-CA"],
    });
  });

  it("rejects incomplete configuration with the stable error", () => {
    expect(() =>
      parseContentConfiguration(
        parseYamlContent(`
schemaVersion: 1.0.0
defaultLocale: en-CA
`),
      ),
    ).toThrow(new TypeError("CONTENT_INVALID"));
  });
});
