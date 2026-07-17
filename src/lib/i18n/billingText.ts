import type { Language } from "@/lib/i18n";

export type BillingText = {
  menu: string;
  title: string;
  intro: string;
  verificationTitle: string;
  adminTitle: string;
  tabs: {
    overview: string;
    licenses: string;
    ai: string;
    compare: string;
    payments: string;
    invoices: string;
  };
  softwareLicense: string;
  currentLicense: string;
  purchaseDate: string;
  licenseStatus: string;
  upgradeLicense: string;
  lifetime: string;
  aiSubscription: string;
  aiStatus: string;
  monthlyCost: string;
  renewalDate: string;
  monthlyUsage: string;
  remainingAi: string;
  manageAi: string;
  subscribe: string;
  purchaseLifetime: string;
  currentPlan: string;
  mostPopular: string;
  oneTimePurchase: string;
  everythingInFree: string;
  everythingInPlus: string;
  aiIncluded: string;
  aiAllowanceNote: string;
  aiSectionTitle: string;
  aiSectionDesc: string;
  aiFairUseNote: string;
  questionsUsed: string;
  questionsRemaining: string;
  resetDate: string;
  aiLimitReached: string;
  upgradeAi: string;
  waitUntilReset: string;
  featureComparison: string;
  paymentMethods: string;
  paymentProvidersNote: string;
  addPayment: string;
  invoiceHistory: string;
  downloadInvoice: string;
  emptyInvoices: string;
  emptyInvoicesDesc: string;
  emptyPayments: string;
  emptyPaymentsDesc: string;
  checkoutMock: string;
  checkoutSuccess: string;
  loading: string;
  error: string;
  guestNotice: string;
  cancelAi: string;
  resumeAi: string;
  active: string;
  cancelled: string;
  none: string;
  unlimitedFairUse: string;
  notifications: string;
  applicationPending: string;
  applicationApproved: string;
  applicationRejected: string;
  haitiProgram: string;
  haitiProgramDesc: string;
  haitiProgramBenefit: string;
  earthProgram: string;
  earthProgramDesc: string;
  earthProgramBenefit: string;
  applyNow: string;
  fullName: string;
  email: string;
  country: string;
  institution: string;
  studentId: string;
  message: string;
  submitApplication: string;
  licenses: Record<string, { name: string; subtitle: string; price: string }>;
  features: Record<string, string>;
  admin: {
    softwarePrices: string;
    aiPrice: string;
    aiMonthlyLimit: string;
    freeAiTrial: string;
    lifetimeDiscount: string;
    plusIncludedAi: string;
    proIncludedAi: string;
    freeIncludedAi: string;
    save: string;
    saved: string;
  };
};

