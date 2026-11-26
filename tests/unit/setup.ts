import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so unmount rendered trees explicitly.
afterEach(() => {
  cleanup();
});

// jsdom does not implement layout APIs used by the UI.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
