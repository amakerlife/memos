import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock } from "@/components/MemoContent/CodeBlock";
import { MermaidBlock } from "@/components/MemoContent/MermaidBlock";

const browser = vi.hoisted(() => ({ supportsLookbehind: true }));

vi.mock("@/utils/browser-support", () => ({
  get supportsLookbehind() {
    return browser.supportsLookbehind;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    userGeneralSetting: { theme: "default" },
  }),
}));

const renderMermaid = vi.fn(async () => ({ svg: '<svg data-testid="diagram"></svg>' }));
const initializeMermaid = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMermaid,
    render: renderMermaid,
  },
}));

const codeElement = (content: string) => <code className="language-mermaid">{content}</code>;

describe("MermaidBlock", () => {
  it("keeps Mermaid as code on iOS 15 without initializing the renderer", () => {
    browser.supportsLookbehind = false;
    try {
      const { container } = render(<CodeBlock>{codeElement("graph TD; A-->B")}</CodeBlock>);
      expect(container.querySelector("code")?.textContent).toBe("graph TD; A-->B");
      expect(container.querySelector(".mermaid-diagram")).toBeNull();
      expect(initializeMermaid).not.toHaveBeenCalled();
      expect(renderMermaid).not.toHaveBeenCalled();
    } finally {
      browser.supportsLookbehind = true;
    }
  });

  it("clears rendered output when code content becomes empty", async () => {
    const { container, rerender } = render(<MermaidBlock>{codeElement("graph TD; A-->B")}</MermaidBlock>);

    await waitFor(() => expect(container.querySelector(".mermaid-diagram")).not.toBeNull());

    rerender(<MermaidBlock>{codeElement("")}</MermaidBlock>);

    await waitFor(() => expect(container.querySelector(".mermaid-diagram")).toBeNull());
  });
});