const en: BillingText = {
  menu: "Billing",
  title: "Billing",
  intro: "Manage your license, AI subscription, and payment history.",
  verificationTitle: "Verification",
  adminTitle: "Billing Admin",
  tabs: {
    overview: "Overview",
    licenses: "Licenses",
    ai: "AI Assistant",
    compare: "Compare",
    payments: "Payments",
    invoices: "Invoices",
  },
  softwareLicense: "Software License",
  currentLicense: "Current License",
  purchaseDate: "Purchase Date",
  licenseStatus: "License Status",
  upgradeLicense: "Upgrade License",
  lifetime: "Lifetime",
  aiSubscription: "AI Subscription",
  aiStatus: "Status",
  monthlyCost: "Monthly Cost",
  renewalDate: "Renewal Date",
  monthlyUsage: "Monthly Usage",
  remainingAi: "Remaining AI Questions",
  manageAi: "Manage Subscription",
  subscribe: "Subscribe",
  purchaseLifetime: "Purchase Lifetime",
  currentPlan: "Current Plan",
  mostPopular: "Most Popular",
  oneTimePurchase: "One-Time Purchase",
  everythingInFree: "Everything in Free, plus",
  everythingInPlus: "Everything in Plus, plus",
  aiIncluded: "AI included",
  aiAllowanceNote: "Additional AI requires the AI Subscription.",
  aiSectionTitle: "AI Assistant",
  aiSectionDesc:
    "The AI Assistant uses external models with ongoing costs. AI is optional and independent from your software license.",
  aiFairUseNote: "Subject to fair use (admin-configurable monthly limit).",
  questionsUsed: "Questions Used",
  questionsRemaining: "Questions Remaining",
  resetDate: "Reset Date",
  aiLimitReached: "You have reached your included AI usage.",
  upgradeAi: "Upgrade AI",
  waitUntilReset: "Wait Until Reset",
  featureComparison: "Feature Comparison",
  paymentMethods: "Payment Methods",
  paymentProvidersNote: "Future integration: Paddle, PayPal, 2Checkout (mock checkout for now).",
  addPayment: "Add Payment Method",
  invoiceHistory: "Invoice History",
  downloadInvoice: "Download",
  emptyInvoices: "No invoices yet",
  emptyInvoicesDesc: "License and AI invoices will appear here after checkout.",
  emptyPayments: "No payment methods",
  emptyPaymentsDesc: "Add a payment method when checkout goes live.",
  checkoutMock: "Mock checkout — no charge. License activates instantly.",
  checkoutSuccess: "Purchase complete!",
  loading: "Loading billing…",
  error: "Could not load billing.",
  guestNotice: "Sign in to manage licenses and AI subscription.",
  cancelAi: "Cancel AI",
  resumeAi: "Resume AI",
  active: "Active",
  cancelled: "Cancelled",
  none: "None",
  unlimitedFairUse: "Fair use",
  notifications: "Notifications",
  applicationPending: "Application pending review",
  applicationApproved: "Verified — benefits active",
  applicationRejected: "Application not approved",
  haitiProgram: "Haiti Farmer Program",
  haitiProgramDesc: "Verified farmers in Haiti receive extended Free access.",
  haitiProgramBenefit: "Free tier with verified badge and program support.",
  earthProgram: "EARTH University Program",
  earthProgramDesc: "Students and alumni at EARTH University.",
  earthProgramBenefit: "Plus-level limits while your verification is active.",
  applyNow: "Apply now",
  fullName: "Full name",
  email: "Email",
  country: "Country",
  institution: "Institution",
  studentId: "Student ID",
  message: "Message (optional)",
  submitApplication: "Submit application",
  licenses: {
    free: { name: "Free", subtitle: "Perfect for individual farmers.", price: "FREE" },
    plus: { name: "Plus", subtitle: "Personal Edition", price: "$15 USD" },
    pro: { name: "Pro", subtitle: "Professional Edition", price: "$30 USD" },
  },
  features: {
    soilInterpretation: "Soil Interpretation",
    foliarInterpretation: "Foliar Interpretation",
    waterInterpretation: "Water Interpretation",
    manualLabInput: "Manual Lab Input",
    cicBases: "CEC / Bases",
    nutritionalPlan: "Nutritional Plan",
    fertilizerRecommendation: "Fertilizer Recommendation",
    applicationCalendar: "Calendar",
    graphs: "Graphs",
    farmManagement: "Farm Management",
    inventory: "Inventory",
    historicalComparison: "Historical Comparison",
    clientManagement: "Client Management",
    whiteLabelReports: "White-label Reports",
    aiIncluded: "AI Included",
    additionalAiAvailable: "Additional AI Available",
    support: "Support",
  },
  admin: {
    softwarePrices: "Software prices (USD cents)",
    aiPrice: "AI monthly price (USD cents)",
    aiMonthlyLimit: "AI fair-use monthly limit",
    freeAiTrial: "Free tier AI trial",
    lifetimeDiscount: "Lifetime discount (%)",
    plusIncludedAi: "Plus included AI / month",
    proIncludedAi: "Pro included AI / month",
    freeIncludedAi: "Free included AI / month",
    save: "Save configuration",
    saved: "Configuration saved.",
  },
};

