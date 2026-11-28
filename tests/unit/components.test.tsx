import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/product/ProductCard";
import { Price } from "@/components/ui/Price";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { mergeSettings } from "@/lib/catalog/mappers";
import { productCard } from "./fixtures";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("ProductCard", () => {
  it("links to the product and shows name, category and price", () => {
    render(<ProductCard product={productCard()} />);
    const link = screen.getByRole("link", { name: "Men's Quilted Puffer Jacket" });
    expect(link).toHaveAttribute("href", "/products/mens-quilted-puffer-jacket");
    expect(screen.getByText("Jackets")).toBeInTheDocument();
    expect(screen.getByText("Rs 7,999")).toBeInTheDocument();
    // The photo is decorative: the name is already the card's heading/link,
    // so screen readers don't hear it twice.
    expect(screen.queryByRole("img", { name: "Men's Quilted Puffer Jacket" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Men's Quilted Puffer Jacket" })).toBeInTheDocument();
  });

  it("shows the discount badge and both prices on sale", () => {
    render(<ProductCard product={productCard({ compareAtPrice: 9999 })} />);
    expect(screen.getByText("−20%")).toBeInTheDocument();
    expect(screen.getByText("Rs 9,999")).toBeInTheDocument();
  });

  it("prefers Sold out over Sale/New badges", () => {
    render(<ProductCard product={productCard({ inStock: false, sizesInStock: [], compareAtPrice: 9999, isNew: true })} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.queryByText("−20%")).not.toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("shows New for new arrivals and 'From' for varying prices", () => {
    render(<ProductCard product={productCard({ isNew: true, priceVaries: true })} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
  });
});

describe("Price", () => {
  it("announces sale and original prices to screen readers", () => {
    render(<Price price={3499} compareAt={4299} />);
    expect(screen.getByText(/Sale price/)).toBeInTheDocument();
    expect(screen.getByText(/Original price/)).toBeInTheDocument();
  });
});

describe("MobileMenu", () => {
  const links = [
    { label: "Men", href: "/collections/men" },
    { label: "Sale", href: "/sale", emphasis: "sale" as const },
  ];

  it("opens as a modal dialog, closes on Escape and returns focus", async () => {
    render(<MobileMenu links={links} storeName="Mohsin FutureTech" whatsappHref="https://wa.me/923000000000" />);
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await act(async () => fireEvent.click(button));
    expect(button).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Mohsin FutureTech" });
    expect(within(dialog).getByRole("link", { name: "Men" })).toHaveAttribute("href", "/collections/men");
    expect(within(dialog).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/923000000000");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close menu" }));
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => fireEvent.keyDown(document, { key: "Escape" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
    expect(document.body.style.overflow).toBe("");
  });

  it("falls back to a Contact link when WhatsApp is not configured", async () => {
    render(<MobileMenu links={links} storeName="Store" whatsappHref={null} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });
});

describe("Footer and WhatsApp", () => {
  it("lists the enabled payment methods and the configured contact details", () => {
    render(<Footer settings={mergeSettings({ support_email: "hello@shop.pk" })} shopLinks={[]} paymentMethods={["cod", "jazzcash", "easypaisa"]} />);
    const methods = screen.getByRole("list", { name: "Payment methods" });
    expect(within(methods).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Cash on Delivery",
      "JazzCash",
      "Easypaisa",
    ]);
    expect(screen.getByRole("link", { name: "hello@shop.pk" })).toHaveAttribute("href", "mailto:hello@shop.pk");
  });

  it("hides the floating WhatsApp button without a number", () => {
    const { container } = render(<WhatsAppButton href={null} />);
    expect(container).toBeEmptyDOMElement();
    render(<WhatsAppButton href="https://wa.me/923000000000" />);
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("target", "_blank");
  });
});
