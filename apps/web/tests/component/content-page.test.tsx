import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PageSection } from "../../src/content/content-schema";
import { ContentPage } from "../../src/presentation/content-page";

const sections: readonly PageSection[] = [
  {
    id: "introduction",
    type: "hero",
    variant: "default",
    enabled: true,
    content: {
      heading: "Example heading",
      summary: "Example summary",
    },
  },
];

describe("ContentPage", () => {
  it("renders navigation and section content with semantic landmarks", () => {
    render(
      <ContentPage
        sections={sections}
        navigation={[{ href: "#introduction", label: "Introduction" }]}
        skipToContent="Skip to content"
      />,
    );

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Example heading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Example summary")).toBeInTheDocument();
  });
});
