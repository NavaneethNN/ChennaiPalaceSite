"use client";
import Link from "next/link";
import TableSelect from "@/components/TableSelect";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronUp,
  Check,
  Plus,
  QrCode,
  Phone,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useCategoryScroll } from "@/lib/use-category-scroll";
import { api, send } from "@/lib/client-api";
import { money, type MenuItem } from "@/lib/types";
import { restaurant } from "@/lib/content";
type Receipt = { id: string; token: string; table: number };
type TableChoice = {
  number: number;
  status: "available" | "yours" | "occupied";
};
type CustomerSession = { table: number; token: string };
type TableLock = { table: number; code: string };
type TrackedOrder = {
  status: string;
  closed_at: string | null;
  items: { name: string; quantity: number; price_cents: number }[];
  total_cents: number;
};
type SessionHistory = {
  id: string;
  table: number;
  closed_at: string | null;
  orders: (Omit<TrackedOrder, "closed_at"> & {
    id: string;
    created_at: string;
  })[];
};
export default function OrderContent() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuUpdate, setMenuUpdate] = useState<MenuItem[] | null>(null);
  const menuRef = useRef(menu);
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [table, setTable] = useState("");
  const [tableLock, setTableLock] = useState<TableLock | null>(null);
  const [lockVerifying, setLockVerifying] = useState(false);
  const [lockError, setLockError] = useState("");
  const [availableTables, setAvailableTables] = useState<TableChoice[]>([]);
  const [customerSession, setCustomerSession] =
    useState<CustomerSession | null>(null);
  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyRequested, setHistoryRequested] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All dishes");
  const scrollCategory = useCategoryScroll(
    category,
    ".order-filters",
    ".order-category, .order-no-results",
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState("pending");
  const [closed, setClosed] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [added, setAdded] = useState<{ name: string; sequence: number } | null>(
    null,
  );
  const feedbackSequence = useRef(0);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 2200);
    return () => window.clearTimeout(timer);
  }, [added]);
  const request = useRef<{ key: string; token: string } | null>(null);
  const cartRef = useRef<HTMLElement>(null);
  const cartTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const panel = cartRef.current;
    if (!panel) return;
    const fitCart = () => {
      panel.style.setProperty(
        "--cart-available-height",
        `${Math.max(320, window.innerHeight - panel.getBoundingClientRect().top - 16)}px`,
      );
    };
    fitCart();
    const observer = new ResizeObserver(fitCart);
    observer.observe(document.querySelector(".order-page")!);
    window.addEventListener("resize", fitCart);
    window.addEventListener("scroll", fitCart, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitCart);
      window.removeEventListener("scroll", fitCart);
    };
  }, [receipt]);

  useEffect(() => {
    if (!cartOpen) return;
    const mobile = window.matchMedia("(max-width: 800px)");
    if (!mobile.matches) return;
    const trigger = cartTrigger.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cartRef.current
      ?.querySelector<HTMLButtonElement>(".order-cart-close")
      ?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") setCartOpen(false);
      if (event.key !== "Tab") return;
      const targets = Array.from(
        cartRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
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
      trigger?.focus({ preventScroll: true });
    };
  }, [cartOpen]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setHistoryRequested(params.get("history") === "1");
    const urlTable = params.get("table") || params.get("t");
    const urlCode = params.get("code") || params.get("qr") || params.get("k");

    if (urlTable && urlCode) {
      setLockVerifying(true);
      api<{ valid: boolean; table: number }>(
        `/api/tables/verify?table=${urlTable}&code=${encodeURIComponent(urlCode)}`,
      )
        .then((res) => {
          if (res.valid) {
            const lock = { table: Number(urlTable), code: urlCode };
            setTableLock(lock);
            setTable(String(urlTable));
            setLockError("");
            try {
              sessionStorage.setItem("palace_table_lock", JSON.stringify(lock));
              localStorage.setItem("palace_table_lock", JSON.stringify(lock));
            } catch {}
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("code");
            cleanUrl.searchParams.delete("qr");
            cleanUrl.searchParams.delete("k");
            window.history.replaceState(
              {},
              "",
              cleanUrl.pathname +
                (cleanUrl.searchParams.toString()
                  ? `?${cleanUrl.searchParams.toString()}`
                  : ""),
            );
          } else {
            setLockError(
              "The scanned table QR code is invalid or expired. Please scan the QR code located on your dining table.",
            );
          }
        })
        .catch((err) => {
          setLockError((err as Error).message);
        })
        .finally(() => setLockVerifying(false));
    } else {
      try {
        const savedLockRaw =
          sessionStorage.getItem("palace_table_lock") ||
          localStorage.getItem("palace_table_lock");
        if (savedLockRaw) {
          const lock = JSON.parse(savedLockRaw);
          if (Number.isInteger(lock?.table) && typeof lock?.code === "string") {
            setLockVerifying(true);
            api<{ valid: boolean }>(
              `/api/tables/verify?table=${lock.table}&code=${encodeURIComponent(lock.code)}`,
            )
              .then((res) => {
                if (res.valid) {
                  setTableLock(lock);
                  setTable(String(lock.table));
                  setLockError("");
                } else {
                  sessionStorage.removeItem("palace_table_lock");
                  localStorage.removeItem("palace_table_lock");
                  setTableLock(null);
                }
              })
              .catch(() => {
                setTableLock(lock);
                setTable(String(lock.table));
              })
              .finally(() => setLockVerifying(false));
          }
        }
      } catch {}
    }

    try {
      const saved =
        sessionStorage.getItem("palace_order") ||
        localStorage.getItem("palace_order");
      if (saved) {
        const value = JSON.parse(saved);
        if (!params.get("item")) setReceipt(value);
        setTable(String(value.table));
      }
      const savedSession =
        sessionStorage.getItem("palace_customer_session") ||
        localStorage.getItem("palace_customer_session");
      if (savedSession) {
        const value = JSON.parse(savedSession);
        if (Number.isInteger(value.table) && typeof value.token === "string")
          setCustomerSession(value);
      }
    } catch {}
    setRestored(true);
    api<MenuItem[]>("/api/menu")
      .then((items) => {
        setMenu(items);
        const featuredId = params.get("item");
        const featuredItem = items.find(
          (item) => item.id === featuredId && item.stock !== 0,
        );
        if (featuredId && featuredItem) {
          setAdded({
            name: featuredItem.name,
            sequence: ++feedbackSequence.current,
          });
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
    if (!customerSession) {
      setHistory(null);
      return;
    }
    let active = true;
    let finished = false;
    const update = async () => {
      if (finished || document.hidden) return;
      try {
        const data = await api<SessionHistory>(
          `/api/customer-session?table=${customerSession.table}`,
          { headers: { "X-Customer-Token": customerSession.token } },
        );
        if (!active) return;
        setHistoryError("");
        if (data.closed_at) {
          finished = true;
          setHistory(null);
          setClosed(true);
          setCustomerSession(null);
          try {
            sessionStorage.removeItem("palace_customer_session");
            localStorage.removeItem("palace_customer_session");
          } catch {}
        } else {
          setHistory(data);
        }
      } catch (error) {
        if (active) setHistoryError((error as Error).message);
      }
    };
    void update();
    const timer = window.setInterval(update, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [customerSession, receipt?.id]);
  useEffect(() => {
    if (!receipt) return;
    let active = true;
    const update = () =>
      api<TrackedOrder>(`/api/orders?id=${receipt.id}&token=${receipt.token}`)
        .then((data) => {
          if (active) {
            setStatus(data.status);
            setClosed(Boolean(data.closed_at));
            setTrackedOrder(data);
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
    if (!restored || receipt) return;
    let active = true;
    const refresh = () => {
      if (document.hidden) return;
      api<MenuItem[]>("/api/menu")
        .then((data) => {
          if (!active) return;
          const current = menuRef.current;
          if (!current.length) {
            setMenu(data);
            return;
          }
          // Availability can change live; defer changes that would move dishes.
          const structure = (items: MenuItem[]) =>
            JSON.stringify(
              items.map(({ id, name, category, description }) => ({
                id,
                name,
                category,
                description,
              })),
            );
          setMenuUpdate(structure(current) === structure(data) ? null : data);
          setMenu(
            current.map((item) => {
              const latest = data.find((dish) => dish.id === item.id);
              return {
                ...item,
                stock: latest ? latest.stock : 0,
                price_cents: latest?.price_cents ?? item.price_cents,
              };
            }),
          );
        })
        .catch(() => {});
      api<TableChoice[]>("/api/tables", {
        headers: customerSession
          ? { "X-Customer-Token": customerSession.token }
          : {},
      })
        .then((choices) => {
          if (active) {
            setAvailableTables(choices);
            setTable((current) =>
              choices.some(
                (choice) =>
                  choice.number === Number(current) &&
                  choice.status !== "occupied",
              )
                ? current
                : String(
                    choices.find(
                      (choice) =>
                        choice.status === "yours" &&
                        choice.number === customerSession?.table,
                    )?.number || "",
                  ),
            );
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setTablesLoading(false);
        });
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [receipt, customerSession, restored]);
  const change = (id: string, quantity: number) => {
    const item = menu.find((dish) => dish.id === id);
    if (!item) return;
    const next = Math.max(0, Math.min(50, item.stock ?? 50, quantity));
    if (next > (cart[id] || 0)) {
      setAdded({ name: item.name, sequence: ++feedbackSequence.current });
    }
    request.current = null;
    setCart((c) => ({ ...c, [id]: next }));
  };
  const selected = menu.filter((i) => cart[i.id] > 0);
  const total = selected.reduce(
    (sum, i) => sum + i.price_cents * cart[i.id],
    0,
  );
  const count = selected.reduce((sum, item) => sum + cart[item.id], 0);
  const selectedTable = availableTables.find(
    (choice) => choice.number === Number(table),
  );
  const canUseTable = Boolean(
    selectedTable && selectedTable.status !== "occupied",
  );
  const available = menu.filter((item) => item.stock !== 0);
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
    if (!tableLock) {
      setError(
        "Scanning the QR code on your dining table is required to place an order.",
      );
      return;
    }
    if (!canUseTable) {
      setError("Please choose an available table.");
      return;
    }
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
        table_code: tableLock.code,
        items: selected.map((i) => ({ id: i.id, quantity: cart[i.id] })),
        notes,
        request_key: request.current.key,
        tracking_token: request.current.token,
        ...(selectedTable?.status === "yours" &&
        customerSession?.table === Number(table)
          ? { customer_token: customerSession.token }
          : {}),
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
      setTrackedOrder(null);
      if (selectedTable?.status !== "yours") {
        const owner = { table: Number(table), token: request.current.token };
        setHistory(null);
        setCustomerSession(owner);
        try {
          sessionStorage.setItem(
            "palace_customer_session",
            JSON.stringify(owner),
          );
          localStorage.setItem(
            "palace_customer_session",
            JSON.stringify(owner),
          );
        } catch {}
      }
      try {
        sessionStorage.setItem("palace_order", JSON.stringify(value));
        localStorage.setItem("palace_order", JSON.stringify(value));
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
    if (receipt && !closed) setTable(String(receipt.table));
    setReceipt(null);
    setTrackedOrder(null);
    try {
      sessionStorage.removeItem("palace_order");
      localStorage.removeItem("palace_order");
    } catch {}
    if (closed) {
      setCustomerSession(null);
      try {
        sessionStorage.removeItem("palace_customer_session");
        localStorage.removeItem("palace_customer_session");
      } catch {}
    }
    api<MenuItem[]>("/api/menu")
      .then(setMenu)
      .catch((e) => setError(e.message));
  }
  return (
    <main id="main" className="order-page">
      <header className="order-menu-intro">
        <div>
          <span className="eyebrow">CHENNAI PALACE · DINE IN</span>
          <h1>{receipt ? "Your table order" : "What are you craving?"}</h1>
          <p>
            {tableLock
              ? `Ordering directly for Table ${tableLock.table}. Add dishes when you're ready.`
              : "South Indian classics, freshly prepared for your table."}
          </p>
        </div>
        <Link href="/menu">
          Browse menu <ArrowRight size={16} />
        </Link>
      </header>

      {lockVerifying && (
        <div
          style={{
            textAlign: "center",
            padding: "50px 20px",
            background: "#fffdf9",
            borderRadius: "10px",
            border: "1px solid #eadbd2",
            margin: "20px 0",
          }}
        >
          <div
            className="animate-spin"
            style={{
              display: "inline-block",
              width: "28px",
              height: "28px",
              border: "3px solid #eadbd2",
              borderTopColor: "var(--purple)",
              borderRadius: "50%",
              marginBottom: "12px",
            }}
          />
          <h3 style={{ fontSize: "17px", margin: "0 0 4px" }}>
            Verifying table QR code…
          </h3>
          <p style={{ color: "#777", fontSize: "13px", margin: 0 }}>
            Securing your table order session.
          </p>
        </div>
      )}

      {!lockVerifying && !tableLock && !receipt && (
        <section
          style={{
            margin: "20px auto 40px",
            maxWidth: "600px",
            background: "#fffdf9",
            border: "1px solid #eadbd2",
            borderRadius: "14px",
            padding: "36px 28px",
            textAlign: "center",
          }}
          aria-label="Table QR code required"
        >
          <div
            style={{
              width: "68px",
              height: "68px",
              background: "rgba(142, 28, 62, 0.08)",
              color: "var(--purple)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <QrCode size={36} />
          </div>
          <span className="eyebrow">DINE-IN ORDER SECURITY</span>
          <h2 style={{ fontSize: "28px", margin: "8px 0 12px" }}>
            Scan your table QR code to order
          </h2>
          <p
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#666",
              marginBottom: "24px",
            }}
          >
            For guest security and accurate kitchen dispatch, online orders can
            only be placed by scanning the QR code stand located on your dining
            table.
          </p>

          {lockError && (
            <div
              className="ops-alert"
              style={{ marginBottom: "20px", textAlign: "left" }}
              role="alert"
            >
              {lockError}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: "14px",
              textAlign: "left",
              background: "#f8f3ee",
              padding: "20px",
              borderRadius: "10px",
              marginBottom: "26px",
            }}
          >
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
            >
              <span
                style={{
                  background: "var(--purple)",
                  color: "white",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                1
              </span>
              <div>
                <strong style={{ fontSize: "14px" }}>
                  Find the QR stand on your table
                </strong>
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>
                  Every dining table at Chennai Palace features a dedicated QR
                  code stand.
                </p>
              </div>
            </div>
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
            >
              <span
                style={{
                  background: "var(--purple)",
                  color: "white",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                2
              </span>
              <div>
                <strong style={{ fontSize: "14px" }}>
                  Scan with your phone camera
                </strong>
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>
                  Open your camera or QR code scanner and point it at the code.
                </p>
              </div>
            </div>
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
            >
              <span
                style={{
                  background: "var(--purple)",
                  color: "white",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                3
              </span>
              <div>
                <strong style={{ fontSize: "14px" }}>
                  Order straight to your table
                </strong>
                <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>
                  Tap the notification to unlock your session and order dishes.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link className="button" href="/menu">
              Browse menu (View only) <ArrowRight size={16} />
            </Link>
            <a
              href={restaurant.phoneHref}
              className="button secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Phone size={15} /> Takeaway: {restaurant.phone}
            </a>
          </div>
        </section>
      )}

      {tableLock && !receipt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f3eae4",
            border: "1px solid #eadbd2",
            borderRadius: "8px",
            padding: "10px 16px",
            marginBottom: "20px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="ops-badge accepted"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Check size={12} /> Table {tableLock.table} Active
            </span>
            <span>
              Your session is locked to <strong>Table {tableLock.table}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Clear Table ${tableLock.table} session and scan another table?`,
                )
              ) {
                setTableLock(null);
                setTable("");
                try {
                  sessionStorage.removeItem("palace_table_lock");
                  localStorage.removeItem("palace_table_lock");
                } catch {}
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--purple)",
              fontSize: "12px",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Switch table
          </button>
        </div>
      )}

      <div
        className="order-feedback"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {added && (
          <span key={added.sequence}>
            <Check size={18} /> {added.name} added to your order
          </span>
        )}
      </div>
      {error && (
        <div className="ops-alert" role="alert">
          {error}
        </div>
      )}
      {customerSession && (
        <details
          className="order-session-history"
          open={Boolean(receipt) || historyRequested}
        >
          <summary>
            Order history · Table {customerSession.table}
            {history && (
              <span>
                {history.orders.length}{" "}
                {history.orders.length === 1 ? "order" : "orders"}
              </span>
            )}
          </summary>
          <div
            className="order-history-list"
            role="region"
            aria-label="Session order history"
            tabIndex={0}
          >
            {historyError && (
              <p role="alert">
                {historyError} History will refresh automatically.
              </p>
            )}
            {!history && !historyError && <p>Loading your session’s orders…</p>}
            {history?.orders.map((order, index) => (
              <article className="order-history-entry" key={order.id}>
                <div className="order-history-heading">
                  <h3>
                    Order {index + 1}{" "}
                    <small>#{order.id.slice(0, 8).toUpperCase()}</small>
                  </h3>
                  <span className={`ops-badge ${order.status}`}>
                    {order.status === "pending"
                      ? "Awaiting cashier"
                      : order.status === "accepted"
                        ? "Accepted"
                        : "Declined"}
                  </span>
                </div>
                {order.items.map((item, itemIndex) => (
                  <div className="cart-line" key={itemIndex}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <strong>{money(item.price_cents * item.quantity)}</strong>
                  </div>
                ))}
                <div className="cart-total">
                  <span>Order total</span>
                  <strong>{money(order.total_cents)}</strong>
                </div>
              </article>
            ))}
          </div>
        </details>
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
          <div className="order-receipt-items">
            <h3>Your ordered items</h3>
            {trackedOrder ? (
              <>
                {trackedOrder.items.map((item, index) => (
                  <div className="cart-line" key={`${item.name}-${index}`}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <strong>{money(item.price_cents * item.quantity)}</strong>
                  </div>
                ))}
                <div className="cart-total">
                  <span>Order total</span>
                  <strong>{money(trackedOrder.total_cents)}</strong>
                </div>
              </>
            ) : (
              <p>Loading your ordered items…</p>
            )}
          </div>
          <button className="button" onClick={anotherOrder}>
            {" "}
            {closed ? "Start a new order" : "Order more dishes"}
          </button>
          <p className="order-fine">
            Payment and billing are handled at the cashier.
          </p>
        </section>
      ) : tableLock ? (
        <div className="order-layout">
          <section>
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
                    onClick={() => {
                      scrollCategory(name);
                      setCategory(name);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="order-menu-count">
              {loading ? "Preparing the menu…" : `${matching.length} dishes`}{" "}
              {menuUpdate && (
                <button
                  className="order-menu-refresh"
                  onClick={() => {
                    setMenu(menuUpdate);
                    setMenuUpdate(null);
                  }}
                >
                  Refresh updated menu
                </button>
              )}
              <span>ALL PRICES IN AUD</span>
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
                          <article
                            className={`order-dish${cart[i.id] ? " is-selected" : ""}`}
                            key={i.id}
                          >
                            <div>
                              <h3>{i.name}</h3>
                              <p>{i.description}</p>
                              <strong>{money(i.price_cents)}</strong>
                              <span
                                className="ops-badge"
                                style={{
                                  visibility:
                                    i.stock === 0 ? "visible" : "hidden",
                                }}
                              >
                                Sold out
                              </span>
                            </div>
                            <div className="order-dish-actions">
                              {!cart[i.id] ? (
                                <button
                                  className="order-add"
                                  disabled={i.stock === 0}
                                  aria-label={`Add one ${i.name}`}
                                  onClick={() => change(i.id, 1)}
                                >
                                  {i.stock === 0 ? (
                                    "Sold out"
                                  ) : (
                                    <>
                                      Add <Plus size={17} />
                                    </>
                                  )}
                                </button>
                              ) : (
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
                                  <span
                                    key={cart[i.id]}
                                    className="order-quantity-pop"
                                  >
                                    {cart[i.id]}
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
                              )}
                              <small
                                className="order-in-cart"
                                style={{
                                  visibility: cart[i.id] ? "visible" : "hidden",
                                }}
                              >
                                <Check size={12} /> In your order
                              </small>
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
              <ShoppingBag
                key={added?.sequence || 0}
                size={20}
                className={`order-cart-icon${added ? " order-cart-pop" : ""}`}
              />
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
            <div className="order-cart-body">
              {error && (
                <div className="ops-alert order-cart-error" role="alert">
                  {error}
                </div>
              )}
              {tableLock ? (
                <div
                  className="ops-field"
                  style={{
                    background: "#f8f3ee",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #eadbd2",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      display: "block",
                    }}
                  >
                    Dining table
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "4px",
                    }}
                  >
                    <strong style={{ fontSize: "16px" }}>
                      Table {tableLock.table}
                    </strong>
                    <span
                      className="ops-badge accepted"
                      style={{ fontSize: "11px" }}
                    >
                      ✓ QR Verified
                    </span>
                  </div>
                </div>
              ) : (
                <TableSelect
                  key={String(cartOpen)}
                  value={table}
                  choices={availableTables}
                  loading={tablesLoading}
                  onChange={(value) => {
                    setTable(value);
                    request.current = null;
                  }}
                />
              )}
              {!tablesLoading &&
                !availableTables.some(
                  (choice) => choice.status !== "occupied",
                ) && (
                  <p className="order-fine">
                    No tables are available. Please ask the cashier.
                  </p>
                )}
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
            </div>
            <div className="order-cart-checkout">
              <div className="cart-total">
                <span>Estimated total</span>
                <strong key={count} className="order-total-pop">
                  {money(total)}
                </strong>
              </div>
              <button
                className="button"
                disabled={busy || !selected.length || !canUseTable}
                onClick={placeOrder}
              >
                {busy ? "Placing order…" : "Place order"}
              </button>
              <p className="order-fine">
                All prices in AUD. Order is confirmed when accepted by the
                cashier. Pay at the cashier after your meal.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
      {!receipt && tableLock && (
        <div className="order-mobile-bar">
          <span>
            <small>
              {count
                ? `${count} ${count === 1 ? "item" : "items"} in your order`
                : `Table ${tableLock.table} order`}
            </small>
            <strong key={count} className="order-total-pop">
              {money(total)}
            </strong>
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
