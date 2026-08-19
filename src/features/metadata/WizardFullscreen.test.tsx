import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WIZARD_STEPS_FULL, WizardFullscreen } from "./WizardFullscreen";

afterEach(cleanup);

describe("WizardFullscreen", () => {
  it("names the dialog and restores the trigger on unmount", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <WizardFullscreen
        fields={new Map()}
        onApply={vi.fn()}
        onClose={onClose}
        toggles={new Map()}
        onToggle={vi.fn()}
        attachments={[]}
        onAddAttachments={vi.fn()}
        onReplaceAttachment={vi.fn()}
        onDeleteAttachment={vi.fn()}
        onCompile={vi.fn()}
        initialStep={WIZARD_STEPS_FULL.length - 1}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Guia do trabalho" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.click(screen.getByTestId("wizard-fs-close"));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });
});
