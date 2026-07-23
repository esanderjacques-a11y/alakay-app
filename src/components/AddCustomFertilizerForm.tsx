"use client";

import { useEffect, useState } from "react";
import {
  type CommercialFertilizer,
  type FertilizerNutrient,
  upsertCustomFertilizer,
} from "@/lib/fertilizerCatalog";

const GRADE_FIELDS: FertilizerNutrient[] = [
  "n",
  "p2o5",
  "k2o",
  "mgo",
  "cao",
  "s",
  "zn",
  "b",
  "fe",
  "mn",
  "cu",
  "mo",
];

const FIELD_LABEL: Record<FertilizerNutrient, string> = {
  n: "N",
  p2o5: "P₂O₅",
  k2o: "K₂O",
  mgo: "MgO",
  cao: "CaO",
  s: "S",
  zn: "Zn",
  b: "B",
  fe: "Fe",
  mn: "Mn",
  cu: "Cu",
  mo: "Mo",
};

type Props = {
  t: Record<string, string>;
  onSaved: (product: CommercialFertilizer) => void;
  onCancel?: () => void;
  /** When set, form updates this product instead of creating a new one. */
  initialProduct?: CommercialFertilizer | null;
};

function parseGrade(raw: string) {
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function gradesFromProduct(product?: CommercialFertilizer | null) {
  const next: Record<string, string> = { n: "", p2o5: "", k2o: "" };
  if (!product) return next;
  for (const key of GRADE_FIELDS) {
    const value = product.grade[key];
    if (value != null && value > 0) next[key] = String(value);
  }
  return next;
}

export default function AddCustomFertilizerForm({
  t,
  onSaved,
  onCancel,
  initialProduct = null,
}: Props) {
  const [label, setLabel] = useState(initialProduct?.label || "");
  const [grades, setGrades] = useState<Record<string, string>>(() =>
    gradesFromProduct(initialProduct)
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setLabel(initialProduct?.label || "");
    setGrades(gradesFromProduct(initialProduct));
    setError("");
  }, [initialProduct?.key]);

  function setGrade(key: FertilizerNutrient, value: string) {
    setGrades((previous) => ({ ...previous, [key]: value }));
  }

  function handleSave() {
    const name = label.trim();
    if (!name) {
      setError(
        t.fertilizerAddNameRequired || "Enter a fertilizer name."
      );
      return;
    }
    const grade: Partial<Record<FertilizerNutrient, number>> = {};
    for (const key of GRADE_FIELDS) {
      const value = parseGrade(grades[key] || "");
      if (value > 0) grade[key] = value;
    }
    if (Object.keys(grade).length === 0) {
      setError(
        t.fertilizerAddGradeRequired ||
          "Enter at least one nutrient percentage."
      );
      return;
    }
    const product = upsertCustomFertilizer({
      label: name,
      grade,
      key: initialProduct?.key,
    });
    onSaved(product);
    if (!initialProduct) {
      setLabel("");
      setGrades({ n: "", p2o5: "", k2o: "" });
    }
    setError("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-900/15 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold text-green-950 dark-text-primary">
        {initialProduct
          ? t.fertilizerEditProductTitle || "Edit fertilizer"
          : t.fertilizerAddProductTitle || "Add fertilizer"}
      </p>
      <label className="calc-field-label grid gap-1">
        {t.fertilizerAddName || "Name"}
        <input
          className="calc-field-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={
            t.fertilizerAddNamePlaceholder || "e.g. Local 20-10-10"
          }
        />
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {GRADE_FIELDS.map((key) => (
          <label key={key} className="calc-field-label grid gap-1">
            {FIELD_LABEL[key]} %
            <input
              className="calc-field-input"
              inputMode="decimal"
              value={grades[key] || ""}
              onChange={(event) => setGrade(key, event.target.value)}
              placeholder="0"
            />
          </label>
        ))}
      </div>
      {error ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
          onClick={handleSave}
        >
          {t.fertilizerAddProductSave || "Save fertilizer"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="rounded-xl border border-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-white/70 dark:text-slate-100"
            onClick={onCancel}
          >
            {t.fertilizerAddProductCancel || "Cancel"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
