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
  QrCode,
  Copy,
  Check,
  Download,
  FileDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import QRCode from "qrcode";
import { api, send } from "@/lib/client-api";
import {
  money,
  type Staff,
  type MenuItem,
  type Cashier,
  type TableSession,
  type RestaurantTable,
  type Order,
  type PrinterSettings,
  type DetectedPrinter,
  type PaperSize,
} from "@/lib/types";
import {
  enqueueOrderPrint,
  subscribePrintStatus,
  type OrderPrintStatus,
  checkWindowsBridge,
} from "@/lib/client-print";
type Tab = "orders" | "menu" | "tables" | "cashiers" | "printers" | "history";
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
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrCopied, setQrCopied] = useState(false);
  const [printAllQrOpen, setPrintAllQrOpen] = useState(false);
  const [allQrDataUrls, setAllQrDataUrls] = useState<Record<number, string>>({});
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    kitchen_printer: "",
    kitchen_paper_size: "80mm",
    cashier_printer: "",
    cashier_paper_size: "80mm",
    bridge_host: "127.0.0.1",
  });
  const [detectedPrinters, setDetectedPrinters] = useState<DetectedPrinter[]>(
    [],
  );
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [printerPlatform, setPrinterPlatform] = useState("");
  const [bridgeHostDraft, setBridgeHostDraft] = useState("127.0.0.1");
  const [bridgeTesting, setBridgeTesting] = useState(false);
  const [bridgeTestMessage, setBridgeTestMessage] = useState("");
  const [kitchenPrinterDraft, setKitchenPrinterDraft] = useState("");
  const [kitchenPaperDraft, setKitchenPaperDraft] = useState<PaperSize>("80mm");
  const [cashierPrinterDraft, setCashierPrinterDraft] = useState("");
  const [cashierPaperDraft, setCashierPaperDraft] = useState<PaperSize>("80mm");
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [printStatuses, setPrintStatuses] = useState<
    Record<string, OrderPrintStatus>
  >({});
  const [autoPrint, setAutoPrint] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [downloadingSetup, setDownloadingSetup] = useState(false);
  const previousPendingCount = useRef<number | null>(null);
  const refreshing = useRef(false);
  const refreshAgain = useRef(false);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState("");

  // Persistent settings from localStorage
  useEffect(() => {
    try {
      const savedAutoPrint = localStorage.getItem("palace_auto_print");
      if (savedAutoPrint !== null) setAutoPrint(savedAutoPrint === "true");
      const savedSound = localStorage.getItem("palace_sound_enabled");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
    } catch {}
  }, []);

  const handleSetAutoPrint = (val: boolean) => {
    setAutoPrint(val);
    try {
      localStorage.setItem("palace_auto_print", String(val));
    } catch {}
  };

  const handleSetSoundEnabled = (val: boolean) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem("palace_sound_enabled", String(val));
    } catch {}
  };

  const playOrderChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.5, now + 0.15); // C6
      gain2.gain.setValueAtTime(0.28, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch {}
  }, [soundEnabled]);

  const downloadPrinterSetup = useCallback(
    (mode: "both" | "zip" | "bat" | "ps1" = "both") => {
      if (mode === "zip") {
        const a = document.createElement("a");
        a.href = "/api/admin/printers/download?file=chennai-palace-printer-bridge.zip";
        a.download = "chennai-palace-printer-bridge.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setNotice(
          "Downloaded chennai-palace-printer-bridge.zip. Extract and double-click windows-printer-bridge.bat.",
        );
        return;
      }

      if (mode === "bat") {
        const a = document.createElement("a");
        a.href = "/api/admin/printers/download?file=windows-printer-bridge.bat";
        a.download = "windows-printer-bridge.bat";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (mode === "ps1") {
        const a = document.createElement("a");
        a.href = "/api/admin/printers/download?file=windows-printer-bridge.ps1";
        a.download = "windows-printer-bridge.ps1";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // mode === "both": automatically triggers download of both .bat and .ps1 to the Windows device
      setDownloadingSetup(true);
      const aBat = document.createElement("a");
      aBat.href = "/api/admin/printers/download?file=windows-printer-bridge.bat";
      aBat.download = "windows-printer-bridge.bat";
      document.body.appendChild(aBat);
      aBat.click();
      document.body.removeChild(aBat);

      setTimeout(() => {
        const aPs1 = document.createElement("a");
        aPs1.href = "/api/admin/printers/download?file=windows-printer-bridge.ps1";
        aPs1.download = "windows-printer-bridge.ps1";
        document.body.appendChild(aPs1);
        aPs1.click();
        document.body.removeChild(aPs1);
        setDownloadingSetup(false);
        setNotice(
          "Downloaded windows-printer-bridge.bat and windows-printer-bridge.ps1. On your Windows PC, double-click windows-printer-bridge.bat to start.",
        );
      }, 350);
    },
    [],
  );
  useEffect(() => {
    const unsub = subscribePrintStatus(setPrintStatuses);
    void checkWindowsBridge(printerSettings.bridge_host).then((ok) => setBridgeConnected(ok));
    return unsub;
  }, [printerSettings.bridge_host]);
  useEffect(() => {
    if (qrTable && qrTable.qr_code) {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/order?table=${qrTable.number}&code=${qrTable.qr_code}`;
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
      })
        .then(setQrDataUrl)
        .catch(console.error);
    } else {
      setQrDataUrl("");
    }
  }, [qrTable]);
  useEffect(() => {
    if (!printAllQrOpen) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const map: Record<number, string> = {};
    Promise.all(
      configuredTables
        .filter((t) => t.active && t.qr_code)
        .map(async (t) => {
          const url = `${origin}/order?table=${t.number}&code=${t.qr_code}`;
          const dataUrl = await QRCode.toDataURL(url, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          });
          map[t.number] = dataUrl;
        }),
    )
      .then(() => setAllQrDataUrls(map))
      .catch(console.error);
  }, [printAllQrOpen, configuredTables]);
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
        const pendingCount = data.flatMap((t) =>
          t.orders.filter((o) => o.status === "pending"),
        ).length;
        if (
          previousPendingCount.current !== null &&
          pendingCount > previousPendingCount.current
        ) {
          playOrderChime();
        }
        previousPendingCount.current = pendingCount;
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
  }, [playOrderChime]);
  const loadAdmin = useCallback(async () => {
    const data = await api<{
      menu: MenuItem[];
      cashiers: Cashier[];
      tables: RestaurantTable[];
      printers?: PrinterSettings;
    }>("/api/admin");
    setMenu(data.menu);
    setCashiers(data.cashiers);
    setConfiguredTables(data.tables);
    if (data.printers) {
      setPrinterSettings(data.printers);
      setKitchenPrinterDraft(data.printers.kitchen_printer || "");
      setKitchenPaperDraft(data.printers.kitchen_paper_size || "80mm");
      setCashierPrinterDraft(data.printers.cashier_printer || "");
      setCashierPaperDraft(data.printers.cashier_paper_size || "80mm");
      setBridgeHostDraft(data.printers.bridge_host || "127.0.0.1");
    }
  }, []);
  function inferPaper(name: string): PaperSize {
    const lower = name.toLowerCase();
    if (
      lower.includes("58") ||
      lower.includes("2inch") ||
      lower.includes("2-inch") ||
      lower.includes("58mm")
    ) {
      return "58mm";
    }
    return "80mm";
  }
  function handlePrinterInputChange(
    val: string,
    target: "kitchen" | "cashier",
  ) {
    if (target === "kitchen") {
      setKitchenPrinterDraft(val);
      if (val) setKitchenPaperDraft(inferPaper(val));
    } else {
      setCashierPrinterDraft(val);
      if (val) setCashierPaperDraft(inferPaper(val));
    }
  }
  const detectPrinters = useCallback(
    async (customHost?: string) => {
      setScanningPrinters(true);
      setError("");
      let found: DetectedPrinter[] = [];
      let detectedSource = "";
      let bridgeOk = false;
      const targetHost =
        (customHost ?? bridgeHostDraft ?? printerSettings.bridge_host ?? "127.0.0.1").trim() ||
        "127.0.0.1";

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://${targetHost}:18080/printers`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const localPrinters = await res.json();
          if (Array.isArray(localPrinters) && localPrinters.length > 0) {
            found = localPrinters
              .map(
                (p: {
                  name?: string;
                  Name?: string;
                  default?: boolean;
                  is_default?: boolean;
                  port?: string;
                  PortName?: string;
                }) => ({
                  name: p.name || p.Name || "",
                  is_default: Boolean(p.is_default || p.default),
                  port: p.port || p.PortName,
                }),
              )
              .filter((p: DetectedPrinter) => p.name);
            bridgeOk = true;
            detectedSource = `Windows bridge (${targetHost})`;
          }
        }
      } catch {
        // Local bridge not running or timed out; continue to server API
      }

      setBridgeConnected(bridgeOk);

      try {
        const data = await api<{
          settings: PrinterSettings;
          system_printers: DetectedPrinter[];
          platform: string;
          source: string;
        }>(`/api/admin/printers?bridge_host=${encodeURIComponent(targetHost)}`);

        if (data.settings) {
          setPrinterSettings(data.settings);
          setKitchenPrinterDraft(
            (prev) => prev || data.settings.kitchen_printer || "",
          );
          setKitchenPaperDraft(
            (prev) => prev || data.settings.kitchen_paper_size || "80mm",
          );
          setCashierPrinterDraft(
            (prev) => prev || data.settings.cashier_printer || "",
          );
          setCashierPaperDraft(
            (prev) => prev || data.settings.cashier_paper_size || "80mm",
          );
          setBridgeHostDraft(
            (prev) => prev || data.settings.bridge_host || "127.0.0.1",
          );
        }

        setPrinterPlatform(data.platform);

        const map = new Map<string, DetectedPrinter>();
        for (const p of found) {
          if (p.name) map.set(p.name.toLowerCase(), p);
        }
        for (const p of data.system_printers || []) {
          if (p.name && !map.has(p.name.toLowerCase())) {
            map.set(p.name.toLowerCase(), p);
          }
        }
        const allDetected = Array.from(map.values());
        setDetectedPrinters(allDetected);

        if (allDetected.length > 0) {
          setNotice(
            `Discovered ${allDetected.length} printer${allDetected.length === 1 ? "" : "s"} (${detectedSource || data.source || "system"}). Assign them to Kitchen or Cashier below.`,
          );
        } else {
          if (data.platform === "darwin" && targetHost === "127.0.0.1") {
            setNotice(
              "Scan completed on this Mac. Since your printer is connected to Windows, enter your Windows PC's local IP address above and run windows-printer-bridge.bat on Windows.",
            );
          } else {
            setNotice(
              `Scan finished for host ${targetHost}. If printers are connected, ensure windows-printer-bridge.bat is running on Windows.`,
            );
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setScanningPrinters(false);
      }
    },
    [bridgeHostDraft, printerSettings.bridge_host],
  );

  async function testBridgeConnection() {
    setBridgeTesting(true);
    setBridgeTestMessage("");
    const targetHost =
      (bridgeHostDraft || printerSettings.bridge_host || "127.0.0.1").trim() ||
      "127.0.0.1";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`http://${targetHost}:18080/`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setBridgeConnected(true);
        setBridgeTestMessage(
          `✓ Connected! Windows Bridge is responding at http://${targetHost}:18080`,
        );
        void detectPrinters(targetHost);
      } else {
        setBridgeConnected(false);
        setBridgeTestMessage(
          `⚠️ Bridge responded with HTTP status ${res.status}`,
        );
      }
    } catch {
      setBridgeConnected(false);
      setBridgeTestMessage(
        `❌ Not reachable at http://${targetHost}:18080. Check that windows-printer-bridge.bat is running on Windows and both devices are on the same Wi-Fi.`,
      );
    } finally {
      setBridgeTesting(false);
    }
  }
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
        (tab === "menu" ||
          tab === "tables" ||
          tab === "cashiers" ||
          tab === "printers")
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
    if (tab === "printers") {
      loadAdmin()
        .then(() => {
          if (detectedPrinters.length === 0) void detectPrinters();
        })
        .catch((e) => setError(e.message));
    }
    if (tab === "history")
      api<TableSession[]>("/api/operations?history=1")
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [tab, user, loadAdmin, detectPrinters, detectedPrinters.length]);
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
    // When autoPrint is active, avoid popup tabs which browsers block during continuous orders.
    // The print engine sends jobs directly to Windows thermal printers or silent iframe queue.
    const openTab = !autoPrint && action === "accept";
    const pdf = openTab ? window.open("about:blank", "_blank") : null;
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
        if (pdf) {
          pdf.location.href = result.kot_url;
          setNotice("Order accepted. KOT PDF opened for printing.");
        } else {
          enqueueOrderPrint(order, printerSettings);
          setNotice(
            `Order #${order.id.slice(0, 8).toUpperCase()} accepted. KOT dispatched to printer queue.`,
          );
        }
      } else {
        setNotice("Order rejected. Stock and table total are unchanged.");
      }
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
  async function savePrinters(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const cleanBridgeHost = bridgeHostDraft.trim() || "127.0.0.1";
    try {
      await send("/api/admin", {
        kind: "printer",
        kitchen_printer: kitchenPrinterDraft,
        kitchen_paper_size: kitchenPaperDraft,
        cashier_printer: cashierPrinterDraft,
        cashier_paper_size: cashierPaperDraft,
        bridge_host: cleanBridgeHost,
      });
      setPrinterSettings({
        kitchen_printer: kitchenPrinterDraft,
        kitchen_paper_size: kitchenPaperDraft,
        cashier_printer: cashierPrinterDraft,
        cashier_paper_size: cashierPaperDraft,
        bridge_host: cleanBridgeHost,
      });
      setNotice(
        `Printer assignments saved! Kitchen: ${kitchenPrinterDraft || "(default)"} [${kitchenPaperDraft}], Cashier: ${cashierPrinterDraft || "(default)"} [${cashierPaperDraft}], Windows Host: ${cleanBridgeHost}.`,
      );
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function assignPrinter(name: string, target: "kitchen" | "cashier") {
    const paper = inferPaper(name);
    if (target === "kitchen") {
      setKitchenPrinterDraft(name);
      setKitchenPaperDraft(paper);
      setNotice(
        `Selected "${name}" (paper auto-adjusted to ${paper}) for Kitchen. Click "Save printer configuration" below to confirm.`,
      );
    } else {
      setCashierPrinterDraft(name);
      setCashierPaperDraft(paper);
      setNotice(
        `Selected "${name}" (paper auto-adjusted to ${paper}) for Cashier. Click "Save printer configuration" below to confirm.`,
      );
    }
  }
  async function clearPrinter(target: "kitchen" | "cashier") {
    setBusy(true);
    setError("");
    setNotice("");
    const newKitchen = target === "kitchen" ? "" : kitchenPrinterDraft;
    const newCashier = target === "cashier" ? "" : cashierPrinterDraft;
    try {
      await send("/api/admin", {
        kind: "printer",
        kitchen_printer: newKitchen,
        kitchen_paper_size: kitchenPaperDraft,
        cashier_printer: newCashier,
        cashier_paper_size: cashierPaperDraft,
      });
      if (target === "kitchen") setKitchenPrinterDraft("");
      if (target === "cashier") setCashierPrinterDraft("");
      setPrinterSettings((prev) => ({
        ...prev,
        kitchen_printer: newKitchen,
        cashier_printer: newCashier,
      }));
      setNotice(
        `${target === "kitchen" ? "Kitchen" : "Cashier"} printer unassigned.`,
      );
      await loadAdmin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
  const isKitchenConnected = Boolean(
    printerSettings.kitchen_printer &&
      detectedPrinters.some(
        (p) =>
          p.name.trim().toLowerCase() ===
          printerSettings.kitchen_printer.trim().toLowerCase(),
      ),
  );
  const isCashierConnected = Boolean(
    printerSettings.cashier_printer &&
      detectedPrinters.some(
        (p) =>
          p.name.trim().toLowerCase() ===
          printerSettings.cashier_printer.trim().toLowerCase(),
      ),
  );
  function ticketLinks(order: Order) {
    const status = printStatuses[order.id];
    const uniquePrinters = [...new Set(order.items.map((i) => i.printer))];

    return (
      <div
        className="ticket-links"
        style={{ flexWrap: "wrap", gap: "6px", alignItems: "center" }}
      >
        <Printer size={14} />
        <button
          type="button"
          className="ops-button secondary small"
          style={{ padding: "4px 8px", minHeight: "28px", fontSize: "11px" }}
          onClick={() => enqueueOrderPrint(order, printerSettings)}
          title="Print or reprint KOT for this order"
        >
          Reprint KOT
        </button>
        <a href={`/api/kot/${order.id}`} target="_blank" rel="noreferrer">
          All KOTs PDF
        </a>
        {uniquePrinters.map((p) => {
          const assigned =
            p === "kitchen"
              ? printerSettings.kitchen_printer
              : printerSettings.cashier_printer;
          const paper =
            p === "kitchen"
              ? printerSettings.kitchen_paper_size
              : printerSettings.cashier_paper_size;
          const pStatus = p === "kitchen" ? status?.kitchen : status?.cashier;

          return (
            <span
              key={p}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <a
                href={`/api/kot/${order.id}?printer=${p}`}
                target="_blank"
                rel="noreferrer"
              >
                {p === "kitchen" ? "Kitchen" : "Cashier"} PDF
                {assigned ? ` (${assigned} · ${paper})` : ` (${paper})`}
              </a>
              {pStatus && (
                <button
                  type="button"
                  className={`ops-badge ${
                    pStatus === "printed"
                      ? "accepted"
                      : pStatus === "printing"
                        ? "warning"
                        : pStatus === "failed"
                          ? "offline"
                          : ""
                  }`}
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    border: "none",
                    cursor: pStatus === "failed" ? "pointer" : "default",
                  }}
                  onClick={
                    pStatus === "failed"
                      ? () => enqueueOrderPrint(order, printerSettings, [p])
                      : undefined
                  }
                  title={
                    pStatus === "failed"
                      ? "Print failed. Click to retry."
                      : undefined
                  }
                >
                  {pStatus === "printed"
                    ? "Printed ✓"
                    : pStatus === "printing"
                      ? "Printing…"
                      : pStatus === "failed"
                        ? "Retry print ↻"
                        : "Queued"}
                </button>
              )}
            </span>
          );
        })}
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
                  {printerSettings?.[`${i.printer}_printer`]
                    ? ` · ${printerSettings[`${i.printer}_printer`]}`
                    : ""}
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
            Orders & tables<span>{pending.length}</span>
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
              <button
                className={tab === "printers" ? "selected" : ""}
                onClick={() => setTab("printers")}
              >
                <Printer size={19} />
                Printers
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
                        : tab === "printers"
                          ? "HARDWARE & PRINTING"
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
                        : tab === "printers"
                          ? "Printer configuration"
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
                        : tab === "printers"
                          ? "Assign your connected Windows thermal printers for kitchen tickets and cashier counter."
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
            ) : tab === "printers" ? (
              <button
                className="ops-button secondary"
                disabled={scanningPrinters}
                onClick={() => detectPrinters()}
              >
                <RefreshCw
                  size={16}
                  className={scanningPrinters ? "animate-spin" : ""}
                />
                {scanningPrinters
                  ? "Scanning Windows…"
                  : "Scan Windows printers"}
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
                <section className="ops-panel ops-incoming-panel">
                  <div
                    className="ops-panel-heading"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <h2>
                        Incoming orders{" "}
                        <span aria-live="polite" aria-atomic="true">
                          {pending.length}
                        </span>
                      </h2>
                      <small>
                        {live ? "Live updates" : "Reconnecting"}
                        {updated && ` · ${updated}`}
                        {bridgeConnected && " · ⚡ Thermal bridge connected"}
                      </small>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <label
                        className="ops-checkbox"
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                        title="Automatically print KOT to thermal printers when order is accepted"
                      >
                        <input
                          type="checkbox"
                          checked={autoPrint}
                          onChange={(e) => handleSetAutoPrint(e.target.checked)}
                        />
                        <span>Auto-print KOT on accept</span>
                      </label>
                      <label
                        className="ops-checkbox"
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                        title="Play chime sound when a new customer order arrives"
                      >
                        <input
                          type="checkbox"
                          checked={soundEnabled}
                          onChange={(e) =>
                            handleSetSoundEnabled(e.target.checked)
                          }
                        />
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {soundEnabled ? (
                            <Volume2 size={13} />
                          ) : (
                            <VolumeX size={13} />
                          )}
                          Chime
                        </span>
                      </label>
                    </div>
                  </div>
                  <div
                    className="ops-incoming-list"
                    role="region"
                    aria-label="Incoming order queue"
                    tabIndex={0}
                  >
                    {pending.length ? (
                      pending.map((o) => orderCard(o, o.table_number))
                    ) : (
                      <div className="ops-empty">
                        <ClipboardList size={30} />
                        <h3>Ready for the next order</h3>
                        <p>New customer orders will appear here.</p>
                      </div>
                    )}
                  </div>
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
                <div>
                  <h2>Configured tables</h2>
                  <p
                    className="ops-muted"
                    style={{ margin: "2px 0 0", fontSize: "12px" }}
                  >
                    Each table has a dedicated, secure QR code required for
                    customers to place orders.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <span>
                    {configuredTables.filter((table) => table.active).length}{" "}
                    available
                  </span>
                  {configuredTables.some((t) => t.active) && (
                    <button
                      type="button"
                      className="ops-button secondary small"
                      onClick={() => setPrintAllQrOpen(true)}
                    >
                      <QrCode size={14} /> Print all QR stands
                    </button>
                  )}
                </div>
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
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="ops-button secondary small"
                          onClick={() => setQrTable(table)}
                          title="Generate & View Table QR Code"
                        >
                          <QrCode size={13} /> QR Code
                        </button>
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
                      </div>
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
          {tab === "printers" && (
            <div className="ops-printer-workspace">
              <div className="ops-stats ops-printer-stats">
                <div>
                  <Printer size={22} />
                  <span>Assigned kitchen printer</span>
                  <strong>
                    {printerSettings.kitchen_printer || "Not assigned"}
                  </strong>
                  <div className="ops-printer-stat-actions">
                    {!printerSettings.kitchen_printer ? (
                      <span className="ops-badge">Not configured</span>
                    ) : isKitchenConnected ? (
                      <span className="ops-badge accepted">
                        {printerSettings.kitchen_paper_size} · Connected
                      </span>
                    ) : (
                      <span className="ops-badge offline">
                        {printerSettings.kitchen_paper_size} · Offline / Not detected
                      </span>
                    )}
                    <div style={{ display: "flex", gap: "6px" }}>
                      {printerSettings.kitchen_printer && (
                        <button
                          type="button"
                          className="ops-button secondary small"
                          onClick={() => clearPrinter("kitchen")}
                          title="Clear this assignment"
                        >
                          Clear
                        </button>
                      )}
                      <a
                        href="/api/admin/printers/test?destination=kitchen"
                        target="_blank"
                        rel="noreferrer"
                        className="ops-button secondary small"
                      >
                        Test slip ↗
                      </a>
                    </div>
                  </div>
                </div>
                <div>
                  <Printer size={22} />
                  <span>Assigned cashier printer</span>
                  <strong>
                    {printerSettings.cashier_printer || "Not assigned"}
                  </strong>
                  <div className="ops-printer-stat-actions">
                    {!printerSettings.cashier_printer ? (
                      <span className="ops-badge">Not configured</span>
                    ) : isCashierConnected ? (
                      <span className="ops-badge accepted">
                        {printerSettings.cashier_paper_size} · Connected
                      </span>
                    ) : (
                      <span className="ops-badge offline">
                        {printerSettings.cashier_paper_size} · Offline / Not detected
                      </span>
                    )}
                    <div style={{ display: "flex", gap: "6px" }}>
                      {printerSettings.cashier_printer && (
                        <button
                          type="button"
                          className="ops-button secondary small"
                          onClick={() => clearPrinter("cashier")}
                          title="Clear this assignment"
                        >
                          Clear
                        </button>
                      )}
                      <a
                        href="/api/admin/printers/test?destination=cashier"
                        target="_blank"
                        rel="noreferrer"
                        className="ops-button secondary small"
                      >
                        Test slip ↗
                      </a>
                    </div>
                  </div>
                </div>
                <div>
                  <LayoutDashboard size={22} />
                  <span>Windows hardware detection</span>
                  <strong>
                    {detectedPrinters.length} printer
                    {detectedPrinters.length === 1 ? "" : "s"}
                  </strong>
                  <div className="ops-printer-stat-actions">
                    <span className="ops-badge">
                      {bridgeConnected
                        ? "Windows bridge active"
                        : printerPlatform === "win32"
                          ? "Windows native"
                          : "System scanner"}
                    </span>
                    <button
                      className="ops-button secondary small"
                      disabled={scanningPrinters}
                      onClick={() => detectPrinters()}
                    >
                      <RefreshCw
                        size={13}
                        className={scanningPrinters ? "animate-spin" : ""}
                      />
                      {scanningPrinters ? "Scanning…" : "Scan"}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="ops-panel"
                style={{
                  marginBottom: "20px",
                  background:
                    "linear-gradient(135deg, rgba(75, 27, 65, 0.04) 0%, rgba(200, 143, 74, 0.08) 100%)",
                  borderColor: "rgba(75, 27, 65, 0.16)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "18px 22px",
                }}
              >
                <div style={{ maxWidth: "620px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "6px",
                    }}
                  >
                    <Download size={20} style={{ color: "var(--plum)" }} />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--plum)",
                      }}
                    >
                      Windows Thermal Printer Bridge Setup
                    </h3>
                    <span
                      className="ops-badge"
                      style={{
                        background: bridgeConnected ? "#16a34a" : "#f59e0b",
                        color: "#fff",
                      }}
                    >
                      {bridgeConnected
                        ? "Bridge Active on Port 18080"
                        : "Ready to Download"}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    Connect both thermal printers (Kitchen &amp; Cashier) to your
                    Windows POS computer. Download the setup files, run{" "}
                    <code>windows-printer-bridge.bat</code>, and your printers will
                    instantly be detected for continuous thermal printing.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="ops-button"
                    disabled={downloadingSetup}
                    onClick={() => downloadPrinterSetup("both")}
                    title="Automatically downloads windows-printer-bridge.bat and windows-printer-bridge.ps1 to this PC"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Download size={15} />
                    {downloadingSetup
                      ? "Downloading files…"
                      : "Download printer setup (.bat & .ps1)"}
                  </button>
                  <button
                    type="button"
                    className="ops-button secondary"
                    onClick={() => downloadPrinterSetup("zip")}
                    title="Download both scripts and instructions as a single .zip archive"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FileDown size={14} />
                    Download .ZIP package
                  </button>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      fontSize: "11px",
                      color: "var(--muted)",
                      marginLeft: "4px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => downloadPrinterSetup("bat")}
                      style={{
                        background: "none",
                        border: "none",
                        textDecoration: "underline",
                        cursor: "pointer",
                        color: "inherit",
                        padding: 0,
                        fontSize: "inherit",
                      }}
                    >
                      .bat only
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => downloadPrinterSetup("ps1")}
                      style={{
                        background: "none",
                        border: "none",
                        textDecoration: "underline",
                        cursor: "pointer",
                        color: "inherit",
                        padding: 0,
                        fontSize: "inherit",
                      }}
                    >
                      .ps1 only
                    </button>
                  </div>
                </div>
              </div>

              <div className="ops-service-grid">
                <section className="ops-panel">
                  <div className="ops-panel-heading">
                    <h2>Assign system printers</h2>
                    <span>2 printers on same Windows PC</span>
                  </div>
                  <p className="ops-muted">
                    Assign which printer handles kitchen tickets (KOT) and which
                    printer handles cashier counter receipts. Paper widths
                    automatically adjust ticket typography and margins.
                  </p>

                  {printerPlatform === "darwin" && (
                    <div
                      className="ops-alert"
                      style={{
                        marginBottom: "16px",
                        background: "rgba(245, 158, 11, 0.08)",
                        borderColor: "rgba(245, 158, 11, 0.4)",
                        color: "#92400e",
                      }}
                      role="note"
                    >
                      <span>
                        🍎 <strong>Accessing from Mac:</strong> You are viewing this
                        console on a Mac, but your thermal printers are connected to
                        your Windows PC.
                        <br />
                        • On the Windows PC, run <code>windows-printer-bridge.bat</code>{" "}
                        (in the <code>scripts</code> folder).
                        <br />
                        • Enter the Windows PC&apos;s IP address shown on that screen
                        into &ldquo;Windows PC IP&rdquo; below.
                        <br />• Or open this page directly in Google Chrome / Edge on
                        that Windows PC.
                      </span>
                    </div>
                  )}

                  <form onSubmit={savePrinters} className="ops-printer-form">
                    <div className="ops-form-row">
                      <label className="ops-field">
                        <span>
                          Kitchen printer
                          <small>Food dishes (Dosas, curries, etc.)</small>
                        </span>
                        <input
                          list="available-printers"
                          placeholder="e.g. POS-80 Kitchen or EPSON TM-T88"
                          value={kitchenPrinterDraft}
                          onChange={(e) =>
                            handlePrinterInputChange(e.target.value, "kitchen")
                          }
                          maxLength={120}
                        />
                      </label>

                      <label className="ops-field">
                        <span>
                          Kitchen paper size
                          <small>Auto-adjusts width & margins</small>
                        </span>
                        <select
                          value={kitchenPaperDraft}
                          onChange={(e) =>
                            setKitchenPaperDraft(e.target.value as PaperSize)
                          }
                        >
                          <option value="80mm">
                            80mm — Standard Thermal Roll (3-inch width)
                          </option>
                          <option value="58mm">
                            58mm — Compact Thermal Roll (2-inch width)
                          </option>
                        </select>
                      </label>
                    </div>

                    <div className="ops-form-row">
                      <label className="ops-field">
                        <span>
                          Cashier printer
                          <small>Drinks, desserts & front counter</small>
                        </span>
                        <input
                          list="available-printers"
                          placeholder="e.g. POS-80 Cashier or POS-58"
                          value={cashierPrinterDraft}
                          onChange={(e) =>
                            handlePrinterInputChange(e.target.value, "cashier")
                          }
                          maxLength={120}
                        />
                      </label>

                      <label className="ops-field">
                        <span>
                          Cashier paper size
                          <small>Auto-adjusts width & margins</small>
                        </span>
                        <select
                          value={cashierPaperDraft}
                          onChange={(e) =>
                            setCashierPaperDraft(e.target.value as PaperSize)
                          }
                        >
                          <option value="80mm">
                            80mm — Standard Thermal Roll (3-inch width)
                          </option>
                          <option value="58mm">
                            58mm — Compact Thermal Roll (2-inch width)
                          </option>
                        </select>
                      </label>
                    </div>

                    <div className="ops-form-row">
                      <label className="ops-field" style={{ gridColumn: "1 / -1" }}>
                        <span>
                          Windows PC IP / Hostname
                          <small>
                            IP address of the Windows machine with the printers connected (e.g. 192.168.1.xxx or 127.0.0.1)
                          </small>
                        </span>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            placeholder="127.0.0.1 or 192.168.1.xxx"
                            value={bridgeHostDraft}
                            onChange={(e) => setBridgeHostDraft(e.target.value)}
                            maxLength={120}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="ops-button secondary small"
                            disabled={bridgeTesting}
                            onClick={testBridgeConnection}
                          >
                            {bridgeTesting ? "Testing…" : "Test connection"}
                          </button>
                        </div>
                        {bridgeTestMessage && (
                          <small
                            style={{
                              marginTop: "4px",
                              display: "block",
                              color: bridgeTestMessage.startsWith("✓")
                                ? "#16a34a"
                                : bridgeTestMessage.startsWith("❌")
                                  ? "#dc2626"
                                  : "inherit",
                              fontWeight: 500,
                            }}
                          >
                            {bridgeTestMessage}
                          </small>
                        )}
                      </label>
                    </div>

                    <datalist id="available-printers">
                      {detectedPrinters.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.port ? `(${p.port})` : ""}
                        </option>
                      ))}
                    </datalist>

                    <div className="ops-actions" style={{ marginTop: "18px" }}>
                      <button className="ops-button" disabled={busy}>
                        {busy ? "Saving…" : "Save printer configuration"}
                      </button>
                      {(kitchenPrinterDraft ||
                        cashierPrinterDraft ||
                        printerSettings.kitchen_printer ||
                        printerSettings.cashier_printer) && (
                        <button
                          type="button"
                          className="ops-button secondary"
                          disabled={busy}
                          onClick={() => {
                            void clearPrinter("kitchen");
                            void clearPrinter("cashier");
                          }}
                        >
                          Clear all assignments
                        </button>
                      )}
                    </div>
                  </form>

                  {((printerSettings.kitchen_printer && !isKitchenConnected) ||
                    (printerSettings.cashier_printer && !isCashierConnected)) && (
                    <div
                      className="ops-alert"
                      style={{ marginTop: "16px", fontSize: "11px" }}
                      role="alert"
                    >
                      <span>
                        ⚠️ <strong>Hardware notice:</strong> The assigned printer
                        name(s) are not currently detected on this machine. Plug
                        your thermal printers in via USB or run the Windows
                        helper script below to detect them.
                      </span>
                    </div>
                  )}

                  <div className="ops-printer-help-box">
                    <h3>How ticket routing & paper sizing work</h3>
                    <p>
                      In <strong>Menu &amp; stock</strong>, each dish is assigned
                      either <em>Kitchen printer</em> or{" "}
                      <em>Cashier table printer</em>. When an order is accepted,
                      Chennai Palace formats the KOT PDF to the exact roll width:
                      80mm uses full-width columns, while 58mm compact rolls
                      automatically scale down typography and margins to prevent
                      line wrapping issues.
                    </p>
                  </div>
                </section>

                <section className="ops-panel">
                  <div className="ops-panel-heading">
                    <h2>Available Windows printers</h2>
                    <span>{detectedPrinters.length} detected</span>
                  </div>

                  {detectedPrinters.length ? (
                    <div className="ops-detected-list">
                      {detectedPrinters.map((p) => {
                        const isKitchen =
                          kitchenPrinterDraft.toLowerCase() ===
                          p.name.toLowerCase();
                        const isCashier =
                          cashierPrinterDraft.toLowerCase() ===
                          p.name.toLowerCase();
                        return (
                          <article key={p.name} className="ops-detected-item">
                            <div className="ops-detected-info">
                              <div className="ops-detected-title">
                                <Printer size={16} />
                                <strong>{p.name}</strong>
                                {p.is_default && (
                                  <span className="ops-badge">Default</span>
                                )}
                              </div>
                              {p.port && <small>Port: {p.port}</small>}
                              {(isKitchen || isCashier) && (
                                <div className="ops-detected-tags">
                                  {isKitchen && (
                                    <span className="ops-badge accepted">
                                      Assigned to Kitchen
                                    </span>
                                  )}
                                  {isCashier && (
                                    <span className="ops-badge accepted">
                                      Assigned to Cashier
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="ops-detected-actions">
                              <button
                                type="button"
                                className={`ops-button small ${isKitchen ? "" : "secondary"}`}
                                onClick={() => assignPrinter(p.name, "kitchen")}
                              >
                                {isKitchen ? "✓ Kitchen" : "Set Kitchen"}
                              </button>
                              <button
                                type="button"
                                className={`ops-button small ${isCashier ? "" : "secondary"}`}
                                onClick={() => assignPrinter(p.name, "cashier")}
                              >
                                {isCashier ? "✓ Cashier" : "Set Cashier"}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ops-empty">
                      <Printer size={30} />
                      <h3>No printers detected yet</h3>
                      <p>
                        Plug both printers into your Windows machine via USB or
                        network, then click{" "}
                        <strong>Scan Windows printers</strong> above.
                      </p>
                      <button
                        className="ops-button secondary"
                        disabled={scanningPrinters}
                        onClick={() => detectPrinters()}
                      >
                        <RefreshCw
                          size={15}
                          className={scanningPrinters ? "animate-spin" : ""}
                        />
                        {scanningPrinters
                          ? "Scanning…"
                          : "Scan Windows printers now"}
                      </button>
                    </div>
                  )}

                  <div className="ops-printer-guide">
                    <h4>Windows POS terminal setup</h4>
                    <ul>
                      <li>
                        Both thermal receipt printers (Kitchen &amp; Cashier) connect
                        via USB or Ethernet to the Windows machine.
                      </li>
                      <li>
                        In Windows, check{" "}
                        <strong>
                          Settings &gt; Bluetooth &amp; Devices &gt; Printers
                          &amp; Scanners
                        </strong>{" "}
                        to see your printer names.
                      </li>
                      <li>
                        <strong>To scan &amp; print from this Mac or an iPad:</strong>{" "}
                        Run <code>windows-printer-bridge.bat</code> on the
                        Windows machine (right-click &quot;Run as administrator&quot;
                        to enable Wi-Fi access), enter its local IP address above,
                        and click <strong>Scan Windows printers</strong>.
                      </li>
                      <li>
                        <strong>To scan &amp; print directly on Windows:</strong>{" "}
                        Open Google Chrome or Microsoft Edge on that Windows PC,
                        visit Chennai Palace, run <code>windows-printer-bridge.bat</code>,
                        and leave IP as <code>127.0.0.1</code>.
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
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
      {qrTable && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-table-dialog"
            style={{ maxWidth: "480px", textAlign: "center" }}
          >
            <div className="ops-modal-heading">
              <h2 id="qr-table-dialog">Table {qrTable.number} QR Stand</h2>
              <button
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => {
                  setQrTable(null);
                  setQrCopied(false);
                }}
              >
                ×
              </button>
            </div>

            <div
              className="ops-qr-stand-preview"
              style={{
                background: "#fffdf9",
                border: "2px solid #eadbd2",
                borderRadius: "16px",
                padding: "24px 20px",
                margin: "10px 0 20px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <span className="eyebrow" style={{ letterSpacing: "2px" }}>
                CHENNAI PALACE · DINE IN
              </span>
              <h3
                style={{
                  fontSize: "32px",
                  margin: "6px 0 16px",
                  color: "var(--purple)",
                  fontFamily: "var(--serif, serif)",
                }}
              >
                TABLE {qrTable.number}
              </h3>

              {qrDataUrl ? (
                <div
                  style={{
                    background: "white",
                    padding: "12px",
                    borderRadius: "12px",
                    display: "inline-block",
                    border: "1px solid #eee",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code for Table ${qrTable.number}`}
                    style={{
                      width: "220px",
                      height: "220px",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: "220px",
                    height: "220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                  }}
                >
                  <RefreshCw className="animate-spin" size={24} />
                </div>
              )}

              <p
                style={{
                  fontSize: "13px",
                  color: "#666",
                  margin: "14px auto 0",
                  maxWidth: "280px",
                  lineHeight: "1.4",
                }}
              >
                Point your phone camera to browse our menu and order directly to
                Table {qrTable.number}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input
                readOnly
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/order?table=${qrTable.number}&code=${qrTable.qr_code}`
                    : ""
                }
                style={{
                  fontSize: "12px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  flex: 1,
                  background: "#f9f9f9",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                className="ops-button secondary small"
                onClick={() => {
                  const url = `${window.location.origin}/order?table=${qrTable.number}&code=${qrTable.qr_code}`;
                  navigator.clipboard.writeText(url);
                  setQrCopied(true);
                  setTimeout(() => setQrCopied(false), 2000);
                }}
              >
                {qrCopied ? <Check size={14} /> : <Copy size={14} />}
                {qrCopied ? "Copied" : "Copy link"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="ops-button"
                onClick={() => {
                  const printWin = window.open("", "_blank");
                  if (!printWin) return;
                  printWin.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Table ${qrTable.number} QR Stand - Chennai Palace</title>
                        <style>
                          @page { size: auto; margin: 20mm; }
                          body {
                            font-family: system-ui, -apple-system, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 90vh;
                            margin: 0;
                            background: white;
                          }
                          .card {
                            border: 3px solid #8e1c3e;
                            border-radius: 20px;
                            padding: 40px;
                            text-align: center;
                            max-width: 360px;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                          }
                          .eyebrow {
                            font-size: 13px;
                            letter-spacing: 3px;
                            color: #8e1c3e;
                            font-weight: 700;
                            text-transform: uppercase;
                          }
                          h1 {
                            font-size: 42px;
                            color: #8e1c3e;
                            margin: 10px 0 20px;
                            font-family: Georgia, serif;
                          }
                          img {
                            width: 250px;
                            height: 250px;
                            margin: 0 auto;
                            display: block;
                          }
                          p {
                            font-size: 15px;
                            color: #444;
                            margin: 20px 0 0;
                            line-height: 1.5;
                          }
                          .brand {
                            margin-top: 25px;
                            font-size: 12px;
                            color: #888;
                            border-top: 1px dashed #ddd;
                            padding-top: 15px;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="card">
                          <div class="eyebrow">Chennai Palace · Dine In</div>
                          <h1>TABLE ${qrTable.number}</h1>
                          <img src="${qrDataUrl}" alt="Table ${qrTable.number} QR Code" />
                          <p>Scan with your phone camera to view menu & order directly to your table.</p>
                          <div class="brand">Holden Hill, Adelaide · chennaipalace.com.au</div>
                        </div>
                        <script>
                          window.onload = function() { window.print(); };
                        </script>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                }}
              >
                <Printer size={15} /> Print table stand
              </button>

              <button
                type="button"
                className="ops-button secondary"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      `Regenerate QR code for Table ${qrTable.number}? Any previously printed QR code for this table will stop working immediately.`,
                    )
                  ) {
                    return;
                  }
                  setBusy(true);
                  try {
                    const res = await send<{
                      ok: boolean;
                      number: number;
                      qr_code: string;
                    }>("/api/admin", {
                      kind: "regenerate_table_qr",
                      number: qrTable.number,
                    });
                    setQrTable({ ...qrTable, qr_code: res.qr_code });
                    setNotice(`Regenerated QR code for Table ${qrTable.number}!`);
                    await loadAdmin();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Regenerate code
              </button>
            </div>
          </section>
        </div>
      )}

      {printAllQrOpen && (
        <div className="ops-modal-overlay">
          <section
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-all-dialog"
            style={{ maxWidth: "780px" }}
          >
            <div className="ops-modal-heading">
              <h2 id="print-all-dialog">Print All Active Table QR Stands</h2>
              <button onClick={() => setPrintAllQrOpen(false)}>×</button>
            </div>
            <p className="ops-muted">
              Ready to print table stands for all{" "}
              {configuredTables.filter((t) => t.active).length} active tables.
              Each table has its own unique, secured QR code.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "16px",
                maxHeight: "440px",
                overflowY: "auto",
                padding: "16px",
                background: "#fdfbf7",
                borderRadius: "10px",
                border: "1px solid #eadbd2",
                margin: "14px 0",
              }}
            >
              {configuredTables
                .filter((t) => t.active)
                .map((table) => (
                  <div
                    key={table.number}
                    style={{
                      background: "white",
                      border: "2px solid #8e1c3e",
                      borderRadius: "12px",
                      padding: "16px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        letterSpacing: "1px",
                        fontWeight: 700,
                        color: "#8e1c3e",
                      }}
                    >
                      CHENNAI PALACE
                    </span>
                    <h4
                      style={{
                        fontSize: "20px",
                        margin: "4px 0 8px",
                        color: "#8e1c3e",
                      }}
                    >
                      TABLE {table.number}
                    </h4>
                    {allQrDataUrls[table.number] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={allQrDataUrls[table.number]}
                        alt={`Table ${table.number}`}
                        style={{
                          width: "130px",
                          height: "130px",
                          margin: "0 auto",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "130px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <RefreshCw className="animate-spin" size={16} />
                      </div>
                    )}
                    <p
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        margin: "8px 0 0",
                      }}
                    >
                      Scan to order directly
                    </p>
                  </div>
                ))}
            </div>

            <div className="ops-actions">
              <button
                type="button"
                className="ops-button"
                onClick={() => {
                  const printWin = window.open("", "_blank");
                  if (!printWin) return;
                  const cardsHtml = configuredTables
                    .filter((t) => t.active)
                    .map(
                      (table) => `
                        <div class="card">
                          <div class="eyebrow">Chennai Palace · Dine In</div>
                          <h1>TABLE ${table.number}</h1>
                          <img src="${allQrDataUrls[table.number] || ""}" alt="Table ${table.number} QR" />
                          <p>Scan with your phone camera to view menu & order directly to your table.</p>
                          <div class="brand">Holden Hill, Adelaide</div>
                        </div>
                      `,
                    )
                    .join("");

                  printWin.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>All Table QR Stands - Chennai Palace</title>
                        <style>
                          @page { size: auto; margin: 15mm; }
                          body {
                            font-family: system-ui, -apple-system, sans-serif;
                            margin: 0;
                            background: white;
                          }
                          .grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 25px;
                          }
                          .card {
                            border: 2px solid #8e1c3e;
                            border-radius: 16px;
                            padding: 24px 20px;
                            text-align: center;
                            page-break-inside: avoid;
                          }
                          .eyebrow {
                            font-size: 11px;
                            letter-spacing: 2px;
                            color: #8e1c3e;
                            font-weight: 700;
                            text-transform: uppercase;
                          }
                          h1 {
                            font-size: 32px;
                            color: #8e1c3e;
                            margin: 6px 0 14px;
                            font-family: Georgia, serif;
                          }
                          img {
                            width: 170px;
                            height: 170px;
                            margin: 0 auto;
                            display: block;
                          }
                          p {
                            font-size: 12px;
                            color: #555;
                            margin: 12px 0 0;
                            line-height: 1.4;
                          }
                          .brand {
                            margin-top: 14px;
                            font-size: 10px;
                            color: #888;
                            border-top: 1px dashed #eee;
                            padding-top: 8px;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="grid">
                          ${cardsHtml}
                        </div>
                        <script>
                          window.onload = function() { window.print(); };
                        </script>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                }}
              >
                <Printer size={15} /> Print All QR Stands
              </button>
              <button
                type="button"
                className="ops-button secondary"
                onClick={() => setPrintAllQrOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
