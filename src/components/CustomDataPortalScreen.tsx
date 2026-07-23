"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Beaker, RefreshCw, Ruler, Sprout } from "lucide-react";

import CustomFertilizerManager from "@/components/CustomFertilizerManager";
import CustomParameterManager from "@/components/CustomParameterManager";
import CustomRangeManager from "@/components/CustomRangeManager";
import BackButton from "@/components/ui/BackButton";
import { StickyPageTitle } from "@/components/ui/StickyPageTitle";
import { loadCustomFertilizers } from "@/lib/fertilizerCatalog";
import { supabase } from "@/lib/supabase";
import type { Language, Translation } from "@/lib/translations";

type TabId = "parameters" | "ranges" | "fertilizers";

type Props = {
  t: Translation;
  language: Language;
  session: Session | null;
  sampleType: "soil" | "foliar";
  currentCropId: number | "";
  onBack: () => void;
  onChanged: () => void;
};

export default function CustomDataPortalScreen({
  t,
  language,
  session,
  sampleType,
  currentCropId,
  onBack,
  onChanged,
}: Props) {
  const labels = t.customDataPortal;
  const [tab, setTab] = useState<TabId>(
    session?.user ? "parameters" : "fertilizers"
  );
  const [parameterCount, setParameterCount] = useState(0);
  const [rangeCount, setRangeCount] = useState(0);
  const [fertilizerCount, setFertilizerCount] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const flatT = useMemo(() => {
    const portal = labels || {};
    return {
      ...Object.fromEntries(
        Object.entries(t).filter(([, value]) => typeof value === "string")
      ),
      customDataFertilizers: portal.fertilizers,
      customDataFertilizersDesc: portal.fertilizersDesc,
      customDataFertilizerCount: portal.fertilizerCount,
      customDataFertilizerEmpty: portal.fertilizerEmpty,
      customDataFertilizerSaved: portal.fertilizerSaved,
      customDataFertilizerDeleted: portal.fertilizerDeleted,
      customDataFertilizerDeleteConfirm: portal.fertilizerDeleteConfirm,
      customDataRefresh: portal.refresh,
      customDataEdit: portal.edit,
      customDataDelete: portal.delete,
      customDataClose: portal.close,
      fertilizerAddProduct: portal.addFertilizer,
      fertilizerAddProductTitle: portal.addFertilizer,
      fertilizerEditProductTitle: portal.editFertilizer,
      fertilizerAddProductSave: portal.saveFertilizer,
      fertilizerAddProductCancel: portal.cancel,
      fertilizerAddName: portal.fertilizerName,
      fertilizerAddNamePlaceholder: portal.fertilizerNamePlaceholder,
      fertilizerAddNameRequired: portal.fertilizerNameRequired,
      fertilizerAddGradeRequired: portal.fertilizerGradeRequired,
    } as Record<string, string>;
  }, [t, labels]);

  async function refreshCounts() {
    setLoadingCounts(true);
    setFertilizerCount(loadCustomFertilizers().length);

    if (!session?.user) {
      setParameterCount(0);
      setRangeCount(0);
      setLoadingCounts(false);
      return;
    }

    const [parametersResponse, rangesResponse] = await Promise.all([
      supabase
        .from("user_custom_parameters")
        .select("custom_parameter_id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("is_deleted", false),
      supabase
        .from("user_custom_ranges")
        .select("custom_range_id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("is_deleted", false),
    ]);

    setParameterCount(parametersResponse.count || 0);
    setRangeCount(rangesResponse.count || 0);
    setLoadingCounts(false);
  }

  useEffect(() => {
    void refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  function handleChanged() {
    void refreshCounts();
    onChanged();
  }

  const tabs: Array<{
    id: TabId;
    label: string;
    count: number;
    icon: ReactNode;
  }> = [
    {
      id: "parameters",
      label: labels.parameters,
      count: parameterCount,
      icon: <Beaker size={16} />,
    },
    {
      id: "ranges",
      label: labels.ranges,
      count: rangeCount,
      icon: <Ruler size={16} />,
    },
    {
      id: "fertilizers",
      label: labels.fertilizers,
      count: fertilizerCount,
      icon: <Sprout size={16} />,
    },
  ];

  return (
    <section className="animate-slide-up custom-data-portal">
      <div className="values-screen-panel values-screen-panel--open px-0 pb-6 pt-0">
        <div>
          <StickyPageTitle className="page-title-row items-center">
            <BackButton variant="icon" onClick={onBack} label={t.home} />
            <div className="page-title-row__title min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {t.dataTools}
              </p>
              <h1 className="text-xl font-extrabold leading-tight text-green-950 dark-text-primary sm:text-2xl">
                {labels.title}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void refreshCounts()}
              className="page-title-row__spacer inline-flex size-9 items-center justify-center rounded-xl border border-emerald-900/10 bg-white/70 text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              aria-label={labels.refresh}
              title={labels.refresh}
            >
              <RefreshCw
                size={16}
                className={loadingCounts ? "animate-spin" : undefined}
              />
            </button>
          </StickyPageTitle>
        </div>

        <div className="custom-data-portal__body mt-3">
          <nav
            className="settings-nav custom-data-portal__nav"
            aria-label={labels.title}
            style={
              {
                "--settings-nav-count": tabs.length,
              } as CSSProperties
            }
          >
            {tabs.map((item) => {
              const active = tab === item.id;
              const locked =
                !session?.user &&
                (item.id === "parameters" || item.id === "ranges");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`settings-nav__item${active ? " is-active" : ""}${
                    locked ? " opacity-70" : ""
                  }`}
                >
                  {item.icon}
                  <span>
                    {item.label}{" "}
                    <span className="settings-nav__count">{item.count}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="custom-data-portal__panel mt-3">
            {tab === "parameters" ? (
              session?.user ? (
                <CustomParameterManager
                  open
                  embedded
                  onClose={onBack}
                  onChanged={handleChanged}
                  session={session}
                  language={language}
                  sampleType={sampleType}
                />
              ) : (
                <p className="custom-data-portal__empty">{labels.loginRequired}</p>
              )
            ) : null}

            {tab === "ranges" ? (
              session?.user ? (
                <CustomRangeManager
                  open
                  embedded
                  onClose={onBack}
                  onChanged={handleChanged}
                  session={session}
                  language={language}
                  sampleType={sampleType}
                  currentCropId={currentCropId}
                />
              ) : (
                <p className="custom-data-portal__empty">{labels.loginRequired}</p>
              )
            ) : null}

            {tab === "fertilizers" ? (
              <CustomFertilizerManager
                open
                embedded
                onClose={onBack}
                onChanged={handleChanged}
                t={flatT}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
