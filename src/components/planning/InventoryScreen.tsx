"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustStock,
  farmStockValuation,
  inventoryUsesBodegaFallback,
  listLowStock,
  listMovements,
  listProducts,
  receiveStock,
  resetInventorySchemaProbe,
  transferStock,
  upsertProduct,
  useStock,
  type InventoryMovement,
  type InventoryProduct,
  type LowStockItem,
} from "@/lib/inventoryRepository";
import {
  listAllFertilizers,
  matchCatalogProductKey,
} from "@/lib/fertilizerCatalog";
import { listUserFarms, type FarmRecord } from "@/lib/farmRepository";
import MenuSelect from "@/components/ui/MenuSelect";

type Props = {
  userId: string;
  farmId: number;
  farmName: string;
  onBack: () => void;
  labels?: {
    title?: string;
    back?: string;
    products?: string;
    receive?: string;
    use?: string;
    adjust?: string;
    transfer?: string;
    lowStock?: string;
    valuation?: string;
    save?: string;
    empty?: string;
  };
};

export default function InventoryScreen({
  userId,
  farmId,
  farmName,
  onBack,
  labels = {},
}: Props) {
  const t = {
    title: labels.title || "Inventory",
    back: labels.back || "Back",
    products: labels.products || "Products",
    receive: labels.receive || "Receive",
    use: labels.use || "Use",
    adjust: labels.adjust || "Adjust",
    transfer: labels.transfer || "Transfer",
    lowStock: labels.lowStock || "Low stock",
    valuation: labels.valuation || "Stock value",
    save: labels.save || "Save",
    empty: labels.empty || "No products yet.",
  };

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [valuation, setValuation] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [productName, setProductName] = useState("");
  const [catalogKey, setCatalogKey] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [transferFarmId, setTransferFarmId] = useState("");
  const [tab, setTab] = useState<"catalog" | "move" | "history">("catalog");

  const catalogOptions = useMemo(
    () =>
      listAllFertilizers().map((f) => ({
        value: f.key,
        label: f.label,
      })),
    []
  );

  async function reload() {
    setError("");
    setInfo("");
    resetInventorySchemaProbe();
    const [p, m, low, farmList, value] = await Promise.all([
      listProducts(userId, farmId),
      listMovements(userId, farmId),
      listLowStock(userId, farmId),
      listUserFarms(userId),
      farmStockValuation(userId, farmId),
    ]);
    setProducts(p);
    setMovements(m);
    setLowStock(low);
    setFarms(farmList);
    setValuation(value);
    if (!selectedProductId && p[0]) setSelectedProductId(p[0].id);
    // Only surface a soft note if the remote ledger is still missing.
    setInfo(
      inventoryUsesBodegaFallback()
        ? "Using farm bodega stock for now. Movement history needs the inventory ledger on the server."
        : ""
    );
  }

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load inventory")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, farmId]);

  async function handleCreateProduct() {
    if (!productName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const key =
        catalogKey || matchCatalogProductKey(productName.trim()) || null;
      await upsertProduct({
        userId,
        name: productName.trim(),
        productKey: key,
        minStock: Number(minStock) || 0,
        unitCost: unitCost ? Number(unitCost) : null,
        farmId,
      });
      setProductName("");
      setCatalogKey("");
      setMinStock("0");
      setUnitCost("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  async function runMovement(
    kind: "receive" | "use" | "adjust" | "transfer"
  ) {
    if (!selectedProductId) return;
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity === 0) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "receive") {
        await receiveStock({
          userId,
          productId: selectedProductId,
          farmId,
          quantity: Math.abs(quantity),
          unitCost: unitCost ? Number(unitCost) : null,
        });
      } else if (kind === "use") {
        await useStock({
          userId,
          productId: selectedProductId,
          farmId,
          quantity: Math.abs(quantity),
        });
      } else if (kind === "adjust") {
        await adjustStock({
          userId,
          productId: selectedProductId,
          farmId,
          quantityDelta: quantity,
        });
      } else {
        const toFarmId = Number(transferFarmId);
        if (!toFarmId || toFarmId === farmId) {
          throw new Error("Pick a different destination farm");
        }
        await transferStock({
          userId,
          fromFarmId: farmId,
          toFarmId,
          productId: selectedProductId,
          quantity: Math.abs(quantity),
        });
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Movement failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold dark-text-primary">{t.title}</h1>
          <p className="text-sm text-slate-500">{farmName}</p>
        </div>
        <button
          type="button"
          className="calc-guided-stepper__nav-btn text-sm"
          onClick={onBack}
        >
          {t.back}
        </button>
      </div>

      {lowStock.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="font-semibold">{t.lowStock}</p>
          <ul className="mt-1 space-y-0.5">
            {lowStock.map((item) => (
              <li key={`${item.product.id}-${item.farmId}`}>
                {item.product.name}: {item.quantity} {item.unit} (min{" "}
                {item.product.min_stock})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm font-medium dark-text-primary">
        {t.valuation}:{" "}
        {valuation.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })}
      </p>

      <div className="hub-mode-toggle inline-flex" role="tablist">
        {(
          [
            ["catalog", t.products],
            ["move", t.receive],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`hub-mode-toggle__btn ${
              tab === key ? "hub-mode-toggle__btn--active" : ""
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-100">
          {info}
        </p>
      ) : null}

      {tab === "catalog" ? (
        <div className="calc-surface space-y-3 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold">Name</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold">Catalog link</span>
              <MenuSelect
                value={catalogKey}
                onChange={setCatalogKey}
                options={[{ value: "", label: "—" }, ...catalogOptions]}
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold">Min stock</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="font-semibold">Unit cost</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="calc-guided-stepper__nav-btn calc-guided-stepper__nav-btn--primary"
            disabled={busy}
            onClick={() => void handleCreateProduct()}
          >
            {t.save}
          </button>
          {products.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="space-y-1.5">
              {products.map((product) => (
                <li key={product.id} className="farm-detail-row">
                  <span className="font-medium dark-text-primary">
                    {product.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    min {product.min_stock} {product.default_unit}
                    {product.unit_cost != null
                      ? ` · $${product.unit_cost}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "move" ? (
        <div className="calc-surface space-y-3 p-3">
          <label className="block text-sm">
            <span className="font-semibold">Product</span>
            <MenuSelect
              value={selectedProductId}
              onChange={setSelectedProductId}
              options={products.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Quantity</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Transfer to farm</span>
            <MenuSelect
              value={transferFarmId}
              onChange={setTransferFarmId}
              options={[
                { value: "", label: "—" },
                ...farms
                  .filter((f) => f.farm_id !== farmId)
                  .map((f) => ({
                    value: String(f.farm_id),
                    label: f.farm_name,
                  })),
              ]}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="calc-guided-stepper__nav-btn"
              onClick={() => void runMovement("receive")}
            >
              {t.receive}
            </button>
            <button
              type="button"
              disabled={busy}
              className="calc-guided-stepper__nav-btn"
              onClick={() => void runMovement("use")}
            >
              {t.use}
            </button>
            <button
              type="button"
              disabled={busy}
              className="calc-guided-stepper__nav-btn"
              onClick={() => void runMovement("adjust")}
            >
              {t.adjust}
            </button>
            <button
              type="button"
              disabled={busy}
              className="calc-guided-stepper__nav-btn"
              onClick={() => void runMovement("transfer")}
            >
              {t.transfer}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <ul className="space-y-1.5">
          {movements.map((m) => (
            <li key={m.id} className="farm-detail-row">
              <span className="font-medium dark-text-primary">
                {m.movement_type} · {m.quantity} {m.unit}
              </span>
              <span className="text-xs text-slate-500">
                {m.created_at.slice(0, 16).replace("T", " ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