const es: BillingText = {
  ...en,
  menu: "Facturación",
  title: "Facturación",
  intro: "Administra tu licencia, suscripción de IA e historial de pagos.",
  verificationTitle: "Verificación",
  adminTitle: "Admin Facturación",
  tabs: {
    overview: "Resumen",
    licenses: "Licencias",
    ai: "Asistente IA",
    compare: "Comparar",
    payments: "Pagos",
    invoices: "Facturas",
  },
  softwareLicense: "Licencia de software",
  currentLicense: "Licencia actual",
  purchaseDate: "Fecha de compra",
  licenseStatus: "Estado de licencia",
  upgradeLicense: "Mejorar licencia",
  lifetime: "De por vida",
  aiSubscription: "Suscripción IA",
  aiStatus: "Estado",
  monthlyCost: "Costo mensual",
  renewalDate: "Renovación",
  monthlyUsage: "Uso mensual",
  remainingAi: "Preguntas IA restantes",
  manageAi: "Administrar suscripción",
  subscribe: "Suscribirse",
  purchaseLifetime: "Comprar de por vida",
  currentPlan: "Plan actual",
  mostPopular: "Más popular",
  oneTimePurchase: "Compra única",
  everythingInFree: "Todo lo de Free, más",
  everythingInPlus: "Todo lo de Plus, más",
  aiIncluded: "IA incluida",
  aiAllowanceNote: "IA adicional requiere la suscripción IA.",
  aiSectionTitle: "Asistente IA",
  aiSectionDesc:
    "El asistente IA usa modelos externos con costos continuos. Es opcional e independiente de tu licencia.",
  aiFairUseNote: "Sujeto a uso justo (límite mensual configurable).",
  questionsUsed: "Preguntas usadas",
  questionsRemaining: "Preguntas restantes",
  resetDate: "Fecha de reinicio",
  aiLimitReached: "Has alcanzado tu uso de IA incluido.",
  upgradeAi: "Mejorar IA",
  waitUntilReset: "Esperar reinicio",
  featureComparison: "Comparación de funciones",
  paymentMethods: "Métodos de pago",
  paymentProvidersNote: "Integración futura: Paddle, PayPal, 2Checkout (checkout simulado).",
  addPayment: "Agregar método de pago",
  invoiceHistory: "Historial de facturas",
  downloadInvoice: "Descargar",
  emptyInvoices: "Sin facturas aún",
  emptyInvoicesDesc: "Las facturas aparecerán aquí después del checkout.",
  emptyPayments: "Sin métodos de pago",
  emptyPaymentsDesc: "Agrega un método cuando el checkout esté activo.",
  checkoutMock: "Checkout simulado — sin cargo. La licencia se activa al instante.",
  checkoutSuccess: "¡Compra completada!",
  loading: "Cargando facturación…",
  error: "No se pudo cargar la facturación.",
  guestNotice: "Inicia sesión para administrar licencias y suscripción IA.",
  cancelAi: "Cancelar IA",
  resumeAi: "Reanudar IA",
  active: "Activa",
  cancelled: "Cancelada",
  none: "Ninguna",
  unlimitedFairUse: "Uso justo",
  notifications: "Notificaciones",
  applicationPending: "Solicitud en revisión",
  applicationApproved: "Verificado — beneficios activos",
  applicationRejected: "Solicitud no aprobada",
  haitiProgram: "Programa Agricultor Haití",
  haitiProgramDesc: "Agricultores verificados en Haití reciben acceso Free extendido.",
  haitiProgramBenefit: "Plan Free con insignia verificada y apoyo del programa.",
  earthProgram: "Programa EARTH University",
  earthProgramDesc: "Estudiantes y egresados de EARTH University.",
  earthProgramBenefit: "Límites tipo Plus mientras tu verificación esté activa.",
  applyNow: "Solicitar",
  fullName: "Nombre completo",
  email: "Correo",
  country: "País",
  institution: "Institución",
  studentId: "ID de estudiante",
  message: "Mensaje (opcional)",
  submitApplication: "Enviar solicitud",
  licenses: {
    free: { name: "Free", subtitle: "Perfecto para agricultores individuales.", price: "GRATIS" },
    plus: { name: "Plus", subtitle: "Edición Personal", price: "$15 USD" },
    pro: { name: "Pro", subtitle: "Edición Profesional", price: "$30 USD" },
  },
  features: { ...en.features },
  admin: {
    softwarePrices: "Precios software (centavos USD)",
    aiPrice: "Precio mensual IA (centavos USD)",
    aiMonthlyLimit: "Límite mensual IA (uso justo)",
    freeAiTrial: "Prueba IA plan Free",
    lifetimeDiscount: "Descuento lifetime (%)",
    plusIncludedAi: "IA incluida Plus / mes",
    proIncludedAi: "IA incluida Pro / mes",
    freeIncludedAi: "IA incluida Free / mes",
    save: "Guardar configuración",
    saved: "Configuración guardada.",
  },
};

export const billingText: Record<Language, BillingText> = {
  en,
  es,
  fr: en,
  ht: es,
  pt: en,
  sw: en,
};

export function getBillingText(language: Language): BillingText {
  return billingText[language] || billingText.en;
}
