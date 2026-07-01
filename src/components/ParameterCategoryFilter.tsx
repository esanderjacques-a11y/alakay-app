"use client";

import { translateCategory } from "@/lib/categoryLabels";
import type { Language } from "@/lib/translations";
import { translations } from "@/lib/translations";

type Props = {
  categories: string[];
  selectedCategory: string;
  onChange: (category: string) => void;
  language: Language;
  allLabel: string;
};

export default function ParameterCategoryFilter({
  categories,
  selectedCategory,
  onChange,
  language,
  allLabel,
}: Props) {
  const items = ["All", ...categories];

  function labelFor(category: string) {
    if (category === "All") return allLabel;
    return translateCategory(category, language, translations);
  }

  return (
    <div className="app-scroll-x flex gap-1.5 pb-1">
      {items.map((category) => {
        const active = selectedCategory === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={`values-category-chip ${
              category === "All" ? "values-category-chip--pinned" : ""
            } ${active ? "values-category-chip--active" : ""}`}
          >
            {labelFor(category)}
          </button>
        );
      })}
    </div>
  );
}
