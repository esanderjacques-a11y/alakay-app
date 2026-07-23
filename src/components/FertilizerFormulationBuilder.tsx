"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Shuffle } from "lucide-react";
import AddCustomFertilizerForm from "@/components/AddCustomFertilizerForm";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  DEFAULT_FERTILIZER_BAG_KG,
  FERTILIZER_CURRENCIES,
  INERT_FILLERS,
  listAllFertilizers,
  pricePerBagFromTonne,
  recommendFiller,
  upsertCustomFertilizer,
} from "@/lib/fertilizerCatalog";
import { resolveProductPrices } from "@/lib/fertilizerCostOptimize";
import {
  buildFormulation,
  fromKg,
  type FormulationFinishMode,
  type FormulationGrade,
  type FormulationMassUnit,
} from "@/lib/fertilizerFormulation";
import type { FertilizerNutrient } from "@/lib/fertilizerCatalog";

type PriceRow = {
  key: string;
  pricePerMetricTonne: number | null;
};

type PriceResponse = {
  currency: string;
  products: PriceRow[];
  source?: string;
  sourceUrl?: string;
  period?: string;
  updatedAt?: string;
  error?: string;
};

type Props = {
  t: Record<string, string>;
  country?: string | null;
};

type StrategyMode = "manual" | "auto" | "value";

const FILLER_AUTO = "__auto__";

/** Primary recipe is always solved for this finished-formula basis. */
const FORMULA_BASIS_KG = 100;

type ProductCategoryId = "n" | "p" | "k" | "secondary" | "micro";

const PRODUCT_CATEGORY_ORDER: ProductCategoryId[] = [
  "n",
  "p",
  "k",
  "secondary",
  "micro",
];

function nutrientCount(
  product: { grade: Partial<Record<FertilizerNutrient, number>> }
) {
  return (
    [
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
    ] as FertilizerNutrient[]
  ).filter((key) => (product.grade[key] || 0) > 0).length;
}

/** Place each product under the nutrient with the highest % in its grade. */
function productCategory(
  product: { grade: Partial<Record<FertilizerNutrient, number>> }
): ProductCategoryId {
  const g = product.grade;
  const scores: Array<{ id: ProductCategoryId; value: number; tie: number }> = [
    { id: "n", value: g.n || 0, tie: 0 },
    { id: "p", value: g.p2o5 || 0, tie: 1 },
    { id: "k", value: g.k2o || 0, tie: 2 },
    {
      id: "secondary",
      value: Math.max(g.mgo || 0, g.cao || 0, g.s || 0),
      tie: 3,
    },
    {
      id: "micro",
      value: Math.max(
        g.zn || 0,
        g.b || 0,
        g.fe || 0,
        g.mn || 0,
        g.cu || 0,
        g.mo || 0
      ),
      tie: 4,
    },
  ];
  scores.sort((a, b) => b.value - a.value || a.tie - b.tie);
  if (scores[0].value <= 0) return "micro";
  return scores[0].id;
}

/** Map search text like "N", "nitr", "P2O5", "calcium" to nutrient keys. */
function nutrientsFromSearchQuery(query: string): FertilizerNutrient[] {
  const q = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/₂/g, "2")
    .replace(/₅/g, "5")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (!q) return [];

  const aliases: Array<{ alias: string; nutrients: FertilizerNutrient[] }> = [
    { alias: "n", nutrients: ["n"] },
    { alias: "nitrogen", nutrients: ["n"] },
    { alias: "nitrogeno", nutrients: ["n"] },
    { alias: "azote", nutrients: ["n"] },
    { alias: "nitrate", nutrients: ["n"] },
    { alias: "nitrato", nutrients: ["n"] },
    { alias: "nitro", nutrients: ["n"] },
    { alias: "p", nutrients: ["p2o5"] },
    { alias: "p2o5", nutrients: ["p2o5"] },
    { alias: "phosphorus", nutrients: ["p2o5"] },
    { alias: "phosphore", nutrients: ["p2o5"] },
    { alias: "fosforo", nutrients: ["p2o5"] },
    { alias: "phosphate", nutrients: ["p2o5"] },
    { alias: "fosfato", nutrients: ["p2o5"] },
    { alias: "k", nutrients: ["k2o"] },
    { alias: "k2o", nutrients: ["k2o"] },
    { alias: "potassium", nutrients: ["k2o"] },
    { alias: "potasio", nutrients: ["k2o"] },
    { alias: "potash", nutrients: ["k2o"] },
    { alias: "mgo", nutrients: ["mgo"] },
    { alias: "mg", nutrients: ["mgo"] },
    { alias: "magnesium", nutrients: ["mgo"] },
    { alias: "magnesio", nutrients: ["mgo"] },
    { alias: "cao", nutrients: ["cao"] },
    { alias: "ca", nutrients: ["cao"] },
    { alias: "calcium", nutrients: ["cao"] },
    { alias: "calcio", nutrients: ["cao"] },
    { alias: "s", nutrients: ["s"] },
    { alias: "sulfur", nutrients: ["s"] },
    { alias: "sulphur", nutrients: ["s"] },
    { alias: "sulfate", nutrients: ["s"] },
    { alias: "sulphate", nutrients: ["s"] },
    { alias: "azufre", nutrients: ["s"] },
    { alias: "zn", nutrients: ["zn"] },
    { alias: "zinc", nutrients: ["zn"] },
    { alias: "b", nutrients: ["b"] },
    { alias: "boron", nutrients: ["b"] },
    { alias: "boro", nutrients: ["b"] },
    { alias: "fe", nutrients: ["fe"] },
    { alias: "iron", nutrients: ["fe"] },
    { alias: "hierro", nutrients: ["fe"] },
    { alias: "mn", nutrients: ["mn"] },
    { alias: "manganese", nutrients: ["mn"] },
    { alias: "manganeso", nutrients: ["mn"] },
    { alias: "cu", nutrients: ["cu"] },
    { alias: "copper", nutrients: ["cu"] },
    { alias: "cobre", nutrients: ["cu"] },
    { alias: "mo", nutrients: ["mo"] },
    { alias: "molybdenum", nutrients: ["mo"] },
    { alias: "molibdeno", nutrients: ["mo"] },
  ];

  const collected = new Set<FertilizerNutrient>();

  for (const { alias, nutrients } of aliases) {
    if (alias === q) {
      for (const nutrient of nutrients) collected.add(nutrient);
    }
  }
  if (collected.size > 0) return [...collected];

  // Prefix match: "nitr" → nitrogen/nitrate, "phos" → phosphorus, "cal" → calcium…
  if (q.length >= 3) {
    for (const { alias, nutrients } of aliases) {
      if (alias.length < 3) continue;
      if (alias.startsWith(q) || q.startsWith(alias)) {
        for (const nutrient of nutrients) collected.add(nutrient);
      }
    }
  }

  return [...collected];
}

