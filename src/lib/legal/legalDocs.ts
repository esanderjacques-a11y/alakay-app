import type { Language } from "@/lib/i18n";

export type LegalDocId = "terms" | "privacy" | "responsible";

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  updated: string;
  sections: Array<{ heading: string; body: string }>;
};

type LegalPack = Record<LegalDocId, LegalDoc>;

const en: LegalPack = {
  terms: {
    id: "terms",
    title: "Terms of use",
    updated: "2026-07-27",
    sections: [
      {
        heading: "What CULTOSOL is",
        body: "CULTOSOL helps interpret soil, foliar, and water lab results and plan agronomic actions. It is a decision-support tool, not a substitute for a licensed agronomist, laboratory quality control, or local regulations.",
      },
      {
        heading: "Your account",
        body: "You must provide accurate registration information, keep your password confidential, and confirm your email when required. You are responsible for activity under your account.",
      },
      {
        heading: "Acceptable use",
        body: "Do not misuse the service, attempt unauthorized access, scrape or overload systems, upload unlawful content, or use CULTOSOL to harm people, crops, or the environment through reckless recommendations.",
      },
      {
        heading: "Data and reports",
        body: "Analyses, farms, and reports you save belong to you within the product. We may process them to provide sync, history, and support features. Export or delete options depend on the tools available in your account.",
      },
      {
        heading: "Availability",
        body: "We aim for reliable service but do not guarantee uninterrupted uptime. Features may change as CULTOSOL improves.",
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy policy",
    updated: "2026-07-27",
    sections: [
      {
        heading: "Data we collect",
        body: "Account data (name, email, profession, country), authentication metadata, profile preferences, and agronomic content you enter (lab values, farms, lots, reports). Technical logs may include device/browser and error diagnostics.",
      },
      {
        heading: "How we use data",
        body: "To create and secure your account, sync your work, improve CULTOSOL, provide support, and—only if you opt in—send product updates and agricultural information by email.",
      },
      {
        heading: "Processors",
        body: "We use infrastructure providers such as hosting and authentication/database services to operate CULTOSOL. They process data only to provide those services.",
      },
      {
        heading: "Retention and rights",
        body: "We keep account and analysis data while your account is active or as needed for security and legal obligations. You may request access, correction, or deletion of personal data by contacting CULTOSOL support from your registered email.",
      },
      {
        heading: "Contact",
        body: "Privacy questions: cultosolht@gmail.com",
      },
    ],
  },
  responsible: {
    id: "responsible",
    title: "Responsible use",
    updated: "2026-07-27",
    sections: [
      {
        heading: "Agronomic judgment",
        body: "Always verify extractants, units, crop context, and local recommendations before applying fertilizers, amendments, or irrigation changes. CULTOSOL outputs are references, not prescriptions.",
      },
      {
        heading: "Safety",
        body: "Follow product labels, PPE requirements, and environmental rules. High rates of lime, gypsum, salts, or fertilizers can damage crops and soil if applied incorrectly.",
      },
      {
        heading: "Shared responsibility",
        body: "You remain responsible for field decisions. CULTOSOL and its authors are not liable for yield loss, crop damage, or regulatory outcomes from actions taken after using the app.",
      },
    ],
  },
};

const es: LegalPack = {
  terms: {
    id: "terms",
    title: "Términos de uso",
    updated: "2026-07-27",
    sections: [
      {
        heading: "Qué es CULTOSOL",
        body: "CULTOSOL ayuda a interpretar análisis de suelo, foliar y agua y a planificar acciones agronómicas. Es una herramienta de apoyo a la decisión; no reemplaza a un agrónomo colegiado, el control de calidad del laboratorio ni la normativa local.",
      },
      {
        heading: "Tu cuenta",
        body: "Debes registrar datos veraces, proteger tu contraseña y confirmar tu correo cuando se solicite. Eres responsable de la actividad realizada con tu cuenta.",
      },
      {
        heading: "Uso aceptable",
        body: "No abuses del servicio, no intentes accesos no autorizados, no satures ni extraigas datos de forma indebida, ni uses CULTOSOL para dañar personas, cultivos o el ambiente con recomendaciones imprudentes.",
      },
      {
        heading: "Datos y reportes",
        body: "Los análisis, fincas y reportes que guardes te pertenecen dentro del producto. Podemos procesarlos para sincronización, historial y soporte. La exportación o eliminación depende de las opciones de tu cuenta.",
      },
      {
        heading: "Disponibilidad",
        body: "Buscamos un servicio estable, pero no garantizamos disponibilidad continua. Las funciones pueden evolucionar con CULTOSOL.",
      },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Política de privacidad",
    updated: "2026-07-27",
    sections: [
      {
        heading: "Datos que recopilamos",
        body: "Datos de cuenta (nombre, correo, profesión, país), metadatos de autenticación, preferencias de perfil y contenido agronómico que ingresas (valores de laboratorio, fincas, lotes, reportes). Los registros técnicos pueden incluir dispositivo/navegador y diagnósticos de error.",
      },
      {
        heading: "Cómo usamos los datos",
        body: "Para crear y proteger tu cuenta, sincronizar tu trabajo, mejorar CULTOSOL, dar soporte y—solo si aceptas—enviar actualizaciones del producto e información agrícola por correo.",
      },
      {
        heading: "Proveedores",
        body: "Usamos servicios de infraestructura (alojamiento, autenticación/base de datos) para operar CULTOSOL. Procesan datos solo para prestar esos servicios.",
      },
      {
        heading: "Conservación y derechos",
        body: "Conservamos datos de cuenta y análisis mientras la cuenta esté activa o según obligaciones legales. Puedes solicitar acceso, corrección o eliminación escribiendo a soporte CULTOSOL desde tu correo registrado.",
      },
      {
        heading: "Contacto",
        body: "Privacidad: cultosolht@gmail.com",
      },
    ],
  },
  responsible: {
    id: "responsible",
    title: "Uso responsable",
    updated: "2026-07-27",
    sections: [
      {
        heading: "Criterio agronómico",
        body: "Verifica siempre extractantes, unidades, contexto del cultivo y recomendaciones locales antes de aplicar fertilizantes, enmiendas o cambios de riego. Los resultados de CULTOSOL son referencias, no recetas.",
      },
      {
        heading: "Seguridad",
        body: "Sigue etiquetas de producto, EPP y normas ambientales. Dosis altas de cal, yeso, sales o fertilizantes pueden dañar cultivo y suelo si se aplican mal.",
      },
      {
        heading: "Responsabilidad compartida",
        body: "Tú decides en campo. CULTOSOL y sus autores no responden por pérdidas de rendimiento, daños al cultivo ni incumplimientos normativos derivados del uso de la app.",
      },
    ],
  },
};

const packs: Partial<Record<Language, LegalPack>> = {
  en,
  es,
  fr: en,
  ht: es,
  pt: en,
  sw: en,
};

export function getLegalDoc(language: Language, id: LegalDocId): LegalDoc {
  const pack = packs[language] || en;
  return pack[id] || en[id];
}
