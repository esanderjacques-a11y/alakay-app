"use client";

import { useEffect, useState } from "react";
import { Edit3, PlusCircle, RefreshCw, Trash2, X } from "lucide-react";

import AddCustomFertilizerForm from "@/components/AddCustomFertilizerForm";
import AppModal from "@/components/AppModal";
import {
  loadCustomFertilizers,
  removeCustomFertilizer,
  type CommercialFertilizer,
} from "@/lib/fertilizerCatalog";

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  t: Record<string, string>;
  embedded?: boolean;
};

export default function CustomFertilizerManager({
  open,
  onClose,
  onChanged,
  t,
  embedded = false,
}: Props) {
  const [products, setProducts] = useState<CommercialFertilizer[]>([]);
  const [editing, setEditing] = useState<CommercialFertilizer | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  function refresh() {
    setProducts(loadCustomFertilizers());
  }

  useEffect(() => {
    if (!open) return;
    refresh();
    setEditing(null);
    setAdding(false);
    setMessage("");
  }, [open]);

  function handleSaved(product: CommercialFertilizer) {
    refresh();
    setEditing(null);
    setAdding(false);
    setMessage(
      (t.customDataFertilizerSaved || "Saved “{name}”.")
        .replace("{name}", product.label)
    );
    onChanged?.();
  }

  function handleDelete(product: CommercialFertilizer) {
    const confirmed = window.confirm(
      (t.customDataFertilizerDeleteConfirm ||
        "Delete “{name}”? This cannot be undone.")
        .replace("{name}", product.label)
    );
    if (!confirmed) return;
    removeCustomFertilizer(product.key);
    if (editing?.key === product.key) setEditing(null);
    refresh();
    setMessage(
      (t.customDataFertilizerDeleted || "Deleted “{name}”.")
        .replace("{name}", product.label)
    );
    onChanged?.();
  }

  if (!open) return null;

  const composing = adding || Boolean(editing);

  const body = (
    <>
      {message ? (
        <div className="app-modal-message app-modal-message--info">
          {message}
        </div>
      ) : null}

      {composing ? (
        <section className="app-modal-section custom-data-manager__composer">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="app-modal-section__title">
              {editing
                ? t.fertilizerEditProductTitle || "Edit fertilizer"
                : t.fertilizerAddProductTitle || "Add fertilizer"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
              className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
              aria-label={t.customDataClose || "Close"}
            >
              <X size={16} />
            </button>
          </div>
          <AddCustomFertilizerForm
            t={t}
            initialProduct={editing}
            onSaved={handleSaved}
            onCancel={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </section>
      ) : null}

      <section className="app-modal-section">
        <div
          className={`app-modal-toolbar${
            embedded ? " app-modal-toolbar--actions-only" : ""
          }`}
        >
          {!embedded ? (
            <p className="app-modal-toolbar__meta">
              {(
                t.customDataFertilizerCount || "{count} custom fertilizer(s)"
              ).replace("{count}", String(products.length))}
            </p>
          ) : null}
          <div className="app-modal-toolbar__actions">
            {!embedded ? (
              <button
                type="button"
                onClick={refresh}
                className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
              >
                <RefreshCw size={16} />
                {t.customDataRefresh || "Refresh"}
              </button>
            ) : null}
            {!composing ? (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setEditing(null);
                  setMessage("");
                }}
                className="app-modal-btn app-modal-btn--primary app-modal-btn--sm"
              >
                <PlusCircle size={16} />
                {t.fertilizerAddProduct || "Add fertilizer"}
              </button>
            ) : null}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="app-modal-message app-modal-message--warn">
            {t.customDataFertilizerEmpty ||
              "No custom fertilizers yet. Add one from formulation, or use Add fertilizer above."}
          </div>
        ) : (
          <div className="app-modal-list">
            {products.map((product) => (
              <article
                key={product.key}
                className="app-modal-list-item custom-data-row"
              >
                <div
                  className="custom-data-row__main"
                  title={
                    product.analysis
                      ? `${product.label} · ${product.analysis}`
                      : product.label
                  }
                >
                  <p className="custom-data-row__title truncate">
                    {product.label}
                  </p>
                  {product.analysis ? (
                    <p className="custom-data-row__meta truncate">
                      {product.analysis}
                    </p>
                  ) : null}
                </div>
                <div className="custom-data-row__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(product);
                      setAdding(false);
                      setMessage("");
                    }}
                    className="app-modal-btn app-modal-btn--secondary app-modal-btn--sm app-modal-btn--icon"
                    aria-label={t.customDataEdit || "Edit"}
                    title={t.customDataEdit || "Edit"}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    className="app-modal-btn app-modal-btn--danger app-modal-btn--sm app-modal-btn--icon"
                    aria-label={t.customDataDelete || "Delete"}
                    title={t.customDataDelete || "Delete"}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );

  if (embedded) {
    return <div className="custom-data-manager">{body}</div>;
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={t.customDataFertilizers || "Custom fertilizers"}
      description={
        t.customDataFertilizersDesc ||
        "Edit or delete fertilizers and formulas saved on this device."
      }
      size="lg"
      closeLabel={t.customDataClose || "Close"}
    >
      {body}
    </AppModal>
  );
}
