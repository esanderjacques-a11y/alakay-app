"use client";

import { Camera, ChevronRight, FileText } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import type { Translation } from "@/lib/translations";

type Props = {
  t: Translation;
  onBack: () => void;
  onImportDocument: () => void;
  onTakePhoto: () => void;
};

export default function ImportDataScreen({
  t,
  onBack,
  onImportDocument,
  onTakePhoto,
}: Props) {
  const options = [
    {
      icon: <FileText size={20} />,
      title: t.importDocument,
      desc: t.importDocumentShort,
      onClick: onImportDocument,
    },
    {
      icon: <Camera size={20} />,
      title: t.takePhoto,
      desc: t.takePhotoShort,
      onClick: onTakePhoto,
    },
  ];

  return (
    <section className="import-data-screen animate-slide-up">
      <div className="import-data-screen__inner">
        <div className="import-data-screen__header">
          <BackButton onClick={onBack} label={t.home} />
        </div>

        <div className="import-data-screen__intro">
          <h2 className="import-data-screen__title">{t.importData}</h2>
          <p className="import-data-screen__desc">{t.importDataDesc}</p>
        </div>

        <div className="import-data-screen__options">
          {options.map((opt) => (
            <button
              key={opt.title}
              type="button"
              onClick={opt.onClick}
              className="import-data-option"
            >
              <span className="import-data-option__icon">{opt.icon}</span>
              <span className="import-data-option__copy">
                <span className="import-data-option__title">{opt.title}</span>
                <span className="import-data-option__desc">{opt.desc}</span>
              </span>
              <ChevronRight size={16} className="import-data-option__chevron" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
