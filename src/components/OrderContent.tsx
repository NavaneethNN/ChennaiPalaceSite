"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronUp,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { api, send } from "@/lib/client-api";
import { money, type MenuItem } from "@/lib/types";
type Receipt = { id: string; token: string; table: number };
export default function OrderContent() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [table, setTable] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All dishes");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState("pending");
  const [closed, setClosed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const request = useRef<{ key: string; token: string } | null>(null);
  const cartRef = useRef<HTMLElement>(null);
  const cartTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cartOpen) return;
    const mobile = window.matchMedia("(max-width: 800px)");
    if (!mobile.matches) return;
    const trigger = cartTrigger.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cartRef.current
      ?.querySelector<HTMLButtonElement>(".order-cart-close")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
      if (event.key !== "Tab") return;
      const targets = Array.from(
        cartRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (!mobile.matches) setCartOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mobile.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      mobile.removeEventListener("change", onResize);
      trigger?.focus();
    };
  }, [cartOpen]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("table")) setTable(params.get("table")!);
    try {
      const saved = sessionStorage.getItem("palace_order");
      if (saved) {
        const value = JSON.parse(saved);
        if (!params.get("item")) setReceipt(value);
        setTable(String(value.table));
      }
    } catch {}
    api<MenuItem[]>("/api/menu")
      .then((items) => {
        setMenu(items);
        const featuredId = params.get("item");
        if (
          featuredId &&
          items.some((item) => item.id === featuredId && item.stock !== 0)
        ) {
          setCart((current) => ({
            ...current,
            [featuredId]: Math.max(1, current[featuredId] || 0),
          }));
          window.history.replaceState(
            {},
            "",
            `/order${params.get("table") ? `?table=${encodeURIComponent(params.get("table")!)}` : ""}`,
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!receipt) return;
    let active = true;
    const update = () =>
      api<{ status: string; closed_at: string | null }>(
        `/api/orders?id=${receipt.id}&token=${receipt.token}`,
      )
        .then((data) => {
          if (active) {
            setStatus(data.status);
            setClosed(Boolean(data.closed_at));
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    update();
    const timer = setInterval(update, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [receipt]);
  useEffect(() => {
    if (receipt) return;
    let active = true;
    const timer = setInterval(() => {
      if (document.hidden) return;
      api<MenuItem[]>("/api/menu")
        .then((data) => {
          if (active) setMenu(data);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [receipt]);
  const change = (id: string, quantity: number) => {
    request.current = null;
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(50, quantity)) }));
  };
  const selected = menu.filter((i) => cart[i.id] > 0);
  const total = selected.reduce(
    (sum, i) => sum + i.price_cents * cart[i.id],
    0,
  );
  const count = selected.reduce((sum, item) => sum + cart[item.id], 0);
  const available = menu.filter((item) => item.stock !== 0);
  const featured = ["Masala Dosa", "Butter Chicken", "Chicken Biryani"]
    .map((name) => available.find((item) => item.name === name))
    .filter((item): item is MenuItem => Boolean(item));
  const hasCurry = selected.some((item) =>
    item.category.toLowerCase().includes("curr"),
  );
  const hasDosa = selected.some((item) => /dosa|idly|vada/i.test(item.name));
  const hasBiryani = selected.some((item) => /biryani/i.test(item.name));
  const suggestions = (
    hasCurry
      ? ["Garlic Naan", "Jeera Rice", "Gulab Jamun"]
      : hasDosa
        ? ["South Indian Filter Coffee", "Mango Lassi", "Gulab Jamun"]
        : hasBiryani
          ? ["Mango Lassi", "Gulab Jamun", "Garlic Naan"]
          : ["Mango Lassi", "Garlic Naan", "Gulab Jamun"]
  )
    .map((name) =>
      available.find((item) => item.name === name && !cart[item.id]),
    )
    .filter((item): item is MenuItem => Boolean(item))
    .slice(0, 2);
  const visibleCategories = [
    "All dishes",
    ...new Set(menu.map((item) => item.category)),
  ];
  const matching = menu.filter(
    (item) =>
      (category === "All dishes" || item.category === category) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  async function placeOrder() {
    setBusy(true);
    setError("");
    try {
      if (!request.current)
        request.current = {
          key: crypto.randomUUID(),
          token: crypto.randomUUID(),
        };
      const data = await send<{ id: string }>("/api/orders", {
        table_number: Number(table),
        items: selected.map((i) => ({ id: i.id, quantity: cart[i.id] })),
        notes,
        request_key: request.current.key,
        tracking_token: request.current.token,
      });
      const value = {
        id: data.id,
        token: request.current.token,
        table: Number(table),
      };
      setReceipt(value);
      setCartOpen(false);
      setStatus("pending");
      setClosed(false);
      try {
        sessionStorage.setItem("palace_order", JSON.stringify(value));
      } catch {}
      setCart({});
      setNotes("");
      request.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function anotherOrder() {
    setReceipt(null);
    sessionStorage.removeItem("palace_order");
    api<MenuItem[]>("/api/menu")
      .then(setMenu)
      .catch((e) => setError(e.message));
  }
  return (
    <main id="main" className="order-page">
      <header className="order-intro">
        <div className="order-heading">
          <Link href="/menu">← Back to menu</Link>
          <span className="eyebrow">CHENNAI PALACE · DINE IN</span>
          <h1>
            Good food,
            <br />
            <em>your way.</em>
          </h1>
          <p>
            Pick what sounds good. We’ll send your order to the cashier for
            confirmation.
          </p>
          <div className="order-intro-steps">
            <span>
              <b>01</b> Choose dishes
            </span>
            <span>
              <b>02</b> Enter table
            </span>
            <span>
              <b>03</b> Send order
            </span>
          </div>
        </div>
        <div className="order-intro-image">
          <Image
            src="/images/dosa.webp"
            alt="Fresh South Indian dosa"
            fill
            sizes="(max-width: 800px) 100vw, 40vw"
            priority
          />
        </div>
      </header>
      {error && (
        <div className="ops-alert" role="alert">
          {error}
        </div>
      )}
      {receipt ? (
        <section className="order-receipt">
          <span className={`ops-badge ${status}`}>
            {closed
              ? "Session closed"
              : status === "pending"
                ? "Awaiting cashier"
                : status === "accepted"
                  ? "Order accepted"
                  : "Order declined"}
          </span>
          <h2>Table {receipt.table}</h2>
          <p>Order #{receipt.id.slice(0, 8).toUpperCase()}</p>
          <p>
            {closed
              ? "This table session has been closed. Speak to the cashier if you need assistance."
              : status === "pending"
                ? "Your order has reached the cashier. Keep this page open for confirmation."
                : status === "accepted"
                  ? "Your order is confirmed and your KOT is ready for the team. Enjoy your meal."
                  : "Please speak to the cashier about availability or place a new order."}
          </p>
          <button className="button" onClick={anotherOrder}>
            {" "}
            {closed ? "Start a new order" : "Order more dishes"}
          </button>
          <p className="order-fine">
            Payment and billing are handled at the cashier.
          </p>
        </section>
      ) : (
        <div className="order-layout">
          <section>
            {featured.length > 0 && !query && category === "All dishes" && (
              <section
                className="order-featured"
                aria-labelledby="order-featured-title"
              >
                <div className="order-section-heading">
                  <div>
                    <span className="eyebrow">A GOOD PLACE TO START</span>
                    <h2 id="order-featured-title">What sounds good?</h2>
                  </div>
                  <p>Start with a dish, then make it your own.</p>
                </div>
                <div className="order-featured-grid">
                  {featured.map((item, index) => (
                    <article className="order-featured-card" key={item.id}>
                      <span className="order-featured-index">0{index + 1}</span>
                      <div>
                        <span className="order-featured-label">
                          {index === 0
                            ? "SOUTH INDIAN"
                            : index === 1
                              ? "FOR THE TABLE"
                              : "RICE & SPICE"}
                        </span>
                        <h3>{item.name}</h3>
                        <p>
                          {item.description ||
                            (index === 0
                              ? "Crisp, warm and full of flavour."
                              : index === 1
                                ? "Comforting, rich and ready to share."
                                : "A fragrant meal in its own right.")}
                        </p>
                      </div>
                      <button
                        disabled={
                          item.stock !== null &&
                          (cart[item.id] || 0) >= item.stock
                        }
                        onClick={() =>
                          change(item.id, (cart[item.id] || 0) + 1)
                        }
                        aria-label={`Add one ${item.name}`}
                      >
                        <span>{money(item.price_cents)}</span>
                        <Plus size={17} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <div className="order-section-heading order-menu-heading">
              <div>
                <span className="eyebrow">EXPLORE THE MENU</span>
                <h2>Find your next bite.</h2>
              </div>
              <span>{matching.length} dishes</span>
            </div>
            <div className="order-filters">
              <label className="order-search">
                <Search size={18} />
                <span className="sr-only">Search dishes</span>
                <input
                  value={query}
                  type="search"
                  placeholder="Search dosa, biryani, coffee…"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div
                className="order-category-filters"
                role="group"
                aria-label="Filter dishes by category"
              >
                {visibleCategories.map((name) => (
                  <button
                    key={name}
                    aria-pressed={category === name}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <p>Loading today’s menu…</p>
            ) : menu.length === 0 ? (
              <p>No dishes available. Please speak to the cashier.</p>
            ) : (
              visibleCategories
                .slice(1)
                .filter((c) => category === "All dishes" || c === category)
                .map((c) => {
                  const dishes = matching.filter((i) => i.category === c);
                  return (
                    dishes.length > 0 && (
                      <section
                        className="order-category"
                        key={c}
                        aria-label={c}
                      >
                        <h2>{c}</h2>
                        {dishes.map((i) => (
                          <article className="order-dish" key={i.id}>
                            <div>
                              <h3>{i.name}</h3>
                              <p>{i.description}</p>
                              <strong>{money(i.price_cents)}</strong>
                              {i.stock === 0 && (
                                <span className="ops-badge">Sold out</span>
                              )}
                            </div>
                            <div className="order-dish-actions">
                              <div className="quantity-control">
                                <button
                                  disabled={!cart[i.id]}
                                  aria-label={`Remove one ${i.name}`}
                                  onClick={() =>
                                    change(i.id, (cart[i.id] || 0) - 1)
                                  }
                                >
                                  −
                                </button>
                                <span aria-live="polite">
                                  {cart[i.id] || 0}
                                </span>
                                <button
                                  disabled={
                                    i.stock === 0 ||
                                    (cart[i.id] || 0) >=
                                      Math.min(i.stock ?? 50, 50)
                                  }
                                  aria-label={`Add one ${i.name}`}
                                  onClick={() =>
                                    change(i.id, (cart[i.id] || 0) + 1)
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </section>
                    )
                  );
                })
            )}
            {!loading && menu.length > 0 && matching.length === 0 && (
              <div className="order-no-results">
                <h3>Nothing matched that search.</h3>
                <p>Try a different name or browse all dishes.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setCategory("All dishes");
                  }}
                >
                  Show all dishes <ArrowRight size={17} />
                </button>
              </div>
            )}
          </section>
          {cartOpen && (
            <button
              className="order-cart-backdrop"
              aria-label="Close cart"
              onClick={() => setCartOpen(false)}
            />
          )}
          <aside
            className={`order-cart${cartOpen ? " is-open" : ""}`}
            ref={cartRef}
            id="your-order"
            role={cartOpen ? "dialog" : undefined}
            aria-modal={cartOpen ? true : undefined}
            aria-label={cartOpen ? "Your order" : undefined}
          >
            <div className="order-cart-header">
              <span className="eyebrow">YOUR TABLE, YOUR FAVOURITES</span>
              <ShoppingBag size={20} className="order-cart-icon" />
              <button
                className="order-cart-close"
                aria-label="Close cart"
                onClick={() => setCartOpen(false)}
              >
                <X size={21} />
              </button>
              <h2>Your order</h2>
              <p>
                {count
                  ? `${count} ${count === 1 ? "item" : "items"} ready for your table`
                  : "The good stuff starts here."}
              </p>
            </div>
            {error && (
              <div className="ops-alert order-cart-error" role="alert">
                {error}
              </div>
            )}
            <label className="ops-field">
              Table number
              <input
                type="number"
                min="1"
                max="999"
                required
                value={table}
                onChange={(e) => {
                  setTable(e.target.value);
                  request.current = null;
                }}
                placeholder="e.g. 12"
              />
            </label>
            {selected.length === 0 ? (
              <p className="order-cart-empty">
                Choose a dish from the menu to get started.
              </p>
            ) : (
              selected.map((i) => (
                <div className="cart-line" key={i.id}>
                  <span>
                    {cart[i.id]} × {i.name}
                  </span>
                  <strong>{money(i.price_cents * cart[i.id])}</strong>
                </div>
              ))
            )}
            {selected.length > 0 && suggestions.length > 0 && (
              <section
                className="order-pairings"
                aria-label="Suggested additions"
              >
                <div className="order-pairings-heading">
                  <Sparkles size={17} />
                  <div>
                    <strong>Make it a meal</strong>
                    <span>Nice alongside your picks</span>
                  </div>
                </div>
                {suggestions.map((item) => (
                  <div className="order-pairing" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{money(item.price_cents)}</span>
                    </div>
                    <button
                      disabled={item.stock === 0}
                      onClick={() => change(item.id, 1)}
                      aria-label={`Add one ${item.name}`}
                    >
                      <Plus size={17} />
                      <span className="sr-only">Add</span>
                    </button>
                  </div>
                ))}
              </section>
            )}
            <label className="ops-field">
              Order notes{" "}
              <small>Optional · speak to staff about allergies</small>
              <textarea
                value={notes}
                maxLength={500}
                onChange={(e) => {
                  setNotes(e.target.value);
                  request.current = null;
                }}
                placeholder="Any special requests?"
              />
            </label>
            <div className="order-cart-checkout">
              <div className="cart-total">
                <span>Estimated total</span>
                <strong>{money(total)}</strong>
              </div>
              <button
                className="button"
                disabled={
                  busy ||
                  !selected.length ||
                  !/^\d+$/.test(table) ||
                  Number(table) < 1 ||
                  Number(table) > 999
                }
                onClick={placeOrder}
              >
                {busy ? "Sending order…" : "Send order to cashier"}
              </button>
              <p className="order-fine">
                All prices in AUD. Order is confirmed when accepted by the
                cashier. Pay at the cashier after your meal.
              </p>
            </div>
          </aside>
        </div>
      )}
      {!receipt && (
        <div className="order-mobile-bar">
          <span>
            <small>
              {count
                ? `${count} ${count === 1 ? "item" : "items"} in your order`
                : "Your table order"}
            </small>
            <strong>{money(total)}</strong>
          </span>
          <button
            ref={cartTrigger}
            aria-expanded={cartOpen}
            aria-controls="your-order"
            onClick={() => setCartOpen(true)}
          >
            View cart <ChevronUp size={17} />
          </button>
        </div>
      )}
    </main>
  );
}
