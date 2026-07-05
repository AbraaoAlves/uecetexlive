import { expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

it("está ligado ao check do workspace", () => {
  expect(PACKAGE_NAME).toBe("@uecetexlive/latex-mapping");
});
