"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ClipboardList,
  UtensilsCrossed,
  Users,
  History,
  LogOut,
  Plus,
  Printer,
  RefreshCw,
  Search,
  LayoutDashboard,
  Grid3X3,
} from "lucide-react";
import { api, send } from "@/lib/client-api";
import {
  money,
  type Staff,
  type MenuItem,
  type Cashier,
  type TableSession,
  type RestaurantTable,
  type Order,
} from "@/lib/types";
type Tab = "orders" | "menu" | "tables" | "cashiers" | "history";
type MenuDraft = {
  version?: number;
  id?: string;
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  printer: "kitchen" | "cashier";
  active: boolean;
};
type CashierDraft = {
  id?: string;
  name: string;
  pin: string;
  password: string;
  active: boolean;
};
const newMenu: MenuDraft = {
  name: "",
  category: "",
  description: "",
  price: "",
  stock: "",
  printer: "kitchen",
  active: true,
};
const newCashier: CashierDraft = {
  name: "",
  pin: "",
  password: "",
  active: true,
};
const time = (date: string) =>
  new Date(date).toLocaleString("en-AU", {
    timeZone: "Australia/Adelaide",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function StaffConsole({ mode }: { mode: "admin" | "cashier" }) {
  const [user, setUser] = useState<Staff | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [tab, setTab] = useState<Tab>("orders");
  const [tables, setTables] = useState<TableSession[]>([]);
  const [history, setHistory] = useState<TableSession[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [configuredTables, setConfiguredTables] = useState<RestaurantTable[]>(
    [],
  );
  const [tableDraft, setTableDraft] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [menuDraft, setMenuDraft] = useState<MenuDraft | null>(null);
  const [cashierDraft, setCashierDraft] = useState<CashierDraft | null>(null);
  const [closing, setClosing] = useState<TableSession | null>(null);
  const [lastKot, setLastKot] = useState<string | null>(null);
  const refreshing = useRef(false);
  const refreshAgain = useRef(false);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState("");
  useEffect(() => {
    api<Staff>("/api/auth")
      .then((u) => {
        if (mode === "admin" && u.role !== "admin") return;
        setUser(u);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [mode]);
  const refresh = useCallback(async () => {
    if (refreshing.current) {
      refreshAgain.current = true;
      return;
    }
    refreshing.current = true;
    try {
      do {
        refreshAgain.current = false;
        const data = await api<TableSession[]>("/api/operations");
        setTables(data);
        setUpdated(
          new Date().toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      } while (refreshAgain.current);
    } finally {
      refreshing.current = false;
    }
  }, []);
  const loadAdmin = useCallback(async () => {
    const data = await api<{
      menu: MenuItem[];
      cashiers: Cashier[];
      tables: RestaurantTable[];
    }>("/api/admin");
    setMenu(data.menu);
    setCashiers(data.cashiers);
    setConfiguredTables(data.tables);
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let connected = false;
    const update = () =>
      refresh().catch((e) => {
        if (active) setError(e.message);
      });
    const source = new EventSource("/api/events");
    const changed = () => {
      void update();
      if (
        user.role === "admin" &&
        (tab === "menu" || tab === "tables" || tab === "cashiers")
      )
        void loadAdmin().catch((e) => {
          if (active) setError(e.message);
        });
      if (tab === "history")
        void api<TableSession[]>("/api/operations?history=1")
          .then(setHistory)
          .catch(() => {});
    };
    source.addEventListener("ready", () => {
      connected = true;
      setLive(true);
      changed();
    });
    source.addEventListener("change", changed);
    source.addEventListener("expired", () => {
      source.close();
      setLive(false);
      setUser(null);
      setError("Your session has expired. Please sign in.");
    });
    source.onerror = () => {
      connected = false;
      setLive(false);
    };
    void update();
    const timer = setInterval(() => {
      if (!connected) void update();
    }, 5000);
    const visible = () => {
      if (!document.hidden) changed();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      source.close();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [user, refresh, loadAdmin, tab]);
  useEffect(() => {
    if (!user) return;
    if (tab === "menu" || tab === "tables" || tab === "cashiers")
      loadAdmin().catch((e) => setError(e.message));
    if (tab === "history")
      api<TableSession[]>("/api/operations?history=1")
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [tab, user, loadAdmin]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/api/auth", { role: mode, password, pin });
      setUser(await api<Staff>("/api/auth"));
      setPassword("");
      setPin("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/api/auth", { method: "DELETE" });
      setUser(null);
      setTables([]);
      setMenu([]);
      setCashiers([]);
      setConfiguredTables([]);
      setHistory([]);
      setTab("orders");
      setNotice("");
      setLastKot(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function processOrder(order: Order, action: "accept" | "reject") {
    // Open synchronously during the click so browsers permit the generated PDF tab.
    const pdf =
      action === "accept" ? window.open("about:blank", "_blank") : null;
    if (pdf) pdf.opener = null;
    setActionBusy(order.id);
    setError("");
    setNotice("");
    try {
      const result = await send<{ kot_url?: string }>("/api/operations", {
        id: order.id,
        action,
      });
      if (result.kot_url) {
        setLastKot(result.kot_url);
        if (pdf) pdf.location.href = result.kot_url;
        setNotice(
          pdf
            ? "Order accepted. KOT PDF opened for printing."
            : "Order accepted. Use “Open latest KOT” below; your browser blocked the PDF tab.",
        );
      } else setNotice("Order rejected. Stock and table total are unchanged.");
      await refresh();
    } catch (e) {
      pdf?.close();
      setError((e as Error).message);
    } finally {
      setActionBusy("");
    }
  }
  async function closeSession() {
    if (!closing) return;
    setBusy(true);
    setError("");
    try {
      await send("/api/operations", {
        id: closing.id,
        action: "close",
        expected_total: closing.total_cents,
        expected_order_count: closing.orders.length,
      });
      setClosing(null);
      setSelectedTable(null);
      setNotice("Table session closed. The next order starts a fresh session.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveMenu(e: FormEvent) {
    e.preventDefault();
    if (!menuDraft) return;
    setBusy(true);
    setError("");
    try {
      await send("/api/admin", {
        kind: "menu",
        ...menuDraft,
        price_cents: Math.round(Number(menuDraft.price) * 100),
        stock: menuDraft.stock === "" ? null : Number(menuDraft.stock),
      });
      setMenuDraft(null);
      setNotice("Menu item saved. Customers see the update immediately.");
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveCashier(e: FormEvent) {
    e.preventDefault();
    if (!cashierDraft) return;
    setBusy(true);
    setError("");
    try {
      await send("/api/admin", { kind: "cashier", ...cashierDraft });
      setCashierDraft(null);
      setNotice("Cashier account saved.");
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveTable(e: FormEvent) {
    e.preventDefault();
    if (tableDraft === null) return;
    setBusy(true);
    setError("");
    try {
      await send("/api/admin", {
        kind: "table",
        number: Number(tableDraft),
        active: true,
      });
      setTableDraft(null);
      setNotice("Table saved. Customers can select it now.");
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleTable(table: RestaurantTable) {
    setActionBusy(`table-${table.number}`);
    setError("");
    try {
      await send("/api/admin", {
        kind: "table",
        number: table.number,
        active: !table.active,
      });
      setNotice(
        `Table ${table.number} ${table.active ? "hidden from" : "available to"} customers.`,
      );
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionBusy("");
    }
  }
  const modalOpen = Boolean(
    menuDraft || cashierDraft || tableDraft !== null || closing,
  );
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setMenuDraft(null);
        setCashierDraft(null);
        setTableDraft(null);
        setClosing(null);
      }
      if (event.key === "Tab") {
        const targets = focusable();
        const first = targets[0],
          last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modalOpen, busy]);
  const pending = tables.flatMap((t) =>
    t.orders
      .filter((o) => o.status === "pending")
      .map((o) => ({ ...o, table_number: t.table_number })),
  );
  pending.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const activeTotal = tables.reduce((n, t) => n + t.total_cents, 0);
  const current = tables.find((t) => t.id === selectedTable);
  const isAdmin = user?.role === "admin" && mode === "admin";
  function ticketLinks(order: Order) {
    return (
      <div className="ticket-links">
        <Printer size={14} />
        <a href={`/api/kot/${order.id}`} target="_blank" rel="noreferrer">
          All KOTs
        </a>
        {[...new Set(order.items.map((i) => i.printer))].map((p) => (
          <a
            key={p}
            href={`/api/kot/${order.id}?printer=${p}`}
            target="_blank"
            rel="noreferrer"
          >
            {p === "kitchen" ? "Kitchen" : "Cashier"} PDF
          </a>
        ))}
      </div>
    );
  }
  function orderCard(order: Order, tableNumber?: number) {
    return (
      <article className="ops-order" key={order.id}>
        <header>
          <div>
            {tableNumber && <strong>Table {tableNumber} · </strong>}
            <span>#{order.id.slice(0, 8).toUpperCase()}</span>
            <small>{time(order.created_at)}</small>
          </div>
          <span className={`ops-badge ${order.status}`}>{order.status}</span>
        </header>
        <div className="ops-order-items">
          {order.items.map((i) => (
            <div key={i.id}>
              <span>
                <strong>{i.quantity} ×</strong> {i.name}
                <small>
                  {i.printer === "kitchen" ? "Kitchen" : "Cashier"} printer
                </small>
              </span>
              <strong>{money(i.price_cents * i.quantity)}</strong>
            </div>
          ))}
        </div>
        {order.notes && (
          <p className="ops-notes">Customer notes: {order.notes}</p>
        )}
        <footer>
          <strong>
            {money(
              order.items.reduce((n, i) => n + i.price_cents * i.quantity, 0),
            )}
          </strong>
          {order.status === "pending" ? (
            <div className="ops-actions">
              <button
                className="ops-button secondary"
                disabled={!!actionBusy}
                onClick={() => processOrder(order, "reject")}
              >
                Reject
              </button>
              <button
                className="ops-button"
                disabled={!!actionBusy}
                onClick={() => processOrder(order, "accept")}
              >
                {actionBusy === order.id ? "Processing…" : "Accept & open KOT"}
              </button>
            </div>
          ) : order.status === "accepted" ? (
            ticketLinks(order)
          ) : null}
        </footer>
      </article>
    );
  }
  if (checking)
    return (
      <main id="main" className="ops-login">
        <p>Loading your workspace…</p>
      </main>
    );
  if (!user)
    return (
      <main id="main" className="ops-login">
        <Link href="/">← Restaurant website</Link>
        <div className="ops-login-card">
          <div className="ops-logo">
            <UtensilsCrossed size={24} />
            <span>CHENNAI PALACE</span>
          </div>
          <span className="eyebrow">
            {mode === "admin" ? "MANAGEMENT" : "FRONT OF HOUSE"}
          </span>
          <h1>{mode === "admin" ? "Admin sign in" : "Cashier sign in"}</h1>
          <p>
            {mode === "admin"
              ? "Manage your menu, stock and restaurant team."
              : "Your tables, incoming orders and kitchen tickets."}
          </p>
          {error && (
            <div className="ops-alert" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={login}>
            {mode === "cashier" && (
              <label className="ops-field">
                4 digit PIN
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  minLength={4}
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  autoComplete="username"
                  placeholder="0000"
                />
              </label>
            )}
            <label className="ops-field">
              {mode === "admin" ? "Super admin password" : "4 digit password"}
              <input
                type="password"
                required
                inputMode={mode === "cashier" ? "numeric" : undefined}
                pattern={mode === "cashier" ? "[0-9]{4}" : undefined}
                maxLength={mode === "cashier" ? 4 : 256}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="ops-button" disabled={busy}>
              {busy ? "Signing in…" : "Open workspace"}
            </button>
          </form>
          <Link
            href={mode === "admin" ? "/cashier" : "/admin"}
            className="ops-login-switch"
          >
            {mode === "admin" ? "Cashier sign in →" : "Super admin sign in →"}
          </Link>
        </div>
      </main>
    );
  return (
    <main id="main" className="ops-shell">
      <aside className="ops-sidebar">
        <Link href="/" className="ops-logo">
          <UtensilsCrossed size={25} />
          <span>
            CHENNAI
            <br />
            PALACE
          </span>
        </Link>
        <span className="ops-workspace">
          {isAdmin ? "Management workspace" : "Cashier workspace"}
        </span>
        <nav aria-label="Workspace">
          <button
            className={tab === "orders" ? "selected" : ""}
            onClick={() => {
              setTab("orders");
              setSelectedTable(null);
            }}
          >
            <LayoutDashboard size={19} />
            Orders & tables{pending.length > 0 && <span>{pending.length}</span>}
          </button>
          {isAdmin && (
            <>
              <button
                className={tab === "menu" ? "selected" : ""}
                onClick={() => setTab("menu")}
              >
                <UtensilsCrossed size={19} />
                Menu & stock
              </button>
              <button
                className={tab === "cashiers" ? "selected" : ""}
                onClick={() => setTab("cashiers")}
              >
                <Users size={19} />
                Cashier accounts
              </button>
              <button
                className={tab === "tables" ? "selected" : ""}
                onClick={() => setTab("tables")}
              >
                <Grid3X3 size={19} />
                Dining tables
              </button>
            </>
          )}
          <button
            className={tab === "history" ? "selected" : ""}
            onClick={() => setTab("history")}
          >
            <History size={19} />
            Closed sessions
          </button>
        </nav>
        <div className="ops-sidebar-bottom">
          <strong>{user.name}</strong>
          <span>{user.role === "admin" ? "Super admin" : "Cashier"}</span>
          <button onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
          <Link href="/order" target="_blank">
            Customer ordering ↗
          </Link>
        </div>
      </aside>
      <div className="ops-main">
        <header className="ops-topbar">
          <span>
            <span className={`ops-live-dot ${live ? "" : "reconnecting"}`} />{" "}
            {live
              ? "Live restaurant workspace"
              : "Connecting · automatic refresh enabled"}
          </span>
          <span>Chennai Palace · Adelaide</span>
        </header>
        <div className="ops-content">
          <div className="ops-page-heading">
            <div>
              <span className="eyebrow">
                {tab === "orders"
                  ? "SERVICE AT A GLANCE"
                  : tab === "menu"
                    ? "YOUR RESTAURANT MENU"
                    : tab === "cashiers"
                      ? "YOUR FRONT OF HOUSE TEAM"
                      : tab === "tables"
                        ? "YOUR DINING ROOM"
                        : "SERVICE RECORDS"}
              </span>
              <h1>
                {tab === "orders"
                  ? "Orders & tables"
                  : tab === "menu"
                    ? "Menu & stock"
                    : tab === "cashiers"
                      ? "Cashier accounts"
                      : tab === "tables"
                        ? "Dining tables"
                        : "Closed sessions"}
              </h1>
              <p>
                {tab === "orders"
                  ? "Accept incoming orders, prepare KOTs and keep every table in view."
                  : tab === "menu"
                    ? "Update dishes, availability and where each kitchen ticket goes."
                    : tab === "cashiers"
                      ? "Create cashier access with a four digit PIN and four digit password."
                      : tab === "tables"
                        ? "Choose which table numbers customers can order from."
                        : "Review the last 100 closed table sessions and their accepted orders."}
              </p>
            </div>
            {tab === "orders" ? (
              <button
                className="ops-button secondary"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            ) : tab === "menu" ? (
              <button
                className="ops-button"
                onClick={() => setMenuDraft({ ...newMenu })}
              >
                <Plus size={17} />
                Add dish
              </button>
            ) : tab === "cashiers" ? (
              <button
                className="ops-button"
                onClick={() => setCashierDraft({ ...newCashier })}
              >
                <Plus size={17} />
                Add cashier
              </button>
            ) : tab === "tables" ? (
              <button className="ops-button" onClick={() => setTableDraft("")}>
                <Plus size={17} />
                Add table
              </button>
            ) : null}
          </div>
          {error && (
            <div className="ops-alert" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="ops-notice" role="status">
              {notice}
              {lastKot && (
                <a href={lastKot} target="_blank" rel="noreferrer">
                  Open latest KOT ↗
                </a>
              )}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {tab === "orders" && (
            <>
              <div className="ops-stats">
                <div>
                  <ClipboardList />
                  <span>Awaiting acceptance</span>
                  <strong>{pending.length}</strong>
                </div>
                <div>
                  <Users />
                  <span>Open table sessions</span>
                  <strong>{tables.length}</strong>
                </div>
                <div>
                  <span>Accepted table totals</span>
                  <strong>{money(activeTotal)}</strong>
                  <small>Billing & payments handled externally</small>
                </div>
              </div>
              <div className="ops-service-grid">
                <section className="ops-panel">
                  <div className="ops-panel-heading">
                    <h2>
                      Incoming orders <span>{pending.length}</span>
                    </h2>
                    <small>
                      {live ? "Live updates" : "Reconnecting"}
                      {updated && ` · ${updated}`}
                    </small>
                  </div>
                  {pending.length ? (
                    pending.map((o) => orderCard(o, o.table_number))
                  ) : (
                    <div className="ops-empty">
                      <ClipboardList size={30} />
                      <h3>Ready for the next order</h3>
                      <p>New customer orders will appear here.</p>
                    </div>
                  )}
                </section>
                <section className="ops-panel">
                  <div className="ops-panel-heading">
                    <h2>Table sessions</h2>
                    <small>Select a table to see its orders</small>
                  </div>
                  {current ? (
                    <>
                      <button
                        className="ops-back"
                        onClick={() => setSelectedTable(null)}
                      >
                        ← All tables
                      </button>
                      <div className="ops-table-detail">
                        <div>
                          <h2>Table {current.table_number}</h2>
                          <p>Opened {time(current.opened_at)}</p>
                        </div>
                        <strong>{money(current.total_cents)}</strong>
                      </div>
                      <p className="ops-muted">
                        Accepted items only. Complete manual billing before
                        closing this session.
                      </p>
                      {current.orders.map((o) => orderCard(o))}
                      <button
                        className="ops-button secondary full"
                        disabled={current.orders.some(
                          (o) => o.status === "pending",
                        )}
                        onClick={() => setClosing(current)}
                      >
                        Close table session
                      </button>
                      {current.orders.some((o) => o.status === "pending") && (
                        <p className="ops-muted">
                          Resolve pending orders before closing.
                        </p>
                      )}
                    </>
                  ) : tables.length ? (
                    <div className="ops-table-grid">
                      {tables.map((t) => (
                        <button
                          className="ops-table"
                          key={t.id}
                          onClick={() => setSelectedTable(t.id)}
                        >
                          <span>TABLE</span>
                          <strong>{t.table_number}</strong>
                          <b>{money(t.total_cents)}</b>
                          <small>
                            {
                              t.orders.filter((o) => o.status === "accepted")
                                .length
                            }{" "}
                            accepted ·{" "}
                            {
                              t.orders.filter((o) => o.status === "pending")
                                .length
                            }{" "}
                            pending
                          </small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="ops-empty">
                      <Users size={30} />
                      <h3>No open tables</h3>
                      <p>A table session starts with its first order.</p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "menu" && (
            <section className="ops-panel">
              <div className="ops-menu-toolbar">
                <label className="ops-search">
                  <Search size={18} />
                  <input
                    aria-label="Search menu"
                    placeholder="Search dishes…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter category"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option>All categories</option>
                  {[...new Set(menu.map((i) => i.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <span>
                  {menu.length} dishes ·{" "}
                  {menu.filter((i) => i.active && i.stock !== 0).length}{" "}
                  available
                </span>
              </div>
              <div className="ops-table-scroll">
                <table className="ops-data-table">
                  <thead>
                    <tr>
                      <th>Dish</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>KOT destination</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {menu
                      .filter(
                        (i) =>
                          (filter === "All categories" ||
                            i.category === filter) &&
                          `${i.name} ${i.category}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((i) => (
                        <tr key={i.id}>
                          <td>
                            <strong>{i.name}</strong>
                            <small>{i.category}</small>
                          </td>
                          <td>{money(i.price_cents)}</td>
                          <td>
                            <span
                              className={i.stock === 0 ? "ops-stock-empty" : ""}
                            >
                              {i.stock === null ? "Unlimited" : i.stock}
                            </span>
                          </td>
                          <td>
                            <span className="ops-printer">
                              <Printer size={14} />
                              {i.printer === "kitchen"
                                ? "Kitchen"
                                : "Cashier table"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`ops-badge ${i.active && i.stock !== 0 ? "accepted" : ""}`}
                            >
                              {!i.active
                                ? "Hidden"
                                : i.stock === 0
                                  ? "Sold out"
                                  : "Available"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="ops-button secondary small"
                              onClick={() =>
                                setMenuDraft({
                                  id: i.id,
                                  version: i.version,
                                  name: i.name,
                                  category: i.category,
                                  description: i.description,
                                  price: (i.price_cents / 100).toFixed(2),
                                  stock:
                                    i.stock === null ? "" : String(i.stock),
                                  printer: i.printer,
                                  active: i.active,
                                })
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="ops-muted">
                Stock is deducted when the cashier accepts an order. Leave stock
                blank for unlimited availability. Existing orders retain their
                price and printer destination.
              </p>
            </section>
          )}
          {tab === "tables" && (
            <section className="ops-panel">
              <div className="ops-panel-heading">
                <h2>Configured tables</h2>
                <span>
                  {configuredTables.filter((table) => table.active).length}{" "}
                  available
                </span>
              </div>
              {configuredTables.length ? (
                <div className="ops-config-grid">
                  {configuredTables.map((table) => (
                    <article className="ops-config-table" key={table.number}>
                      <Grid3X3 size={20} />
                      <div>
                        <strong>Table {table.number}</strong>
                        <span>
                          {table.active
                            ? "Available for orders"
                            : "Hidden from customers"}
                        </span>
                      </div>
                      <button
                        className="ops-button secondary small"
                        disabled={Boolean(actionBusy)}
                        onClick={() => toggleTable(table)}
                      >
                        {actionBusy === `table-${table.number}`
                          ? "Saving…"
                          : table.active
                            ? "Hide"
                            : "Enable"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ops-empty">
                  <Grid3X3 size={30} />
                  <h3>Add your first table</h3>
                  <p>
                    Customers can order once at least one table is available.
                  </p>
                </div>
              )}
              <p className="ops-muted">
                Hiding a table stops new orders at that number. Existing orders
                and table history remain available.
              </p>
            </section>
          )}
          {tab === "cashiers" && (
            <section className="ops-panel">
              <div className="ops-panel-heading">
                <h2>Your cashier team</h2>
                <span>{cashiers.length} accounts</span>
              </div>
              {cashiers.length ? (
                <div className="ops-cashier-grid">
                  {cashiers.map((c) => (
                    <article key={c.id} className="ops-cashier-card">
                      <div className="ops-avatar">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <h3>{c.name}</h3>
                      <p>Login PIN · {c.pin}</p>
                      <span
                        className={`ops-badge ${c.active ? "accepted" : ""}`}
                      >
                        {c.active ? "Active" : "Disabled"}
                      </span>
                      <p className="ops-muted">
                        Receives orders, views tables and closes billed
                        sessions.
                      </p>
                      <button
                        className="ops-button secondary full"
                        onClick={() => setCashierDraft({ ...c, password: "" })}
                      >
                        Manage account
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ops-empty">
                  <Users size={30} />
                  <h3>Add your first cashier</h3>
                  <p>Create a PIN and password, then sign in at /cashier.</p>
                </div>
              )}
            </section>
          )}
          {tab === "history" && (
            <section className="ops-panel">
              {history.length ? (
                history.map((t) => (
                  <details className="ops-history" key={t.id}>
                    <summary>
                      <strong>Table {t.table_number}</strong>
                      <span>
                        {time(t.opened_at)} → {time(t.closed_at!)}
                      </span>
                      <b>{money(t.total_cents)}</b>
                    </summary>
                    <p className="ops-muted">
                      Session {t.id.slice(0, 8).toUpperCase()} · Payments
                      handled externally
                    </p>
                    {t.orders.map((o) => orderCard(o))}
                  </details>
                ))
              ) : (
                <div className="ops-empty">
                  <History size={30} />
                  <h3>No closed sessions yet</h3>
                  <p>Completed table sessions will appear here.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {tableDraft !== null && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-dialog"
          >
            <div className="ops-modal-heading">
              <h2 id="table-dialog">Add dining table</h2>
              <button
                aria-label="Close editor"
                disabled={busy}
                onClick={() => setTableDraft(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveTable}>
              <label className="ops-field">
                Table number
                <input
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  required
                  autoFocus
                  value={tableDraft}
                  onChange={(e) => setTableDraft(e.target.value)}
                />
              </label>
              {error && (
                <div role="alert" className="ops-alert">
                  {error}
                </div>
              )}
              <button className="ops-button full" disabled={busy}>
                {busy ? "Saving…" : "Add table"}
              </button>
            </form>
          </section>
        </div>
      )}
      {menuDraft && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-dialog"
          >
            <div className="ops-modal-heading">
              <h2 id="menu-dialog">
                {menuDraft.id ? "Edit dish" : "Add a dish"}
              </h2>
              <button
                aria-label="Close editor"
                disabled={busy}
                onClick={() => setMenuDraft(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveMenu}>
              <label className="ops-field">
                Dish name
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={menuDraft.name}
                  onChange={(e) =>
                    setMenuDraft({ ...menuDraft, name: e.target.value })
                  }
                />
              </label>
              <label className="ops-field">
                Category
                <input
                  required
                  list="menu-categories"
                  maxLength={80}
                  value={menuDraft.category}
                  onChange={(e) =>
                    setMenuDraft({ ...menuDraft, category: e.target.value })
                  }
                />
                <datalist id="menu-categories">
                  {[...new Set(menu.map((i) => i.category))].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="ops-field">
                Description
                <textarea
                  maxLength={500}
                  value={menuDraft.description}
                  onChange={(e) =>
                    setMenuDraft({ ...menuDraft, description: e.target.value })
                  }
                />
              </label>
              <div className="ops-form-row">
                <label className="ops-field">
                  Price (AUD)
                  <input
                    type="number"
                    required
                    min="0"
                    max="10000"
                    step="0.01"
                    value={menuDraft.price}
                    onChange={(e) =>
                      setMenuDraft({ ...menuDraft, price: e.target.value })
                    }
                  />
                </label>
                <label className="ops-field">
                  Stock <small>Blank = unlimited</small>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={menuDraft.stock}
                    onChange={(e) =>
                      setMenuDraft({ ...menuDraft, stock: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="ops-field">
                KOT printer destination
                <select
                  value={menuDraft.printer}
                  onChange={(e) =>
                    setMenuDraft({
                      ...menuDraft,
                      printer: e.target.value as "kitchen" | "cashier",
                    })
                  }
                >
                  <option value="kitchen">Kitchen printer</option>
                  <option value="cashier">Cashier table printer</option>
                </select>
              </label>
              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  checked={menuDraft.active}
                  onChange={(e) =>
                    setMenuDraft({ ...menuDraft, active: e.target.checked })
                  }
                />
                Show this dish on the customer menu
              </label>
              {error && (
                <div role="alert" className="ops-alert">
                  {error}
                </div>
              )}
              <button className="ops-button full" disabled={busy}>
                {busy ? "Saving…" : "Save dish"}
              </button>
            </form>
          </section>
        </div>
      )}
      {cashierDraft && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashier-dialog"
          >
            <div className="ops-modal-heading">
              <h2 id="cashier-dialog">
                {cashierDraft.id ? "Manage cashier" : "Add cashier"}
              </h2>
              <button
                aria-label="Close editor"
                disabled={busy}
                onClick={() => setCashierDraft(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveCashier}>
              <label className="ops-field">
                Cashier name
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={cashierDraft.name}
                  onChange={(e) =>
                    setCashierDraft({ ...cashierDraft, name: e.target.value })
                  }
                />
              </label>
              <label className="ops-field">
                4 digit login PIN
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  value={cashierDraft.pin}
                  onChange={(e) =>
                    setCashierDraft({
                      ...cashierDraft,
                      pin: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </label>
              <label className="ops-field">
                4 digit password
                {cashierDraft.id && (
                  <small>Leave blank to keep the current password</small>
                )}
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required={!cashierDraft.id}
                  autoComplete="new-password"
                  value={cashierDraft.password}
                  onChange={(e) =>
                    setCashierDraft({
                      ...cashierDraft,
                      password: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </label>
              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  checked={cashierDraft.active}
                  onChange={(e) =>
                    setCashierDraft({
                      ...cashierDraft,
                      active: e.target.checked,
                    })
                  }
                />
                Allow this cashier to sign in
              </label>
              {error && (
                <div role="alert" className="ops-alert">
                  {error}
                </div>
              )}
              <p className="ops-muted">
                Disabling an account or resetting its password signs it out
                immediately.
              </p>
              <button className="ops-button full" disabled={busy}>
                {busy ? "Saving…" : "Save cashier"}
              </button>
            </form>
          </section>
        </div>
      )}
      {closing && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-dialog"
          >
            <div className="ops-modal-heading">
              <h2 id="close-dialog">Close table {closing.table_number}?</h2>
              <button
                aria-label="Cancel closing"
                disabled={busy}
                onClick={() => setClosing(null)}
              >
                ×
              </button>
            </div>
            <p>
              Accepted order total:{" "}
              <strong>{money(closing.total_cents)}</strong>
            </p>
            <p className="ops-muted">
              Confirm that manual billing is complete before closing. This
              archives the session; the next order at this table starts a new
              session.
            </p>
            {error && (
              <div className="ops-alert" role="alert">
                {error}
              </div>
            )}
            <div className="ops-actions">
              <button
                className="ops-button secondary"
                disabled={busy}
                onClick={() => setClosing(null)}
              >
                Keep open
              </button>
              <button
                className="ops-button"
                disabled={busy}
                onClick={closeSession}
              >
                {busy ? "Closing…" : "Billing done · close session"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
