import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIZE_CHARTS } from "@/config/size-guide";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { toProductDetail } from "@/lib/catalog/product";
import { cartStore } from "@/lib/stores/cart";
import { detailRow } from "./fixtures";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/x" }));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/products/mens-quilted-puffer-jacket");
  // jsdom has no <dialog> modal support or IntersectionObserver.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

const product = toProductDetail(detailRow);

function setup(requested = {}) {
  return render(
    <ProductPurchase product={product} requested={requested} lowStockThreshold={5} sizeChart={SIZE_CHARTS.tops} />,
  );
}

describe("ProductPurchase", () => {
  it("asks for a size before adding to the bag", async () => {
    setup();
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: /Add to bag/ })[0]));
    expect(screen.getByRole("alert")).toHaveTextContent("Please select a size.");
    expect(cartStore.get()).toEqual([]);
  });

  it("disables sold-out sizes for the chosen colour", () => {
    setup();
    expect(screen.getByRole("radio", { name: "M (sold out)" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "S" })).toBeEnabled();
  });

  it("updates SKU, stock message, price and URL as the shopper chooses", async () => {
    setup();
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Olive" })));
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "M" })));
    expect(screen.getByTestId("sku")).toHaveTextContent("JKT-001-M-OLIV");
    expect(screen.getByTestId("stock-message")).toHaveTextContent("In stock — ready to ship");
    expect(screen.getAllByText("Rs 8,499")[0]).toBeInTheDocument();
    expect(window.location.search).toBe("?color=Olive&size=M");
  });

  it("adds the chosen variant and quantity, capped by stock", async () => {
    setup({ color: "Black", size: "S" });
    expect(screen.getByTestId("stock-message")).toHaveTextContent("Only 3 left");
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    for (let i = 0; i < 5; i++) await act(async () => fireEvent.click(plus));
    expect(plus).toBeDisabled(); // stopped at 3
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: /Add to bag/ })[0]));
    expect(cartStore.get()).toEqual([{ variantId: product.variants[0].id, quantity: 3 }]);
    expect(screen.getByText(/Added to your bag/)).toHaveTextContent("Black, S) × 3");
  });

  it("opens the size guide", async () => {
    setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Size guide" })));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Chest")).toBeInTheDocument();
  });
});
