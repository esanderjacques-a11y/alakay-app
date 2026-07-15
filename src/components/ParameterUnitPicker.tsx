"use client";

import { canConvertLabUnit } from "@/lib/unitConversions";
import MenuSelect from "@/components/ui/MenuSelect";

function getUnitSymbolForConversion(unit: {
  unit_symbol: string;
  display_symbol?: string | null;
  canonical_symbol?: string;
}) {
  return unit.canonical_symbol || unit.unit_symbol || unit.display_symbol || "";
}

type UnitOption = {
  unit_id: number;
  unit_symbol: string;
  display_symbol: string;
  canonical_symbol?: string;
};

type Props = {
  units: UnitOption[];
  selectedUnit: UnitOption | undefined;
  selectedDisplayKey: string;
  getUnitOptionKey: (unit: UnitOption) => string;
  dedupeUnitOptions: (units: UnitOption[]) => UnitOption[];
  onChange: (unitId: number, displayKey: string) => void;
  changeUnitLabel: string;
  compact?: boolean;
  /** Text-only unit inside the value field (no chip surface). */
  embedded?: boolean;
};

export default function ParameterUnitPicker({
  units,
  selectedUnit,
  selectedDisplayKey,
  getUnitOptionKey,
  dedupeUnitOptions,
  onChange,
  changeUnitLabel,
  compact = false,
  embedded = false,
}: Props) {
  const label =
    selectedUnit?.display_symbol ||
    selectedUnit?.unit_symbol ||
    units[0]?.display_symbol ||
    units[0]?.unit_symbol ||
    "";

  if (units.length <= 1) {
    return (
      <span
        className={
          embedded
            ? "values-unit-embedded"
            : `values-unit-chip values-unit-chip--static${
                compact ? " values-unit-chip--compact" : ""
              }`
        }
        title={selectedUnit?.unit_symbol || label}
      >
        {label}
      </span>
    );
  }

  const options = dedupeUnitOptions(units).map((unit) => {
    const canConvert =
      !selectedUnit ||
      canConvertLabUnit(
        getUnitSymbolForConversion(selectedUnit),
        getUnitSymbolForConversion(unit)
      );

    return {
      value: getUnitOptionKey(unit),
      label: unit.display_symbol || unit.unit_symbol,
      description: unit.unit_symbol !== unit.display_symbol ? unit.unit_symbol : undefined,
      disabled: !canConvert,
    };
  });

  return (
    <MenuSelect
      heading={changeUnitLabel}
      value={selectedDisplayKey}
      options={options}
      variant="chip"
      plainChip={embedded}
      compact={compact}
      onChange={(nextKey) => {
        const unit = units.find((option) => getUnitOptionKey(option) === nextKey);
        if (!unit) return;
        onChange(unit.unit_id, getUnitOptionKey(unit));
      }}
    />
  );
}
