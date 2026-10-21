"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, Search, X, Phone, Plus, QrCode } from "lucide-react";
import initialMenu from "@/lib/menu.json";
import { useCategoryScroll } from "@/lib/use-category-scroll";
import { api } from "@/lib/client-api";
import { money, type MenuItem } from "@/lib/types";
import { restaurant } from "@/lib/content";
export default function MenuContent() {
  type DisplayItem = {
    id?: string;
    name: string;
    description: string;
    price: string;
    soldOut?: boolean;
  };
  type DisplayGroup = { id: string; title: string; items: DisplayItem[] };
  const [menu, setMenu] = useState<DisplayGroup[]>(initialMenu);
  const [menuError, setMenuError] = useState("");
  const [sessionTable, setSessionTable] = useState<number | null>(null);
  const [tableLock, setTableLock] = useState<{
    table: number;
    code: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    try {
      const lockRaw =
        sessionStorage.getItem("palace_table_lock") ||
        localStorage.getItem("palace_table_lock");
      if (lockRaw) {
        const lock = JSON.parse(lockRaw);
        if (Number.isInteger(lock?.table) && typeof lock?.code === "string") {
          api<{ valid: boolean }>(
            `/api/tables/verify?table=${lock.table}&code=${encodeURIComponent(lock.code)}`,
          )
            .then((res) => {
              if (active && res.valid) {
                setTableLock(lock);
              } else if (active) {
                setTableLock(null);
                sessionStorage.removeItem("palace_table_lock");
                localStorage.removeItem("palace_table_lock");
              }
            })
            .catch(() => {
              if (active) setTableLock(lock);
            });
        }
      }
    } catch {}
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("palace_customer_session") ||
          localStorage.getItem("palace_customer_session") ||
          "null",
      );
      if (Number.isInteger(saved?.table) && typeof saved?.token === "string") {
        setSessionTable(saved.table);
        api<{ closed_at: string | null }>(
          `/api/customer-session?table=${saved.table}`,
          {
            headers: { "X-Customer-Token": saved.token },
          },
        )
          .then((session) => {
            if (active && session.closed_at) setSessionTable(null);
          })
          .catch(() => {
            // Keep the return link available during a temporary connection failure.
          });
      }
    } catch {}
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    api<MenuItem[]>("/api/menu")
      .then((items) => {
        const groups = [...new Set(items.map((i) => i.category))].map(
          (title) => ({
            id:
              initialMenu.find((g) => g.title === title)?.id ||
              title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            title,
            items: items
              .filter((i) => i.category === title)
              .map((i) => ({
                name: i.name,
                description: i.description,
                price: money(i.price_cents),
                id: i.id,
                soldOut: i.stock === 0,
              })),
          }),
        );
        setMenu(groups);
      })
      .catch(() =>
        setMenuError(
          "Live menu is temporarily unavailable. Please confirm availability with the cashier.",
        ),
      );
  }, []);
  const [category, setCategory] = useState("all");
  const scrollCategory = useCategoryScroll(
    category,
    ".menu-toolbar",
    ".menu-group, .menu-empty",
  );
  const [query, setQuery] = useState("");
  const filters = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = filters.current;
    const selected = container?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    if (
      container &&
      selected &&
      container.scrollWidth > container.clientWidth
    ) {
      container.scrollTo({
        left: selected.offsetLeft - container.offsetLeft - 12,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [category]);
  useEffect(() => {
    const read = () => {
      const selected = new URLSearchParams(window.location.search).get(
        "category",
      );
      setCategory(
        initialMenu.some((group) => group.id === selected) ? selected! : "all",
      );
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const selectCategory = (value: string) => {
    scrollCategory(value);
    setCategory(value);
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", value);
    window.history.replaceState({}, "", url);
  };
  const filtered = menu
    .filter((group) => category === "all" || group.id === category)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.name} ${item.description}`
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const count = filtered.reduce((sum, group) => sum + group.items.length, 0);
  const available = menu
    .flatMap((group) => group.items)
    .filter((item) => item.id && !item.soldOut);
  const inspiration = ["Masala Dosa", "Butter Chicken", "Mango Lassi"]
    .map((name) => available.find((item) => item.name === name))
    .filter((item): item is DisplayItem & { id: string } => Boolean(item?.id));
  return (
    <main id="main">
      <header className="menu-browse-intro" id="top">
        <div>
          <span className="eyebrow">FROM OUR KITCHEN, WITH LOVE</span>
          <h1>Find your favourite.</h1>
          <p>
            South Indian favourites, comforting curries and something sweet.
          </p>
        </div>
        <div className="menu-browse-actions">
          {tableLock ? (
            <Link className="button" href={`/order?table=${tableLock.table}`}>
              Order for Table {tableLock.table} <ArrowUpRight size={18} />
            </Link>
          ) : (
            <span
              className="menu-qr-scan-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                padding: "10px 18px",
                borderRadius: "999px",
                background: "#f3eae4",
                color: "var(--ink)",
                border: "1px solid #eadbd2",
                fontWeight: 500,
              }}
            >
              <QrCode size={16} /> Scan your table QR code to order
            </span>
          )}
          {sessionTable !== null && tableLock && (
            <Link className="menu-history-link" href="/order?history=1">
              View order history <span>Table {sessionTable}</span>{" "}
              <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </header>
      <section className="menu-main section-pad" aria-label="Restaurant menu">
        {menuError && (
          <p role="status" className="ops-alert">
            {menuError}
          </p>
        )}
        <div className="menu-toolbar">
          <div
            ref={filters}
            className="category-filters"
            role="group"
            aria-label="Filter menu categories"
          >
            <button
              aria-pressed={category === "all"}
              onClick={() => selectCategory("all")}
            >
              Full menu
            </button>
            {menu.map((group) => (
              <button
                key={group.id}
                aria-pressed={category === group.id}
                onClick={() => selectCategory(group.id)}
              >
                {group.title}
              </button>
            ))}
          </div>
          <label className="menu-search">
            <Search size={18} />
            <span className="sr-only">Search dishes</span>
            <input
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Find a favourite…"
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <div className="menu-results-count" aria-live="polite">
          {count} dishes to discover <span>ALL PRICES IN AUD</span>
        </div>
        {filtered.map((group, i) => (
          <section
            className="menu-group"
            key={group.id}
            aria-labelledby={`title-${group.id}`}
          >
            <div className="menu-group-heading">
              <span>0{menu.findIndex((g) => g.id === group.id) + 1}</span>
              <h2 id={`title-${group.id}`}>{group.title}</h2>
              <span>{group.items.length} dishes</span>
            </div>
            <div className="menu-items">
              {group.items.map((item) => (
                <article className="menu-item" key={item.name}>
                  <div>
                    <h3>{item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <div className="menu-item-action">
                    <span className="dish-price">{item.price}</span>
                    {item.id && !item.soldOut && tableLock && (
                      <Link
                        href={`/order?item=${encodeURIComponent(item.id)}`}
                        aria-label={`Add ${item.name} to your table order`}
                      >
                        <Plus size={15} /> Add
                      </Link>
                    )}
                    {item.soldOut && (
                      <span className="menu-sold-out">Sold out</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {i === 0 && category === "all" && !query && (
              <div className="menu-inline-note">
                <span>Made for sharing. Made for savouring.</span>
                <span aria-hidden="true">✳</span>
              </div>
            )}
          </section>
        ))}
        {count === 0 && (
          <div className="menu-empty">
            <Search size={30} />
            <h2>No dishes found.</h2>
            <p>Try another search or explore the full menu.</p>
            <button
              className="button"
              onClick={() => {
                setQuery("");
                selectCategory("all");
              }}
            >
              Show the full menu <ArrowUpRight size={17} />
            </button>
          </div>
        )}
        {inspiration.length > 0 && category === "all" && !query && (
          <section
            className="menu-inspiration"
            aria-labelledby="menu-inspiration-title"
          >
            <div className="menu-inspiration-heading">
              <div>
                <span className="eyebrow">NOT SURE WHERE TO BEGIN?</span>
                <h2 id="menu-inspiration-title">A little inspiration.</h2>
                <p>A few ways to start your meal.</p>
              </div>
              {tableLock && (
                <Link href={`/order?table=${tableLock.table}`}>
                  Build your order <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
            <div className="menu-inspiration-grid">
              {inspiration.map((item, index) => (
                <article key={item.id} className="menu-inspiration-card">
                  <span className="menu-inspiration-number">0{index + 1}</span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.description ||
                      (index === 0
                        ? "A South Indian classic to begin with."
                        : index === 1
                          ? "A comforting curry for the table."
                          : "A cool finish alongside your meal.")}
                  </p>
                  {tableLock ? (
                    <Link href={`/order?item=${encodeURIComponent(item.id)}`}>
                      Add to order <span>{item.price}</span> <Plus size={16} />
                    </Link>
                  ) : (
                    <div style={{ marginTop: "17px", minHeight: "40px", display: "flex", alignItems: "center" }}>
                      <span className="dish-price" style={{ fontWeight: 650, color: "var(--ink)" }}>{item.price}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="menu-disclaimer">
          <p>
            Menu prices and availability may change. Please confirm with our
            team when ordering.
          </p>
          <p>
            Have a food allergy or dietary requirement? Please speak with us
            before you order.
          </p>
        </div>
        <div className="menu-order-banner">
          <div>
            <span className="eyebrow">
              {tableLock ? "FOUND YOUR FAVOURITES?" : "VISITING CHENNAI PALACE?"}
            </span>
            <h2>{tableLock ? "Let’s make it a meal." : "Dine-in or takeaway."}</h2>
            <p>
              {tableLock
                ? "Order right here for your table, or call us for takeaway."
                : "Scan the QR code on your dining table to unlock mobile ordering. Calling for takeaway? We’d love to serve you."}
            </p>
          </div>
          <div className="menu-banner-actions">
            {tableLock && (
              <Link className="button button-light" href={`/order?table=${tableLock.table}`}>
                Order for Table {tableLock.table} <ArrowUpRight size={18} />
              </Link>
            )}
            <a href={restaurant.phoneHref}>
              <Phone size={16} /> Takeaway: {restaurant.phone}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