function productHasNutrients(
  product: { grade: Partial<Record<FertilizerNutrient, number>> },
  nutrients: FertilizerNutrient[]
) {
  return nutrients.some((nutrient) => (product.grade[nutrient] || 0) > 0);
}

const SECONDARY_KEYS: FertilizerNutrient[] = ["mgo", "cao", "s"];
const MICRO_KEYS: FertilizerNutrient[] = ["zn", "b", "fe", "mn", "cu", "mo"];

const NUTRIENT_LABEL: Record<FertilizerNutrient, string> = {
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

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function FilterChip({
  label,
  active,
  onClick,
  icon,
  title,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "fertilizer-cost-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "fertilizer-cost-chip--active border-emerald-800 bg-emerald-800 text-white"
          : "border-emerald-900/20 bg-white/70 text-green-950 hover:border-emerald-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-100",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

export default function FertilizerFormulationBuilder({ t, country }: Props) {
  const [n, setN] = useState("");
  const [p2o5, setP2o5] = useState("");
  const [k2o, setK2o] = useState("");
  const [mgo, setMgo] = useState("");
  const [cao, setCao] = useState("");
  const [s, setS] = useState("");
  const [zn, setZn] = useState("");
  const [b, setB] = useState("");
  const [fe, setFe] = useState("");
  const [mn, setMn] = useState("");
  const [cu, setCu] = useState("");
  const [mo, setMo] = useState("");
  const [showExtras, setShowExtras] = useState(false);

  const [batchSize, setBatchSize] = useState("100");
  const [unit, setUnit] = useState<FormulationMassUnit>("kg");
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [strategy, setStrategy] = useState<StrategyMode>("manual");
  const [finishMode, setFinishMode] = useState<FormulationFinishMode>("filler");
  const [fillerChoice, setFillerChoice] = useState<string>(FILLER_AUTO);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showAddFertilizer, setShowAddFertilizer] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(true);
  const [saveFormulaName, setSaveFormulaName] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  /** When selected products can't hit the target, hide the recipe until a choice. */
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [randomUnit, setRandomUnit] = useState(0);

  const [currency, setCurrency] = useState("");
  const [prices, setPrices] = useState<PriceResponse | null>(null);
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [bagKg] = useState(DEFAULT_FERTILIZER_BAG_KG);

  const catalog = useMemo(
    () => listAllFertilizers(),
    [catalogVersion]
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (currency) params.set("currency", currency);
    void fetch(`/api/fertilizer-prices?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as PriceResponse;
        if (!response.ok) return;
        setPrices(data);
      })
      .catch(() => {
        // Prices are optional for formulation.
      });
    return () => controller.abort();
  }, [country, currency]);

  const displayCurrency = prices?.currency || currency || "USD";
  const currencyOptions = [
    ...new Set([displayCurrency, ...FERTILIZER_CURRENCIES]),
  ].map((code) => [code, code] as [string, string]);

  const onlineByKey = useMemo(() => {
    const map: Record<string, number | null | undefined> = {};
    for (const row of prices?.products || []) {
      map[row.key] = row.pricePerMetricTonne;
    }
    return map;
  }, [prices]);

  const productPrices = useMemo(
    () =>
      resolveProductPrices({
        bagKg,
        currency: displayCurrency,
        manualPrices,
        onlineByKey,
      }),
    [bagKg, displayCurrency, manualPrices, onlineByKey]
  );

  const targetGrade = useMemo((): FormulationGrade => {
    const parse = (raw: string) => {
      const value = Number(String(raw).replace(",", "."));
      return Number.isFinite(value) && value > 0 ? value : 0;
    };
    return {
      n: parse(n),
      p2o5: parse(p2o5),
      k2o: parse(k2o),
      mgo: parse(mgo),
      cao: parse(cao),
      s: parse(s),
      zn: parse(zn),
      b: parse(b),
      fe: parse(fe),
      mn: parse(mn),
      cu: parse(cu),
      mo: parse(mo),
    };
  }, [n, p2o5, k2o, mgo, cao, s, zn, b, fe, mn, cu, mo]);

  const recommendedFiller = useMemo(
    () => recommendFiller(null, targetGrade),
    [targetGrade]
  );

  const effectiveFillerKey =
    fillerChoice === FILLER_AUTO ? recommendedFiller.key : fillerChoice;

  const selectedFiller =
    INERT_FILLERS.find((item) => item.key === effectiveFillerKey) ||
    recommendedFiller;

  const batch = Number(String(batchSize).replace(",", ".")) || 0;

  /** No-filler recipes solve for the chosen finished quantity; filler stays on 100 kg. */
  const formulaBatchSize =
    finishMode === "no_filler"
      ? batch > 0
        ? batch
        : FORMULA_BASIS_KG
      : FORMULA_BASIS_KG;
  const formulaUnit: FormulationMassUnit =
    finishMode === "no_filler" ? unit : "kg";

  const selectionResult = useMemo(
    () =>
      buildFormulation({
        targetGrade,
        batchSize: formulaBatchSize,
        unit: formulaUnit,
        finishMode,
        allowedProductKeys: strategy === "manual" ? selectedKeys : null,
        fillerKeys: [effectiveFillerKey],
        prices: productPrices,
        bagKg,
        optimizeFor: strategy === "value" ? "value" : "mix",
      }),
    [
      targetGrade,
      formulaBatchSize,
      formulaUnit,
      finishMode,
      strategy,
      selectedKeys,
      effectiveFillerKey,
      productPrices,
      bagKg,
    ]
  );

  const randomResult = useMemo(() => {
    if (!useRandomMix) return null;
    return buildFormulation({
      targetGrade,
      batchSize: formulaBatchSize,
      unit: formulaUnit,
      finishMode,
      allowedProductKeys: null,
      fillerKeys: [effectiveFillerKey],
      prices: productPrices,
      bagKg,
      optimizeFor: "random",
      randomUnit,
    });
  }, [
    useRandomMix,
    randomUnit,
    targetGrade,
    formulaBatchSize,
    formulaUnit,
    finishMode,
    effectiveFillerKey,
    productPrices,
    bagKg,
  ]);

  const result = useRandomMix && randomResult ? randomResult : selectionResult;

  const hasTargetGrade = Object.values(targetGrade).some(
    (value) => (value || 0) > 0
  );

  /** Selection cannot hit the exact target — offer closest / best mix / random. */
  const selectionNeedsChoice =
    strategy === "manual" &&
    hasTargetGrade &&
    !selectionResult.exactMatch &&
    (selectedKeys.length > 0 || selectionResult.autoCanSolve);

  const awaitingInexactChoice = selectionNeedsChoice && !useRandomMix;

  const showChoiceBanner = selectionNeedsChoice || useRandomMix;

  useEffect(() => {
    setUseRandomMix(false);
  }, [strategy, selectedKeys, targetGrade, finishMode, effectiveFillerKey]);

  const batchKg = useMemo(() => {
    if (!(batch > 0)) return 0;
    return unit === "lb" ? batch * 0.45359237 : batch;
  }, [batch, unit]);

  /** Filler mode: optional production scale from the 100 kg basis recipe. */
  const productionScale =
    finishMode === "filler" && result.feasible && batchKg > 0
      ? batchKg / FORMULA_BASIS_KG
      : 0;

  const unitLabel = unit === "lb" ? "lb" : "kg";
  const recipeUnitLabel = finishMode === "no_filler" ? unitLabel : "kg";

  function recipeMass(kg: number) {
    return finishMode === "no_filler" ? fromKg(kg, unit) : kg;
  }

  function displayMass(kgOnBasis: number, forProduction: boolean) {
    if (forProduction && productionScale > 0) {
      return fromKg(kgOnBasis * productionScale, unit);
    }
    return kgOnBasis;
  }

  const usedProductLines = useMemo(
    () => result.lines.filter((line) => !line.isFiller),
    [result.lines]
  );

  function priceManualKey(productKey: string) {
    return `saco:${bagKg}:${displayCurrency}:${productKey}`;
  }

  function toggleProduct(key: string) {
    setSelectedKeys((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  }

  function setAllProducts(on: boolean) {
    setSelectedKeys(on ? catalog.map((p) => p.key) : []);
  }

  function autofillFiller() {
    setFillerChoice(FILLER_AUTO);
  }

  function switchToBestMix() {
    setUseRandomMix(false);
    setStrategy("auto");
  }

  function switchToBestValue() {
    setUseRandomMix(false);
    setStrategy("value");
  }

  function pickRandomExactMix() {
    setRandomUnit(Math.random());
    setUseRandomMix(true);
  }

  function applyClosestAsTarget() {
    if (!selectionResult.feasible || selectionResult.exactMatch) return;
    setUseRandomMix(false);
    const grade = selectionResult.outputGrade;
    setN(grade.n != null ? String(grade.n) : "");
    setP2o5(grade.p2o5 != null ? String(grade.p2o5) : "");
    setK2o(grade.k2o != null ? String(grade.k2o) : "");
    setMgo(grade.mgo != null ? String(grade.mgo) : "");
    setCao(grade.cao != null ? String(grade.cao) : "");
    setS(grade.s != null ? String(grade.s) : "");
    setZn(grade.zn != null ? String(grade.zn) : "");
    setB(grade.b != null ? String(grade.b) : "");
    setFe(grade.fe != null ? String(grade.fe) : "");
    setMn(grade.mn != null ? String(grade.mn) : "");
    setCu(grade.cu != null ? String(grade.cu) : "");
    setMo(grade.mo != null ? String(grade.mo) : "");
    if (
      (grade.mgo || 0) > 0 ||
      (grade.cao || 0) > 0 ||
      (grade.s || 0) > 0 ||
      (grade.zn || 0) > 0 ||
      (grade.b || 0) > 0 ||
      (grade.fe || 0) > 0 ||
      (grade.mn || 0) > 0 ||
      (grade.cu || 0) > 0 ||
      (grade.mo || 0) > 0
    ) {
      setShowExtras(true);
    }
  }

  function refreshCatalog() {
    setCatalogVersion((version) => version + 1);
  }

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim();
    if (!query) return catalog;
    const nutrientMatches = nutrientsFromSearchQuery(query);
    const text = query.toLocaleLowerCase();
    return catalog.filter((product) => {
      if (
        nutrientMatches.length > 0 &&
        productHasNutrients(product, nutrientMatches)
      ) {
        return true;
      }
      // Pure nutrient token (e.g. "N", "P2O5") → only nutrient filter.
      if (nutrientMatches.length > 0) return false;
      const haystack = `${product.label} ${product.analysis} ${product.key}`
        .toLocaleLowerCase();
      return haystack.includes(text);
    });
  }, [catalog, productSearch]);

  const productsByCategory = useMemo(() => {
    const groups = new Map<ProductCategoryId, typeof filteredProducts>();
    for (const id of PRODUCT_CATEGORY_ORDER) groups.set(id, []);
    for (const product of filteredProducts) {
      const id = productCategory(product);
      groups.get(id)!.push(product);
    }
    return PRODUCT_CATEGORY_ORDER.map((id) => ({
      id,
      products: groups.get(id) || [],
    })).filter((group) => group.products.length > 0);
  }, [filteredProducts]);

  const categoryLabel = (id: ProductCategoryId) => {
    switch (id) {
      case "n":
        return t.fertilizerFormulationCatN || "Nitrogen (N)";
      case "p":
        return t.fertilizerFormulationCatP || "Phosphorus (P₂O₅)";
      case "k":
        return t.fertilizerFormulationCatK || "Potassium (K₂O)";
      case "secondary":
        return t.fertilizerFormulationCatSecondary || "Secondary (Ca, Mg, S)";
      case "micro":
        return t.fertilizerFormulationCatMicro || "Micronutrients";
      default:
        return id;
    }
  };

  const selectedProductsSummary = useMemo(
    () =>
      catalog.filter((product) => selectedKeys.includes(product.key)),
    [catalog, selectedKeys]
  );

  function handleCustomFertilizerSaved(product: {
    key: string;
  }) {
    setSelectedKeys((previous) =>
      previous.includes(product.key)
        ? previous
        : [...previous, product.key]
    );
    refreshCatalog();
    setShowAddFertilizer(false);
    setProductSearch("");
    setSaveNotice(
      t.fertilizerAddProductSaved || "Fertilizer added to your lists."
    );
  }

  function handleSaveFormula() {
    if (!result.feasible) return;
    const name =
      saveFormulaName.trim() ||
      `${t.fertilizerFormulationFormulaPrefix || "Formula"} ${result.gradeLabel}`;
    const product = upsertCustomFertilizer({
      label: name,
      grade: result.outputGrade,
      analysis: result.gradeLabel,
    });
    setSelectedKeys((previous) =>
      previous.includes(product.key)
        ? previous
        : [...previous, product.key]
    );
    refreshCatalog();
    setSaveFormulaName("");
    setSaveNotice(
      t.fertilizerFormulationSaved ||
        "Formula saved. It is now available in fertilizer lists."
    );
  }

  function renderGradeField(
    key: FertilizerNutrient,
    value: string,
    onChange: (next: string) => void
  ) {
    return (
      <label key={key} className="calc-field-label grid gap-1">
        {NUTRIENT_LABEL[key]} %
        <input
          className="calc-field-input"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
        />
      </label>
    );
  }

  return (
    <div className="fertilizer-plan calc-page px-0 space-y-4">
      <section className="calc-surface space-y-3 p-4">
        <div>
          <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerFormulation || "Fertilizer formulation"}
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {t.fertilizerFormulationDesc ||
              "Build a custom grade from raw materials. Auto-pick the best mix, or choose what you have available."}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            {t.fertilizerFormulationTarget || "Target grade"}
          </p>
          <div className="mt-2 calc-form-fields grid grid-cols-3 gap-3">
            {renderGradeField("n", n, setN)}
            {renderGradeField("p2o5", p2o5, setP2o5)}
            {renderGradeField("k2o", k2o, setK2o)}
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-emerald-800 underline"
            onClick={() => setShowExtras((previous) => !previous)}
          >
            {showExtras
              ? t.fertilizerFormulationHideExtras || "Hide secondary & micros"
              : t.fertilizerFormulationShowExtras || "Secondary & micronutrients"}
          </button>
          {showExtras ? (
            <div className="mt-2 calc-form-fields grid grid-cols-3 gap-3">
              {SECONDARY_KEYS.map((key) => {
                const setters: Record<string, (v: string) => void> = {
                  mgo: setMgo,
                  cao: setCao,
                  s: setS,
                };
                const values: Record<string, string> = { mgo, cao, s };
                return renderGradeField(key, values[key] || "", setters[key]);
              })}
              {MICRO_KEYS.map((key) => {
                const setters: Record<string, (v: string) => void> = {
                  zn: setZn,
                  b: setB,
                  fe: setFe,
                  mn: setMn,
                  cu: setCu,
                  mo: setMo,
                };
                const values: Record<string, string> = { zn, b, fe, mn, cu, mo };
                return renderGradeField(key, values[key] || "", setters[key]);
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="calc-surface space-y-3 p-4">
        <div className="grid gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            {t.fertilizerFormulationStrategy || "Product strategy"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={strategy === "manual"}
              onClick={() => {
                setStrategy("manual");
                setProductPickerOpen(true);
              }}
              label={`1. ${t.fertilizerFormulationMyProducts || "Select product"}`}
            />
            <FilterChip
              active={strategy === "auto"}
              onClick={() => setStrategy("auto")}
              label={`2. ${t.fertilizerFormulationBestMix || "Best mix"}`}
            />
            <FilterChip
              active={strategy === "value"}
              onClick={() => setStrategy("value")}
              label={`3. ${t.fertilizerFormulationBestValue || "Best value"}`}
            />
          </div>
        </div>

        {strategy === "manual" ? (
          <div className="space-y-2">
            {!productPickerOpen ? (
              <div className="space-y-2 rounded-xl border border-emerald-900/10 bg-white/50 p-2.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-green-950 dark-text-primary">
                    {selectedKeys.length > 0
                      ? (
                          t.fertilizerFormulationSelectedCount ||
                          "{count} selected"
                        ).replace("{count}", String(selectedKeys.length))
                      : t.fertilizerFormulationNoneSelected ||
                        "No products selected"}
                  </p>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                    onClick={() => setProductPickerOpen(true)}
                  >
                    {t.fertilizerFormulationChangeSelection || "Change"}
                  </button>
                </div>
                {selectedProductsSummary.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {selectedProductsSummary.map((product) => (
                      <li
                        key={`picked-${product.key}`}
                        className="rounded-full border border-emerald-900/15 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-green-950 dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
                      >
                        {product.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative min-w-[10rem] flex-1">
                    <span className="sr-only">
                      {t.fertilizerSearchPlaceholder ||
                        "Search by name or nutrient (N, P, K…)"}
                    </span>
                    <input
                      className="calc-field-input w-full pr-10"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder={
                        t.fertilizerSearchPlaceholder ||
                        "Search by name or nutrient (N, P, K…)"
                      }
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70">
                      {t.fertilizerSearchAction || "Search"}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                    onClick={() => setShowAddFertilizer((open) => !open)}
                  >
                    {showAddFertilizer
                      ? t.fertilizerAddProductCancel || "Cancel"
                      : t.fertilizerAddProduct || "Add fertilizer"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-emerald-800 underline"
                    onClick={() => setAllProducts(true)}
                  >
                    {t.fertilizerFormulationSelectAll || "Select all"}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-emerald-800 underline"
                    onClick={() => setAllProducts(false)}
                  >
                    {t.fertilizerFormulationClearAll || "Clear"}
                  </button>
                  <span className="text-xs text-slate-500">
                    {selectedKeys.length}/{catalog.length}
                  </span>
                  <button
                    type="button"
                    className="ml-auto rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                    onClick={() => setProductPickerOpen(false)}
                  >
                    {t.fertilizerFormulationDoneSelecting || "OK"}
                  </button>
                </div>
                {showAddFertilizer ? (
                  <AddCustomFertilizerForm
                    t={t}
                    onSaved={handleCustomFertilizerSaved}
                    onCancel={() => setShowAddFertilizer(false)}
                  />
                ) : null}
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                  {productsByCategory.map((group) => (
                    <div key={group.id} className="space-y-0.5">
                      <p className="text-[10px] font-bold tracking-wide text-emerald-800">
                        {categoryLabel(group.id)}
                      </p>
                      <ul className="formulation-product-grid grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                        {group.products.map((product) => {
                          const checked = selectedKeys.includes(product.key);
                          const isMulti = nutrientCount(product) >= 2;
                          return (
                            <li key={product.key}>
                              <button
                                type="button"
                                onClick={() => toggleProduct(product.key)}
                                aria-pressed={checked}
                                title={`${product.label} · ${product.analysis}`}
                                className={[
                                  "formulation-product-tile flex w-full items-center gap-1 rounded-md border px-1.5 py-1 text-left transition",
                                  checked
                                    ? "border-emerald-800 bg-emerald-800 text-white shadow-sm"
                                    : "border-emerald-900/15 bg-white/60 text-green-950 hover:border-emerald-700/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
                                ].join(" ")}
                              >
                                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight">
                                  <span
                                    className={
                                      checked ? "text-white" : "dark-text-primary"
                                    }
                                  >
                                    {product.label}
                                  </span>
                                  <span
                                    className={[
                                      "font-normal",
                                      checked
                                        ? "text-white/80"
                                        : "text-slate-500 dark:text-slate-400",
                                    ].join(" ")}
                                  >
                                    {" · "}
                                    {product.analysis}
                                  </span>
                                </span>
                                {isMulti ? (
                                  <span
                                    className={[
                                      "shrink-0 text-[8px] font-semibold uppercase tracking-wide",
                                      checked
                                        ? "text-emerald-100"
                                        : "text-emerald-700",
                                    ].join(" ")}
                                  >
                                    {t.fertilizerFormulationMultiTag || "multi"}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.fertilizerNoSearchResults ||
                      "No fertilizers match. Try another search or add one manually."}
                  </p>
                ) : null}
                {saveNotice ? (
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    {saveNotice}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              {t.fertilizerFormulationMixProducts || "Fertilizers in this mix"}
            </p>
            {result.feasible &&
            result.lines.some((line) => !line.isFiller) ? (
              <ul className="grid gap-1">
                {result.lines
                  .filter((line) => !line.isFiller)
                  .map((line) => (
                    <li
                      key={`mix-${line.productKey}`}
                      className="rounded-lg border border-emerald-900/10 bg-white/50 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="truncate text-green-950 dark-text-primary">
                        <span className="font-semibold">{line.label}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {" · "}
                          {line.analysis}
                        </span>
                      </p>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.fertilizerFormulationMixPending ||
                  "Set a target grade to see which fertilizers Best mix picks."}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            {t.fertilizerFormulationFinish || "Finish mode"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={finishMode === "filler"}
              onClick={() => setFinishMode("filler")}
              label={t.fertilizerFormulationUseFiller || "Use filler"}
            />
            <FilterChip
              active={finishMode === "no_filler"}
              onClick={() => setFinishMode("no_filler")}
              label={
                t.fertilizerFormulationNoFiller || "No filler (adjust grade)"
              }
            />
          </div>
        </div>

        {finishMode === "filler" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {t.fertilizerFormulationFiller || "Filler"}
              </p>
              <button
                type="button"
                className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                onClick={autofillFiller}
              >
                {t.fertilizerFormulationAutofill || "Autofill filler"}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.fertilizerFormulationFillerHint ||
                "Auto picks the best inert filler so the blend reaches 100 kg. Amount shows in the recipe."}
            </p>
            <MenuSelect
              label={t.fertilizerFormulationFiller || "Filler"}
              value={fillerChoice}
              options={[
                [
                  FILLER_AUTO,
                  `${t.fertilizerFormulationFillerAuto || "Auto (recommended)"} · ${recommendedFiller.label}`,
                ] as [string, string],
                ...INERT_FILLERS.map(
                  (filler) =>
                    [filler.key, filler.label] as [string, string]
                ),
              ]}
              onChange={setFillerChoice}
              fullWidth
              variant="field"
            />
            {result.feasible ? (
              result.fillerMassKg > 0.05 ? (
                <p className="rounded-lg border border-emerald-900/10 bg-white/50 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/5">
                  <span className="font-semibold text-green-950 dark-text-primary">
                    {selectedFiller.label}
                  </span>
                  <span className="text-slate-500">
                    {" · "}
                    {result.fillerMassKg.toFixed(2)} kg{" "}
                    {t.fertilizerFormulationFillerToReach ||
                      "to reach 100 kg"}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.fertilizerFormulationFillerNone ||
                    "Products already fill 100 kg — no filler needed."}
                </p>
              )
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t.fertilizerFormulationNoFillerHint ||
              "Without filler, the grade concentrates to fill 100% of the product weight. Scale factor multiplies ingredient masses to your batch size."}
          </p>
        )}
      </section>

      <section className="calc-surface space-y-3 p-4">
        {showChoiceBanner ? (
          <div className="space-y-2 rounded-xl border border-emerald-900/10 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              {t.fertilizerFormulationInexactTitle ||
                "Selected products cannot make the exact target grade"}
            </p>
            <p className="text-xs leading-snug text-slate-600 dark:text-slate-300">
              {selectionResult.feasible
                ? (
                    t.fertilizerFormulationInexactBody ||
                    "Multi-nutrient fertilizers are credited together. Closest achievable grade with your selection: {grade}."
                  ).replace("{grade}", selectionResult.gradeLabel) +
                  (selectionResult.unmetLabels.length > 0
                    ? ` ${
                        t.fertilizerFormulationUnmet || "Short on"
                      }: ${selectionResult.unmetLabels.join(", ")}.`
                    : "")
                : t.fertilizerFormulationInfeasibleBody ||
                  "Your selection cannot supply this grade. Switch to Best mix or Best value, or shuffle a random exact mix."}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {/* Same chip language as strategy: 1 Select product · 2 Best mix · 3 Best value */}
              {selectionResult.feasible ? (
                <FilterChip
                  active
                  onClick={applyClosestAsTarget}
                  label={(
                    t.fertilizerFormulationUseClosest ||
                    "1. Use closest formula ({grade})"
                  ).replace("{grade}", selectionResult.gradeLabel)}
                />
              ) : null}
              {selectionResult.autoCanSolve && strategy !== "auto" ? (
                <FilterChip
                  onClick={switchToBestMix}
                  label={
                    t.fertilizerFormulationSwitchBestMix ||
                    "2. Switch to Best mix"
                  }
                />
              ) : null}
              {selectionResult.autoCanSolve && strategy !== "value" ? (
                <FilterChip
                  onClick={switchToBestValue}
                  label={
                    t.fertilizerFormulationSwitchBestValue ||
                    "3. Switch to Best value"
                  }
                />
              ) : null}
              {selectionResult.autoCanSolve ? (
                <FilterChip
                  active={useRandomMix}
                  onClick={pickRandomExactMix}
                  title={t.fertilizerFormulationRandomMix || "Random mix"}
                  icon={<Shuffle className="size-3 shrink-0" aria-hidden />}
                  label={t.fertilizerFormulationRandomMix || "Random mix"}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {!awaitingInexactChoice ? (
          <>
            {finishMode === "no_filler" && result.feasible ? (
              <div className="space-y-2 rounded-xl border border-emerald-900/10 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  {t.fertilizerFormulationAdjustQuantity || "Finished quantity"}
                </p>
                <p className="text-xs leading-snug text-slate-600 dark:text-slate-300">
                  {t.fertilizerFormulationAdjustHint ||
                    "Total concentrated mix after grade adjustment. Default is 100 kg — change amount or switch to lb."}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="calc-field-label grid gap-1">
                    {t.fertilizerFormulationBatch || "Batch size"}
                    <input
                      className="calc-field-input w-28"
                      inputMode="decimal"
                      value={batchSize}
                      onChange={(event) => setBatchSize(event.target.value)}
                    />
                  </label>
                  <MenuSelect
                    label={t.fertilizerFormulationUnit || "Unit"}
                    value={unit}
                    options={[
                      ["kg", "kg"],
                      ["lb", "lb"],
                    ]}
                    onChange={(value) => setUnit(value as FormulationMassUnit)}
                    compact
                    variant="field"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    {t.fertilizerFormulationResult || "Recipe"}
                    {useRandomMix ? (
                      <span className="ml-1.5 font-semibold normal-case tracking-normal text-emerald-700/80">
                        · {t.fertilizerFormulationRandomMixTag || "random"}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-lg font-bold leading-tight text-green-950 dark-text-primary">
                    {result.feasible
                      ? result.gradeLabel
                      : t.fertilizerFormulationInfeasible ||
                        "Cannot meet this grade with the selected products"}
                  </p>
                </div>
                {result.feasible && result.estimatedCost != null ? (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      {t.fertilizerFormulationEstCost || "Estimated cost"}
                    </p>
                    <p className="text-base font-bold leading-tight text-green-950 dark-text-primary">
                      {formatMoney(result.estimatedCost, displayCurrency)}
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        {(
                          t.fertilizerFormulationPerBatchShort ||
                          "/ {amount} {unit}"
                        )
                          .replace("{amount}", String(formulaBatchSize))
                          .replace("{unit}", recipeUnitLabel)}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
              {result.feasible ? (
                <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {(
                    t.fertilizerFormulationPerBatch ||
                    "Composition per {amount} {unit} of finished formula"
                  )
                    .replace("{amount}", String(formulaBatchSize))
                    .replace("{unit}", recipeUnitLabel)}
                  {finishMode === "no_filler" || !result.exactMatch
                    ? ` · ${t.fertilizerFormulationAdjusted || "Adjusted from"} ${result.targetGrade.n || 0}-${result.targetGrade.p2o5 || 0}-${result.targetGrade.k2o || 0}`
                    : ""}
                </p>
              ) : null}
            </div>

            {result.feasible ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-emerald-800 underline"
                    onClick={() => setShowCosts((previous) => !previous)}
                  >
                    {showCosts
                      ? t.fertilizerFormulationHideCosts || "Hide costs"
                      : t.fertilizerFormulationShowCosts || "Show costs"}
                  </button>
                </div>

                {showCosts ? (
                  <div className="space-y-2 rounded-xl border border-emerald-900/10 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap items-end gap-3">
                      <MenuSelect
                        label={t.currency || "Currency"}
                        value={displayCurrency}
                        options={currencyOptions}
                        onChange={setCurrency}
                        compact
                        variant="field"
                      />
                      {result.estimatedCost != null ? (
                        <p className="text-xs font-semibold text-green-950 dark-text-primary">
                          {(t.fertilizerFormulationEstCost || "Estimated cost") +
                            `: ${formatMoney(
                              result.estimatedCost,
                              displayCurrency
                            )}`}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.fertilizerFormulationCostHint ||
                            "Enter bag prices below to estimate formulation cost."}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {usedProductLines.map((line) => {
                        const manualKey = priceManualKey(line.productKey);
                        const online = prices?.products.find(
                          (row) => row.key === line.productKey
                        );
                        const onlineBag = pricePerBagFromTonne(
                          online?.pricePerMetricTonne || 0,
                          bagKg
                        );
                        return (
                          <label
                            key={`cost-${line.productKey}`}
                            className="calc-field-label grid gap-1"
                          >
                            {`${line.label} — ${t.fertilizerPricePerBag || "Price / bag"} (${displayCurrency})`}
                            <input
                              className="calc-field-input"
                              inputMode="decimal"
                              value={manualPrices[manualKey] || ""}
                              onChange={(event) =>
                                setManualPrices((previous) => ({
                                  ...previous,
                                  [manualKey]: event.target.value,
                                }))
                              }
                              placeholder={
                                onlineBag != null
                                  ? String(onlineBag)
                                  : t.fertilizerManualPrice || "Manual price"
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-emerald-900/10 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                  <label className="calc-field-label grid min-w-[12rem] flex-1 gap-1">
                    {t.fertilizerFormulationSaveFormula ||
                      "Save formula to fertilizer lists"}
                    <input
                      className="calc-field-input"
                      value={saveFormulaName}
                      onChange={(event) =>
                        setSaveFormulaName(event.target.value)
                      }
                      placeholder={`${t.fertilizerFormulationFormulaPrefix || "Formula"} ${result.gradeLabel}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
                    onClick={handleSaveFormula}
                  >
                    {t.fertilizerFormulationSaveFormulaAction ||
                      "Save as fertilizer"}
                  </button>
                </div>
                {saveNotice ? (
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    {saveNotice}
                  </p>
                ) : null}
                <ul className="grid">
                  {result.lines.map((line, index) => {
                    const pct =
                      result.batchMassKg > 0
                        ? (line.kg / result.batchMassKg) * 100
                        : 0;
                    const mass = recipeMass(line.kg);
                    return (
                      <li
                        key={`${line.productKey}-${index}`}
                        className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-xs ${
                          index > 0
                            ? "border-t border-emerald-900/10 dark:border-white/10"
                            : "pt-0"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-green-950 dark-text-primary">
                            {line.label}
                            {line.isFiller ? (
                              <span className="ml-1 font-normal text-slate-500">
                                ·{" "}
                                {t.fertilizerFormulationFillerTag || "filler"}
                              </span>
                            ) : (
                              <span className="font-normal text-slate-500">
                                {" "}
                                · {line.analysis}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="shrink-0 text-right font-semibold text-green-950 dark-text-primary">
                          {pct.toFixed(1)}%
                          <span className="ml-2 font-normal text-slate-500">
                            {mass.toFixed(2)} {recipeUnitLabel}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap justify-between gap-2 border-t border-emerald-900/10 pt-2 text-xs dark:border-white/10">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                    {t.fertilizerFormulationTotal || "Total"}
                  </span>
                  <span className="font-bold text-green-950 dark-text-primary">
                    100.0% · {recipeMass(result.batchMassKg).toFixed(2)}{" "}
                    {recipeUnitLabel}
                  </span>
                </div>
                {finishMode === "filler" && result.fillerMassKg > 0.05 ? (
                  <p className="rounded-lg border border-emerald-900/15 bg-emerald-50/70 px-2.5 py-2 text-xs dark:border-emerald-400/20 dark:bg-emerald-950/30">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {selectedFiller.label}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {" · "}
                      {t.fertilizerFormulationFillerTag || "filler"}
                      {": "}
                      {result.fillerMassKg.toFixed(2)} kg
                      {" ("}
                      {(
                        (result.fillerMassKg /
                          Math.max(result.batchMassKg, 1)) *
                        100
                      ).toFixed(1)}
                      %{" · "}
                      {t.fertilizerFormulationFillerToReach || "to reach 100 kg"}
                      {")"}
                    </span>
                  </p>
                ) : null}
                {finishMode === "filler" && result.fillerMassKg > 0.05 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(t.fertilizerFormulationActiveMass || "Active products") +
                      `: ${result.productMassKg.toFixed(2)} kg`}
                  </p>
                ) : null}
                {finishMode === "no_filler" ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(t.fertilizerFormulationBaseMass ||
                      "Nutrient mix before concentrate") +
                      `: ${recipeMass(result.productMassKg).toFixed(2)} ${recipeUnitLabel}`}
                    {" · "}
                    {(t.fertilizerFormulationScaleFactor ||
                      "Concentrate factor") +
                      `: ${result.scaleFactor.toFixed(3)}`}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {strategy === "manual" && selectedKeys.length === 0
                    ? t.fertilizerFormulationSelectProducts ||
                      "Select at least one fertilizer to build a mix."
                    : t.fertilizerFormulationNeedTargets ||
                      "Enter a target grade greater than zero. In Select product mode, choose fertilizers that can supply those nutrients."}
                </p>
                {strategy === "manual" &&
                selectedKeys.length > 0 &&
                result.autoCanSolve ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                      onClick={switchToBestMix}
                    >
                      {t.fertilizerFormulationSwitchBestMix ||
                        "2. Switch to Best mix"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
                      onClick={switchToBestValue}
                    >
                      {t.fertilizerFormulationSwitchBestValue ||
                        "3. Switch to Best value"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </section>

      {!awaitingInexactChoice &&
      result.feasible &&
      finishMode === "filler" ? (
        <section className="calc-surface space-y-3 p-4">
          <button
            type="button"
            className="text-xs font-semibold text-emerald-800 underline"
            onClick={() => setShowBatchOptions((previous) => !previous)}
          >
            {showBatchOptions
              ? t.fertilizerFormulationHideBatch || "Hide production batch"
              : t.fertilizerFormulationShowBatch ||
                "Scale to a production batch (optional)"}
          </button>

          {showBatchOptions ? (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t.fertilizerFormulationBatchHint ||
                  "Optional. Scales the 100 kg recipe above to the amount you want to produce — it does not change the grade."}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="calc-field-label grid gap-1">
                  {t.fertilizerFormulationBatch || "Batch size"}
                  <input
                    className="calc-field-input w-28"
                    inputMode="decimal"
                    value={batchSize}
                    onChange={(event) => setBatchSize(event.target.value)}
                  />
                </label>
                <MenuSelect
                  label={t.fertilizerFormulationUnit || "Unit"}
                  value={unit}
                  options={[
                    ["kg", "kg"],
                    ["lb", "lb"],
                  ]}
                  onChange={(value) => setUnit(value as FormulationMassUnit)}
                  compact
                  variant="field"
                />
              </div>

              {productionScale > 0 ? (
                <>
                  <ul className="grid">
                    {result.lines.map((line, index) => (
                      <li
                        key={`prod-${line.productKey}-${index}`}
                        className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-xs ${
                          index > 0
                            ? "border-t border-emerald-900/10 dark:border-white/10"
                            : "pt-0"
                        }`}
                      >
                        <p className="font-semibold text-green-950 dark-text-primary">
                          {line.label}
                          {line.isFiller
                            ? ` · ${t.fertilizerFormulationFillerTag || "filler"}`
                            : ""}
                        </p>
                        <p className="font-semibold text-green-950 dark-text-primary">
                          {displayMass(line.kg, true).toFixed(2)} {unitLabel}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-emerald-900/10 pt-2 text-xs dark:border-white/10">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                      {t.fertilizerFormulationTotal || "Total"}
                    </span>
                    <span className="font-bold text-green-950 dark-text-primary">
                      {displayMass(result.batchMassKg, true).toFixed(2)}{" "}
                      {unitLabel}
                    </span>
                  </div>
                  {result.estimatedCost != null ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(t.fertilizerFormulationEstCost || "Estimated cost") +
                        `: ${formatMoney(
                          result.estimatedCost * productionScale,
                          displayCurrency
                        )}`}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  {t.fertilizerFormulationEnterBatch ||
                    "Enter a batch size greater than zero to see scaled amounts."}
                </p>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
