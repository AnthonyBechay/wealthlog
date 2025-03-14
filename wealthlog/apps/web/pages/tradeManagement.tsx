import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, setAccessToken } from "@wealthlog/common";

// ---------- INTERFACES ----------
interface FxTrade {
  id?: number;
  entryPrice?: number;
  exitPrice?: number;
  lots?: number;
  pipsGain?: number;
}

interface Trade {
  id: number;
  instrument: string;
  tradeType: "FX";
  tradeDirection: "LONG" | "SHORT";
  fees: number;
  entryDate: string; // ISO
  exitDate?: string;
  amount?: number;
  pattern?: string;
  notes?: string;
  percentage?: number;
  fxTrade?: FxTrade;
}

interface FinancialAccount {
  id: number;
  name: string;
  accountType: string;
  balance: number;
  currency: string;
}

// ---------- COMPONENT ----------
export default function TradeManagement() {
  const router = useRouter();

  const [fxAccounts, setFxAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [newAccountName, setNewAccountName] = useState("");
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);

  // New trade form
  const [newTrade, setNewTrade] = useState({
    instrument: "",
    percentage: 0,
    amount: 0,
    fees: 0,
    dateTime: new Date().toISOString(),
    pattern: "",
    direction: "Long" as "Long" | "Short",
    entryPrice: 0,
    exitPrice: 0,
    lots: 1,
    pipsGain: 0,
  });

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  // On mount, check login & load data
  useEffect(() => {
    checkLoginAndLoad();
  }, []);

  async function checkLoginAndLoad() {
    try {
      // The api instance automatically attaches the Bearer token.
      await api.get("/auth/me");
      await loadFxAccounts();
      await fetchSettings();
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  // Load FX accounts
  const loadFxAccounts = async () => {
    try {
      const res = await api.get<FinancialAccount[]>("/financial-accounts");
      const allAccts = res.data;
      const fx = allAccts.filter(
        (a) => a.accountType === "FX" || a.accountType === "FX_COMMODITY"
      );
      setFxAccounts(fx);

      if (fx.length === 1) {
        setSelectedAccountId(fx[0].id);
        await loadTradesForAccount(fx[0].id);
      }
    } catch (err) {
      console.error("Failed to load FX accounts:", err);
      setError("Failed to load FX accounts.");
    }
  };

  // Create new FX account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/financial-accounts", {
        name: newAccountName,
        accountType: "FX_COMMODITY",
      });
      setNewAccountName("");
      setShowAddAccountForm(false);
      await loadFxAccounts();
    } catch (err) {
      console.error("Failed to create FX account:", err);
      setError("Failed to create FX account.");
    }
  };

  // Load trades for selected account
  const loadTradesForAccount = async (accountId: number) => {
    try {
      const res = await api.get<Trade[]>(`/trades?accountId=${accountId}`);
      setTrades(res.data);
    } catch (err) {
      console.error("Failed to load trades:", err);
      setError("Failed to load trades.");
    }
  };

  // Fetch user settings
  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      setInstruments(res.data.instruments || []);
      setPatterns(res.data.patterns || []);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  // Handle account selection
  const handleSelectAccount = async (acctId: number) => {
    setSelectedAccountId(acctId);
    setLoading(true);
    await loadTradesForAccount(acctId);
    setLoading(false);
  };

  // Add a new FX trade
  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setError("No FX account selected.");
      return;
    }
    try {
      const body = {
        instrument: newTrade.instrument,
        amount: Number(newTrade.amount),
        fees: Number(newTrade.fees),
        dateTime: newTrade.dateTime,
        pattern: newTrade.pattern,
        direction: newTrade.direction,
        accountId: selectedAccountId,
        percentage: newTrade.percentage,
        entryPrice: Number(newTrade.entryPrice),
        exitPrice: Number(newTrade.exitPrice),
        lots: Number(newTrade.lots),
        pipsGain: Number(newTrade.pipsGain),
      };
      await api.post("/trades", body);
      await loadTradesForAccount(selectedAccountId);
      setNewTrade({
        instrument: "",
        percentage: 0,
        amount: 0,
        fees: 0,
        dateTime: new Date().toISOString(),
        pattern: "",
        direction: "Long",
        entryPrice: 0,
        exitPrice: 0,
        lots: 1,
        pipsGain: 0,
      });
    } catch (err) {
      console.error("Failed to add FX trade:", err);
      setError("Failed to add FX trade.");
    }
  };

  // Edit modal
  const openEditModal = (trade: Trade) => {
    setEditingTrade(trade);
    setShowEditModal(true);
  };
  const closeEditModal = () => {
    setEditingTrade(null);
    setShowEditModal(false);
  };

  const handleEditTrade = async () => {
    if (!editingTrade || !selectedAccountId) return;
    try {
      const body = {
        instrument: editingTrade.instrument,
        amount: editingTrade.amount ?? 0,
        fees: editingTrade.fees,
        dateTime: editingTrade.entryDate,
        pattern: editingTrade.pattern ?? "",
        direction: editingTrade.tradeDirection === "LONG" ? "Long" : "Short",
        percentage: editingTrade.percentage ?? 0,
        entryPrice: editingTrade.fxTrade?.entryPrice ?? 0,
        exitPrice: editingTrade.fxTrade?.exitPrice ?? 0,
        lots: editingTrade.fxTrade?.lots ?? 1,
        pipsGain: editingTrade.fxTrade?.pipsGain ?? 0,
      };
      await api.put(`/trades/${editingTrade.id}`, body);
      await loadTradesForAccount(selectedAccountId);
      closeEditModal();
    } catch (err) {
      console.error("Failed to update FX trade:", err);
      setError("Failed to update FX trade.");
    }
  };

  // Delete trade
  const handleDeleteTrade = async (tradeId: number) => {
    if (!confirm("Are you sure you want to delete this trade?")) return;
    if (!selectedAccountId) return;
    try {
      await api.delete(`/trades/${tradeId}`);
      await loadTradesForAccount(selectedAccountId);
    } catch (err) {
      console.error("Failed to delete trade:", err);
      setError("Failed to delete trade.");
    }
  };

  // Pagination
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
  };
  const paginatedTrades = trades.slice(0, pageSize);

  if (loading) {
    return <p className="p-4">Loading accounts...</p>;
  }

  // If no FX accounts exist, show creation form
  if (fxAccounts.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <h1 className="text-3xl font-bold mb-4" style={{ color: "#37474F" }}>
          FX Trade Management
        </h1>
        <div className="rounded-lg p-8" style={{ backgroundColor: "#FFF", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <p className="text-xl mb-6" style={{ color: "#00796B" }}>
            No FX accounts found. Create your first FX account to start trading.
          </p>
          <form onSubmit={handleCreateAccount}>
            <input
              type="text"
              className="w-full p-3 border rounded mb-4"
              style={{ borderColor: "#37474F" }}
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Enter account name"
              required
            />
            <button
              type="submit"
              className="w-full py-3 rounded text-white"
              style={{ backgroundColor: "#00C853" }}
            >
              Create FX Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main trade management UI
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA", color: "#37474F" }}>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6" style={{ color: "#37474F" }}>
          FX Trade Management
        </h1>

        {/* Account selector */}
        <div className="mb-4 flex items-center justify-between">
          {fxAccounts.length > 1 ? (
            <div className="flex items-center gap-4">
              <label className="font-semibold">Current Account:</label>
              <select
                value={selectedAccountId ?? ""}
                onChange={(e) => handleSelectAccount(Number(e.target.value))}
                className="p-2 border rounded"
                style={{ borderColor: "#37474F" }}
              >
                <option value="">--Select--</option>
                {fxAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Balance: {acc.balance} {acc.currency})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="font-semibold mr-2">Account:</span>
              {fxAccounts[0].name} (Balance: {fxAccounts[0].balance} {fxAccounts[0].currency})
            </div>
          )}
          <button
            onClick={() => setShowAddAccountForm(!showAddAccountForm)}
            className="px-4 py-2 rounded text-white"
            style={{ backgroundColor: "#00796B" }}
          >
            {showAddAccountForm ? "Cancel" : "Add FX Account"}
          </button>
        </div>

        {/* Add account form */}
        {showAddAccountForm && (
          <div className="mb-6 p-4 rounded shadow" style={{ backgroundColor: "#FFF", borderColor: "#37474F", borderWidth: "1px" }}>
            <form onSubmit={handleCreateAccount}>
              <div className="mb-4">
                <label className="block font-semibold mb-1">New FX Account Name:</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  style={{ borderColor: "#37474F" }}
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. MyFXAccount"
                  required
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded text-white" style={{ backgroundColor: "#00C853" }}>
                Create Account
              </button>
            </form>
          </div>
        )}

        {/* Error display */}
        {error && <p className="text-red-600 mb-4">{error}</p>}

        {/* Add new FX Trade form */}
        <form onSubmit={handleAddTrade} className="mt-4 p-6 rounded shadow" style={{ backgroundColor: "#FFF" }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#00796B" }}>
            Add New FX Trade
          </h2>

          <div className="mt-2">
            <label className="block">Instrument:</label>
            <select
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={newTrade.instrument}
              onChange={(e) => setNewTrade({ ...newTrade, instrument: e.target.value })}
              required
            >
              <option value="">--Select Instrument--</option>
              {instruments.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2">
            <label className="block">Pattern:</label>
            <select
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={newTrade.pattern}
              onChange={(e) => setNewTrade({ ...newTrade, pattern: e.target.value })}
            >
              <option value="">(Optional)</option>
              {patterns.map((pat) => (
                <option key={pat} value={pat}>
                  {pat}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2">
            <label className="block">Direction:</label>
            <select
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={newTrade.direction}
              onChange={(e) => setNewTrade({ ...newTrade, direction: e.target.value as "Long" | "Short" })}
            >
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>
          </div>

          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label className="block">Percentage (%):</label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.percentage}
                onChange={(e) => setNewTrade({ ...newTrade, percentage: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1">
              <label className="block">Amount ($):</label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.amount}
                onChange={(e) => setNewTrade({ ...newTrade, amount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label className="block">Entry Price:</label>
              <input
                type="number"
                step="any"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.entryPrice}
                onChange={(e) => setNewTrade({ ...newTrade, entryPrice: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1">
              <label className="block">Exit Price (optional):</label>
              <input
                type="number"
                step="any"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.exitPrice}
                onChange={(e) => setNewTrade({ ...newTrade, exitPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label className="block">Lots:</label>
              <input
                type="number"
                step="any"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.lots}
                onChange={(e) => setNewTrade({ ...newTrade, lots: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1">
              <label className="block">Pips Gain (optional):</label>
              <input
                type="number"
                step="any"
                className="w-full p-2 border rounded"
                style={{ borderColor: "#37474F" }}
                value={newTrade.pipsGain}
                onChange={(e) => setNewTrade({ ...newTrade, pipsGain: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-2">
            <label className="block">Fees ($):</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={newTrade.fees}
              onChange={(e) => setNewTrade({ ...newTrade, fees: Number(e.target.value) })}
              required
            />
          </div>

          <div className="mt-2">
            <label className="block">Trade Date/Time:</label>
            <input
              type="datetime-local"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={new Date(newTrade.dateTime).toISOString().slice(0, 16)}
              onChange={(e) =>
                setNewTrade({
                  ...newTrade,
                  dateTime: new Date(e.target.value).toISOString(),
                })
              }
            />
          </div>

          <button className="w-full mt-4 py-2 rounded text-white font-semibold" style={{ backgroundColor: "#00C853" }}>
            Add Trade
          </button>
        </form>

        {/* Pagination & advanced filter */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label>Show</label>
            <select value={pageSize} onChange={handlePageSizeChange} className="p-2 border rounded" style={{ borderColor: "#37474F" }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <label>trades</label>
          </div>
          <button
            type="button"
            className="ml-auto px-4 py-2 rounded text-black"
            style={{ backgroundColor: "#FFD700" }}
            onClick={() => router.push("/tradeAdvancedFilter")}
          >
            View Advanced Filter
          </button>
        </div>

        <h2 className="text-xl font-semibold mt-4" style={{ color: "#00796B" }}>
          Trade History (showing {pageSize})
        </h2>
        {trades.length === 0 ? (
          <p className="mt-2">No trades found for this account.</p>
        ) : (
          <table className="w-full mt-4 border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA", borderColor: "#37474F" }}>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Date/Time</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Instrument</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Dir</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>EntryPx</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>ExitPx</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Lots</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Pips</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Fees</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>%</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Amount</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Pattern</th>
                <th className="border p-2" style={{ borderColor: "#37474F" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((t) => (
                <tr key={t.id} style={{ backgroundColor: "#FFF" }}>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{new Date(t.entryDate).toLocaleString()}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.instrument}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.tradeDirection}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.fxTrade?.entryPrice ?? 0}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.fxTrade?.exitPrice ?? 0}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.fxTrade?.lots ?? 0}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.fxTrade?.pipsGain ?? 0}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>${t.fees.toFixed(2)}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>
                    {t.percentage ? t.percentage.toFixed(2) + "%" : "0%"}
                  </td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>
                    {t.amount ? `$${t.amount.toFixed(2)}` : "$0.00"}
                  </td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>{t.pattern}</td>
                  <td className="border p-2" style={{ borderColor: "#37474F" }}>
                    <button
                      className="mr-2 px-3 py-1 rounded"
                      style={{ backgroundColor: "#FFD700", color: "#37474F" }}
                      onClick={() => openEditModal(t)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1 rounded text-white"
                      style={{ backgroundColor: "#00796B" }}
                      onClick={() => handleDeleteTrade(t.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showEditModal && editingTrade && (
          <EditTradeModal trade={editingTrade} onClose={closeEditModal} onSave={handleEditTrade} setTrade={setEditingTrade} />
        )}
      </div>
    </div>
  );
}

// ---------- EDIT MODAL ----------
function EditTradeModal({
  trade,
  onClose,
  onSave,
  setTrade,
}: {
  trade: Trade;
  onClose: () => void;
  onSave: () => void;
  setTrade: React.Dispatch<React.SetStateAction<Trade | null>>;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
      <div className="p-6 rounded shadow-md w-full max-w-md relative" style={{ backgroundColor: "#FAFAFA" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "#37474F" }}>
          Edit FX Trade ID: {trade.id}
        </h2>

        <div className="mt-2">
          <label className="block">Instrument:</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.instrument}
            onChange={(e) => setTrade((t) => t && { ...t, instrument: e.target.value })}
            required
          />
        </div>

        <div className="mt-2">
          <label className="block">Direction:</label>
          <select
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.tradeDirection}
            onChange={(e) => setTrade((t) => t && { ...t, tradeDirection: e.target.value as "LONG" | "SHORT" })}
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>

        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <label className="block">Entry Price:</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={trade.fxTrade?.entryPrice ?? 0}
              onChange={(e) => setTrade((t) => t && { ...t, fxTrade: { ...(t.fxTrade || {}), entryPrice: Number(e.target.value) } })}
            />
          </div>
          <div className="flex-1">
            <label className="block">Exit Price:</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={trade.fxTrade?.exitPrice ?? 0}
              onChange={(e) => setTrade((t) => t && { ...t, fxTrade: { ...(t.fxTrade || {}), exitPrice: Number(e.target.value) } })}
            />
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <label className="block">Lots:</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={trade.fxTrade?.lots ?? 1}
              onChange={(e) => setTrade((t) => t && { ...t, fxTrade: { ...(t.fxTrade || {}), lots: Number(e.target.value) } })}
            />
          </div>
          <div className="flex-1">
            <label className="block">Pips Gain:</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded"
              style={{ borderColor: "#37474F" }}
              value={trade.fxTrade?.pipsGain ?? 0}
              onChange={(e) => setTrade((t) => t && { ...t, fxTrade: { ...(t.fxTrade || {}), pipsGain: Number(e.target.value) } })}
            />
          </div>
        </div>

        <div className="mt-2">
          <label className="block">Fees ($):</label>
          <input
            type="number"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.fees}
            onChange={(e) => setTrade((t) => t && { ...t, fees: Number(e.target.value) })}
          />
        </div>

        <div className="mt-2">
          <label className="block">Trade Date/Time:</label>
          <input
            type="datetime-local"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={new Date(trade.entryDate).toISOString().slice(0, 16)}
            onChange={(e) => setTrade((t) => t && { ...t, entryDate: new Date(e.target.value).toISOString() })}
          />
        </div>

        <div className="mt-2">
          <label className="block">Percentage (%):</label>
          <input
            type="number"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.percentage ?? 0}
            onChange={(e) => setTrade((t) => t && { ...t, percentage: Number(e.target.value) })}
          />
        </div>

        <div className="mt-2">
          <label className="block">Amount ($):</label>
          <input
            type="number"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.amount ?? 0}
            onChange={(e) => setTrade((t) => t && { ...t, amount: Number(e.target.value) })}
          />
        </div>

        <div className="mt-2">
          <label className="block">Pattern:</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            style={{ borderColor: "#37474F" }}
            value={trade.pattern ?? ""}
            onChange={(e) => setTrade((t) => t && { ...t, pattern: e.target.value })}
          />
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <button className="px-4 py-2 rounded text-white" style={{ backgroundColor: "#00C853" }} onClick={onSave}>
            Save
          </button>
          <button className="px-4 py-2 rounded text-white" style={{ backgroundColor: "#37474F" }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
