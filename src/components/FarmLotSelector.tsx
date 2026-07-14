"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import MenuSelect from "@/components/ui/MenuSelect";
import { supabase } from "@/lib/supabase";
import { parseLotNames } from "@/lib/farmLots";

type Farm = {
  farm_id: number;
  farm_name: string;
  location: string | null;
};

type Lot = {
  lot_id: number;
  lot_name: string;
  area: number | null;
  area_unit: string | null;
};

type Props = {
  userId?: string | null;
  farmName: string;
  onFarmNameChange: (value: string) => void;
  lotNames: string;
  onLotNamesChange: (value: string) => void;
  labels: {
    farm: string;
    lots: string;
    selectFarm?: string;
    newFarm?: string;
    addLot?: string;
    noLots?: string;
  };
};

export default function FarmLotSelector({
  userId,
  farmName,
  onFarmNameChange,
  lotNames,
  onLotNamesChange,
  labels,
}: Props) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotDraft, setLotDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedFarm = useMemo(
    () =>
      farms.find(
        (farm) =>
          farm.farm_name.trim().toLocaleLowerCase() ===
          farmName.trim().toLocaleLowerCase()
      ) || null,
    [farms, farmName]
  );
  const selectedLots = useMemo(() => parseLotNames(lotNames), [lotNames]);

  useEffect(() => {
    if (!userId) {
      setFarms([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from("farms")
          .select("farm_id, farm_name, location")
          .eq("user_id", userId)
          .order("farm_name");
        if (!cancelled) setFarms((data || []) as Farm[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedFarm) {
      setLots([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("lots")
      .select("lot_id, lot_name, area, area_unit")
      .eq("farm_id", selectedFarm.farm_id)
      .order("lot_name")
      .then(({ data }) => {
        if (!cancelled) setLots((data || []) as Lot[]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFarm]);

  function setSelectedLots(next: string[]) {
    onLotNamesChange([...new Set(next.map((name) => name.trim()).filter(Boolean))].join(", "));
  }

  function toggleLot(name: string) {
    const exists = selectedLots.some(
      (item) => item.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    setSelectedLots(
      exists
        ? selectedLots.filter(
            (item) => item.toLocaleLowerCase() !== name.toLocaleLowerCase()
          )
        : [...selectedLots, name]
    );
  }

  function addLot() {
    const names = parseLotNames(lotDraft);
    if (names.length === 0) return;
    setSelectedLots([...selectedLots, ...names]);
    setLotDraft("");
  }

  const farmValue = selectedFarm ? String(selectedFarm.farm_id) : "__new";
  const farmOptions: Array<[string, string]> = [
    ["__new", labels.newFarm || "New farm"],
    ...farms.map((farm) => [String(farm.farm_id), farm.farm_name] as [string, string]),
  ];

  return (
    <div className="grid gap-3 py-2">
      {userId && farms.length > 0 ? (
        <MenuSelect
          label={labels.selectFarm || labels.farm}
          value={farmValue}
          options={farmOptions}
          onChange={(value) => {
            const farm = farms.find((item) => String(item.farm_id) === value);
            onFarmNameChange(farm?.farm_name || "");
            onLotNamesChange("");
          }}
          fullWidth
          variant="field"
          disabled={loading}
        />
      ) : null}

      {!selectedFarm ? (
        <label className="calc-field-label grid gap-1">
          {labels.farm}
          <input
            className="calc-field-input"
            value={farmName}
            onChange={(event) => {
              onFarmNameChange(event.target.value);
              onLotNamesChange("");
            }}
            placeholder={labels.newFarm || "New farm"}
          />
        </label>
      ) : null}

      {lots.length > 0 ? (
        <div className="grid gap-2">
          <span className="calc-field-label">{labels.lots}</span>
          <div className="flex flex-wrap gap-2">
            {lots.map((lot) => {
              const active = selectedLots.some(
                (name) =>
                  name.toLocaleLowerCase() === lot.lot_name.toLocaleLowerCase()
              );
              return (
                <button
                  key={lot.lot_id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLot(lot.lot_name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-emerald-900/15 bg-white/70 text-green-950"
                  }`}
                >
                  {lot.lot_name}
                  {lot.area ? ` · ${lot.area} ${lot.area_unit || "ha"}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : selectedFarm ? (
        <p className="text-xs text-slate-500">
          {labels.noLots || "No saved lots for this farm yet."}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="calc-field-label grid gap-1">
          {labels.addLot || labels.lots}
          <input
            className="calc-field-input"
            value={lotDraft}
            onChange={(event) => setLotDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== ",") return;
              event.preventDefault();
              addLot();
            }}
            placeholder={labels.addLot || "Add lot"}
          />
        </label>
        <button
          type="button"
          onClick={addLot}
          disabled={!lotDraft.trim()}
          className="mt-5 grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"
          aria-label={labels.addLot || "Add lot"}
        >
          <Plus size={17} />
        </button>
      </div>

      {selectedLots.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedLots.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900"
            >
              {name}
              <button
                type="button"
                onClick={() => toggleLot(name)}
                aria-label={`Remove ${name}`}
                className="rounded-full p-0.5 hover:bg-emerald-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

