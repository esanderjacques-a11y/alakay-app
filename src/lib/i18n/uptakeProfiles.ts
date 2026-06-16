import type { Language } from "./index";

export type UptakeStage = {
  label: string;
  timing: string;
  uptake: number;
  focus: string[];
  note: string;
};

export type UptakeProfile = {
  key: string;
  title: string;
  pattern: "vegetative" | "fruiting" | "storage" | "perennial";
  stages: UptakeStage[];
  nutrients: Array<{ symbol: string; timing: string; note: string }>;
};

type ProfileText = {
  title: string;
  stages: Array<{ label: string; timing: string; note: string }>;
  nutrients: Array<{ timing: string; note: string }>;
};

const UPTAKE_STRUCTURE = [
  {
    key: "banana",
    pattern: "perennial" as const,
    stages: [
      { uptake: 8, focus: ["P", "Ca", "Zn"] },
      { uptake: 34, focus: ["N", "K", "Mg"] },
      { uptake: 68, focus: ["K", "N", "B"] },
      { uptake: 92, focus: ["K", "Ca", "Mg"] },
      { uptake: 100, focus: ["K", "N"] },
    ],
    nutrients: [{ symbol: "K" }, { symbol: "N" }, { symbol: "Ca, Mg, B" }],
  },
  {
    key: "fruiting-vegetable",
    pattern: "fruiting" as const,
    stages: [
      { uptake: 6, focus: ["P", "Ca"] },
      { uptake: 28, focus: ["N", "Mg"] },
      { uptake: 55, focus: ["K", "Ca", "B"] },
      { uptake: 82, focus: ["K", "Ca", "N"] },
      { uptake: 100, focus: ["K", "Ca"] },
    ],
    nutrients: [{ symbol: "K" }, { symbol: "Ca" }, { symbol: "B, Zn" }],
  },
  {
    key: "cassava",
    pattern: "storage" as const,
    stages: [
      { uptake: 5, focus: ["P", "Zn"] },
      { uptake: 28, focus: ["N", "Mg"] },
      { uptake: 70, focus: ["K", "Ca"] },
      { uptake: 92, focus: ["K", "B"] },
      { uptake: 100, focus: ["K"] },
    ],
    nutrients: [{ symbol: "K" }, { symbol: "N" }, { symbol: "P, Zn" }],
  },
  {
    key: "grain-legume",
    pattern: "fruiting" as const,
    stages: [
      { uptake: 5, focus: ["P", "Ca"] },
      { uptake: 26, focus: ["P", "Mo", "Mg"] },
      { uptake: 55, focus: ["K", "B"] },
      { uptake: 88, focus: ["K", "Ca"] },
      { uptake: 100, focus: ["K"] },
    ],
    nutrients: [{ symbol: "P" }, { symbol: "K" }, { symbol: "Mo, B" }],
  },
  {
    key: "grain",
    pattern: "vegetative" as const,
    stages: [
      { uptake: 4, focus: ["P", "Zn"] },
      { uptake: 35, focus: ["N", "K"] },
      { uptake: 68, focus: ["N", "K", "B"] },
      { uptake: 92, focus: ["K", "Mg"] },
      { uptake: 100, focus: ["K"] },
    ],
    nutrients: [{ symbol: "N" }, { symbol: "P, Zn" }, { symbol: "K, Mg" }],
  },
  {
    key: "perennial-fruit",
    pattern: "perennial" as const,
    stages: [
      { uptake: 12, focus: ["N", "K"] },
      { uptake: 32, focus: ["N", "Mg", "Zn"] },
      { uptake: 55, focus: ["B", "Ca", "P"] },
      { uptake: 86, focus: ["K", "Ca"] },
      { uptake: 100, focus: ["K"] },
    ],
    nutrients: [{ symbol: "B, Zn" }, { symbol: "K, Ca" }, { symbol: "N" }],
  },
  {
    key: "general",
    pattern: "vegetative" as const,
    stages: [
      { uptake: 6, focus: ["P", "Ca", "Zn"] },
      { uptake: 30, focus: ["N", "Mg"] },
      { uptake: 58, focus: ["K", "B"] },
      { uptake: 88, focus: ["K", "Ca"] },
      { uptake: 100, focus: ["K"] },
    ],
    nutrients: [{ symbol: "N" }, { symbol: "P" }, { symbol: "K, Ca, Mg" }],
  },
] as const;

const UPTAKE_TEXT: Record<Language, Record<string, ProfileText>> = {
  en: {
    banana: {
      title: "Banana / Plantain",
      stages: [
        { label: "Establishment", timing: "0-2 mo", note: "Rooting and early leaf area." },
        { label: "Vegetative build", timing: "2-5 mo", note: "Rapid canopy and pseudostem growth." },
        { label: "Bunch initiation", timing: "5-8 mo", note: "Demand rises before visible flowering." },
        { label: "Filling", timing: "8-11 mo", note: "Fruit filling and quality period." },
        { label: "Harvest / ratoon", timing: "11+ mo", note: "Maintain follower vigor." },
      ],
      nutrients: [
        { timing: "high from bunch initiation to filling", note: "Often the dominant nutrient for yield and bunch filling." },
        { timing: "early to mid growth", note: "Supports leaf area, but excess can soften tissues." },
        { timing: "before and during filling", note: "Important for quality, transport, and balance." },
      ],
    },
    "fruiting-vegetable": {
      title: "Fruiting vegetable",
      stages: [
        { label: "Seedling", timing: "0-3 wk", note: "Root establishment and transplant recovery." },
        { label: "Vegetative", timing: "3-6 wk", note: "Canopy formation." },
        { label: "Flowering", timing: "6-9 wk", note: "Shift from leaf growth to flowers and fruit set." },
        { label: "Fruit set", timing: "9-13 wk", note: "Peak uptake and quality risk period." },
        { label: "Harvests", timing: "13+ wk", note: "Keep supply steady through repeated harvests." },
      ],
      nutrients: [
        { timing: "flowering through harvest", note: "Key for fruit filling and soluble solids." },
        { timing: "continuous, strongest during fruit growth", note: "Needs steady water flow; foliar Ca cannot fully replace root uptake." },
        { timing: "before flowering", note: "Support flowering, pollen, and early fruit set." },
      ],
    },
    cassava: {
      title: "Cassava / storage root",
      stages: [
        { label: "Establishment", timing: "0-1 mo", note: "Root initiation." },
        { label: "Canopy growth", timing: "1-3 mo", note: "Leaf area drives later storage." },
        { label: "Root bulking", timing: "3-7 mo", note: "Main storage-root demand period." },
        { label: "Late bulking", timing: "7-10 mo", note: "Starch accumulation and quality." },
        { label: "Maturity", timing: "10+ mo", note: "Avoid late excess N." },
      ],
      nutrients: [
        { timing: "root bulking", note: "Critical for storage-root yield and starch movement." },
        { timing: "early canopy only", note: "Too much late N can favor leaves over roots." },
        { timing: "establishment", note: "Help rooting on low-P tropical soils." },
      ],
    },
    "grain-legume": {
      title: "Grain legume",
      stages: [
        { label: "Emergence", timing: "0-2 wk", note: "Rooting and nodulation start." },
        { label: "Vegetative", timing: "2-5 wk", note: "N fixation becomes important." },
        { label: "Flowering", timing: "5-7 wk", note: "Sensitive stage for stress." },
        { label: "Pod fill", timing: "7-10 wk", note: "Seed fill and translocation." },
        { label: "Maturity", timing: "10+ wk", note: "Most uptake is complete." },
      ],
      nutrients: [
        { timing: "early to flowering", note: "Important for roots and biological N fixation." },
        { timing: "flowering and pod fill", note: "Supports transport and seed filling." },
        { timing: "early and pre-flowering", note: "Useful checks for legumes in acidic tropical soils." },
      ],
    },
    grain: {
      title: "Grain crop",
      stages: [
        { label: "Emergence", timing: "0-2 wk", note: "Starter nutrition and roots." },
        { label: "Vegetative", timing: "2-6 wk", note: "Fast biomass accumulation." },
        { label: "Reproductive start", timing: "6-9 wk", note: "Yield components are being set." },
        { label: "Grain fill", timing: "9-13 wk", note: "Translocation to grain." },
        { label: "Maturity", timing: "13+ wk", note: "Most uptake is complete." },
      ],
      nutrients: [
        { timing: "vegetative to reproductive start", note: "Main driver of canopy and yield potential." },
        { timing: "early", note: "Common early limits where roots are small or soil is cool/wet." },
        { timing: "reproductive to fill", note: "Support transport, water regulation, and grain filling." },
      ],
    },
    "perennial-fruit": {
      title: "Perennial fruit crop",
      stages: [
        { label: "Post-harvest", timing: "after harvest", note: "Reserve recovery." },
        { label: "Flush", timing: "new growth", note: "Leaves and shoots expand." },
        { label: "Flowering", timing: "pre-flower", note: "Flower quality and fruit set." },
        { label: "Fruit growth", timing: "set-fill", note: "Peak fruit demand." },
        { label: "Maturation", timing: "finish", note: "Quality and reserve balance." },
      ],
      nutrients: [
        { timing: "pre-flowering and flush", note: "Important for flowering and new growth." },
        { timing: "fruit growth", note: "Key for size, firmness, and quality." },
        { timing: "post-harvest and flush", note: "Avoid pushing excess vegetative growth near flowering." },
      ],
    },
    general: {
      title: "General tropical crop",
      stages: [
        { label: "Establishment", timing: "0-15%", note: "Roots first." },
        { label: "Vegetative", timing: "15-40%", note: "Build leaf area." },
        { label: "Transition", timing: "40-65%", note: "Demand accelerates." },
        { label: "Yield formation", timing: "65-90%", note: "Peak uptake." },
        { label: "Maturity", timing: "90-100%", note: "Maintenance and finish." },
      ],
      nutrients: [
        { timing: "vegetative growth", note: "Supports canopy; match to growth rate." },
        { timing: "early", note: "Most useful when roots are developing." },
        { timing: "yield formation", note: "Important for transport, quality, and balance." },
      ],
    },
  },
  es: {
    banana: {
      title: "Banano / Plátano",
      stages: [
        { label: "Establecimiento", timing: "0-2 meses", note: "Enraizamiento y área foliar inicial." },
        { label: "Crecimiento vegetativo", timing: "2-5 meses", note: "Rápido crecimiento del dosel y pseudotallo." },
        { label: "Iniciación del racimo", timing: "5-8 meses", note: "La demanda aumenta antes de la floración visible." },
        { label: "Llenado", timing: "8-11 meses", note: "Período de llenado y calidad del fruto." },
        { label: "Cosecha / hijuelo", timing: "11+ meses", note: "Mantener vigor del hijuelo seguidor." },
      ],
      nutrients: [
        { timing: "alto desde iniciación del racimo hasta llenado", note: "A menudo el nutriente dominante para rendimiento y llenado." },
        { timing: "inicio a mitad del crecimiento", note: "Apoya el área foliar; el exceso puede ablandar tejidos." },
        { timing: "antes y durante el llenado", note: "Importante para calidad, transporte y balance." },
      ],
    },
    "fruiting-vegetable": {
      title: "Hortaliza frutal",
      stages: [
        { label: "Plántula", timing: "0-3 sem", note: "Establecimiento radicular y recuperación del trasplante." },
        { label: "Vegetativo", timing: "3-6 sem", note: "Formación del dosel." },
        { label: "Floración", timing: "6-9 sem", note: "Cambio del crecimiento foliar a floración y cuajado." },
        { label: "Cuajado", timing: "9-13 sem", note: "Pico de absorción y riesgo de calidad." },
        { label: "Cosechas", timing: "13+ sem", note: "Mantener suministro constante en cosechas repetidas." },
      ],
      nutrients: [
        { timing: "floración hasta cosecha", note: "Clave para llenado del fruto y sólidos solubles." },
        { timing: "continuo, más fuerte durante crecimiento del fruto", note: "Requiere flujo constante de agua; el Ca foliar no reemplaza totalmente la absorción radicular." },
        { timing: "antes de la floración", note: "Apoya floración, polen y cuajado temprano." },
      ],
    },
    cassava: {
      title: "Yuca / raíz de almacenamiento",
      stages: [
        { label: "Establecimiento", timing: "0-1 mes", note: "Iniciación radicular." },
        { label: "Crecimiento del dosel", timing: "1-3 meses", note: "El área foliar impulsa el almacenamiento posterior." },
        { label: "Engrosamiento radicular", timing: "3-7 meses", note: "Período principal de demanda de raíz de almacenamiento." },
        { label: "Engrosamiento tardío", timing: "7-10 meses", note: "Acumulación de almidón y calidad." },
        { label: "Madurez", timing: "10+ meses", note: "Evitar exceso tardío de N." },
      ],
      nutrients: [
        { timing: "engrosamiento radicular", note: "Crítico para rendimiento de raíz y movimiento de almidón." },
        { timing: "solo dosel temprano", note: "Demasiado N tardío favorece hojas sobre raíces." },
        { timing: "establecimiento", note: "Ayuda al enraizamiento en suelos tropicales bajos en P." },
      ],
    },
    "grain-legume": {
      title: "Leguminosa de grano",
      stages: [
        { label: "Emergencia", timing: "0-2 sem", note: "Enraizamiento e inicio de nodulación." },
        { label: "Vegetativo", timing: "2-5 sem", note: "La fijación de N se vuelve importante." },
        { label: "Floración", timing: "5-7 sem", note: "Etapa sensible al estrés." },
        { label: "Llenado de vaina", timing: "7-10 sem", note: "Llenado de semilla y translocación." },
        { label: "Madurez", timing: "10+ sem", note: "La mayor parte de la absorción está completa." },
      ],
      nutrients: [
        { timing: "inicio a floración", note: "Importante para raíces y fijación biológica de N." },
        { timing: "floración y llenado de vaina", note: "Apoya transporte y llenado de semilla." },
        { timing: "inicio y pre-floración", note: "Útil en leguminosas en suelos tropicales ácidos." },
      ],
    },
    grain: {
      title: "Cultivo de grano",
      stages: [
        { label: "Emergencia", timing: "0-2 sem", note: "Nutrición inicial y raíces." },
        { label: "Vegetativo", timing: "2-6 sem", note: "Rápida acumulación de biomasa." },
        { label: "Inicio reproductivo", timing: "6-9 sem", note: "Se definen los componentes de rendimiento." },
        { label: "Llenado de grano", timing: "9-13 sem", note: "Translocación al grano." },
        { label: "Madurez", timing: "13+ sem", note: "La mayor parte de la absorción está completa." },
      ],
      nutrients: [
        { timing: "vegetativo a inicio reproductivo", note: "Principal motor del dosel y potencial de rendimiento." },
        { timing: "inicio", note: "Límites tempranos comunes cuando las raíces son pequeñas." },
        { timing: "reproductivo a llenado", note: "Apoya transporte, regulación hídrica y llenado de grano." },
      ],
    },
    "perennial-fruit": {
      title: "Cultivo frutal perenne",
      stages: [
        { label: "Post-cosecha", timing: "después de cosecha", note: "Recuperación de reservas." },
        { label: "Brote", timing: "nuevo crecimiento", note: "Expansión de hojas y brotes." },
        { label: "Floración", timing: "pre-flor", note: "Calidad floral y cuajado." },
        { label: "Crecimiento del fruto", timing: "cuajado-llenado", note: "Pico de demanda del fruto." },
        { label: "Maduración", timing: "final", note: "Calidad y balance de reservas." },
      ],
      nutrients: [
        { timing: "pre-floración y brote", note: "Importante para floración y nuevo crecimiento." },
        { timing: "crecimiento del fruto", note: "Clave para tamaño, firmeza y calidad." },
        { timing: "post-cosecha y brote", note: "Evitar exceso vegetativo cerca de la floración." },
      ],
    },
    general: {
      title: "Cultivo tropical general",
      stages: [
        { label: "Establecimiento", timing: "0-15%", note: "Raíces primero." },
        { label: "Vegetativo", timing: "15-40%", note: "Construir área foliar." },
        { label: "Transición", timing: "40-65%", note: "La demanda se acelera." },
        { label: "Formación de rendimiento", timing: "65-90%", note: "Pico de absorción." },
        { label: "Madurez", timing: "90-100%", note: "Mantenimiento y finalización." },
      ],
      nutrients: [
        { timing: "crecimiento vegetativo", note: "Apoya el dosel; ajustar a la tasa de crecimiento." },
        { timing: "inicio", note: "Más útil cuando las raíces se están desarrollando." },
        { timing: "formación de rendimiento", note: "Importante para transporte, calidad y balance." },
      ],
    },
  },
  fr: {
    banana: {
      title: "Banane / Plantain",
      stages: [
        { label: "Établissement", timing: "0-2 mois", note: "Enracinement et surface foliaire précoce." },
        { label: "Croissance végétative", timing: "2-5 mois", note: "Croissance rapide du couvert et du pseudotige." },
        { label: "Initiation du régime", timing: "5-8 mois", note: "La demande augmente avant la floraison visible." },
        { label: "Remplissage", timing: "8-11 mois", note: "Période de remplissage et de qualité des fruits." },
        { label: "Récolte / repousse", timing: "11+ mois", note: "Maintenir la vigueur du repousse suivant." },
      ],
      nutrients: [
        { timing: "élevé de l'initiation du régime au remplissage", note: "Souvent le nutriment dominant pour le rendement et le remplissage." },
        { timing: "début à mi-croissance", note: "Soutient la surface foliaire; l'excès peut ramollir les tissus." },
        { timing: "avant et pendant le remplissage", note: "Important pour la qualité, le transport et l'équilibre." },
      ],
    },
    "fruiting-vegetable": {
      title: "Légume fruitier",
      stages: [
        { label: "Semis", timing: "0-3 sem", note: "Établissement racinaire et reprise après repiquage." },
        { label: "Végétatif", timing: "3-6 sem", note: "Formation du couvert." },
        { label: "Floraison", timing: "6-9 sem", note: "Passage de la croissance foliaire à la floraison et nouaison." },
        { label: "Nouaison", timing: "9-13 sem", note: "Pic d'absorption et risque de qualité." },
        { label: "Récoltes", timing: "13+ sem", note: "Maintenir l'apport pendant les récoltes répétées." },
      ],
      nutrients: [
        { timing: "floraison à récolte", note: "Clé pour le remplissage des fruits et les solides solubles." },
        { timing: "continu, plus fort pendant la croissance des fruits", note: "Nécessite un flux d'eau régulier; le Ca foliaire ne remplace pas totalement l'absorption racinaire." },
        { timing: "avant la floraison", note: "Soutient la floraison, le pollen et la nouaison précoce." },
      ],
    },
    cassava: {
      title: "Manioc / racine de stockage",
      stages: [
        { label: "Établissement", timing: "0-1 mois", note: "Initiation racinaire." },
        { label: "Croissance du couvert", timing: "1-3 mois", note: "La surface foliaire alimente le stockage ultérieur." },
        { label: "Grossissement racinaire", timing: "3-7 mois", note: "Période principale de demande des racines de stockage." },
        { label: "Grossissement tardif", timing: "7-10 mois", note: "Accumulation d'amidon et qualité." },
        { label: "Maturité", timing: "10+ mois", note: "Éviter un excès tardif de N." },
      ],
      nutrients: [
        { timing: "grossissement racinaire", note: "Critique pour le rendement des racines et le mouvement de l'amidon." },
        { timing: "couvert précoce seulement", note: "Trop de N tardif favorise les feuilles au détriment des racines." },
        { timing: "établissement", note: "Aide l'enracinement sur sols tropicaux pauvres en P." },
      ],
    },
    "grain-legume": {
      title: "Légumineuse à graines",
      stages: [
        { label: "Levée", timing: "0-2 sem", note: "Enracinement et début de nodulation." },
        { label: "Végétatif", timing: "2-5 sem", note: "La fixation de N devient importante." },
        { label: "Floraison", timing: "5-7 sem", note: "Stade sensible au stress." },
        { label: "Remplissage des gousses", timing: "7-10 sem", note: "Remplissage des graines et translocation." },
        { label: "Maturité", timing: "10+ sem", note: "La majeure partie de l'absorption est terminée." },
      ],
      nutrients: [
        { timing: "début à floraison", note: "Important pour les racines et la fixation biologique de N." },
        { timing: "floraison et remplissage des gousses", note: "Soutient le transport et le remplissage des graines." },
        { timing: "début et pré-floraison", note: "Utile pour les légumineuses en sols tropicaux acides." },
      ],
    },
    grain: {
      title: "Culture céréalière",
      stages: [
        { label: "Levée", timing: "0-2 sem", note: "Nutrition de démarrage et racines." },
        { label: "Végétatif", timing: "2-6 sem", note: "Accumulation rapide de biomasse." },
        { label: "Début reproductif", timing: "6-9 sem", note: "Les composantes de rendement se fixent." },
        { label: "Remplissage du grain", timing: "9-13 sem", note: "Translocation vers le grain." },
        { label: "Maturité", timing: "13+ sem", note: "La majeure partie de l'absorption est terminée." },
      ],
      nutrients: [
        { timing: "végétatif au début reproductif", note: "Principal moteur du couvert et du potentiel de rendement." },
        { timing: "début", note: "Limites précoces courantes quand les racines sont petites." },
        { timing: "reproductif au remplissage", note: "Soutient transport, régulation hydrique et remplissage du grain." },
      ],
    },
    "perennial-fruit": {
      title: "Culture fruitière pérenne",
      stages: [
        { label: "Post-récolte", timing: "après récolte", note: "Récupération des réserves." },
        { label: "Pousse", timing: "nouvelle croissance", note: "Expansion des feuilles et pousses." },
        { label: "Floraison", timing: "pré-floraison", note: "Qualité florale et nouaison." },
        { label: "Croissance des fruits", timing: "nouaison-remplissage", note: "Pic de demande des fruits." },
        { label: "Maturation", timing: "fin", note: "Qualité et équilibre des réserves." },
      ],
      nutrients: [
        { timing: "pré-floraison et pousse", note: "Important pour la floraison et la nouvelle croissance." },
        { timing: "croissance des fruits", note: "Clé pour la taille, la fermeté et la qualité." },
        { timing: "post-récolte et pousse", note: "Éviter un excès végétatif près de la floraison." },
      ],
    },
    general: {
      title: "Culture tropicale générale",
      stages: [
        { label: "Établissement", timing: "0-15%", note: "Les racines d'abord." },
        { label: "Végétatif", timing: "15-40%", note: "Construire la surface foliaire." },
        { label: "Transition", timing: "40-65%", note: "La demande s'accélère." },
        { label: "Formation du rendement", timing: "65-90%", note: "Pic d'absorption." },
        { label: "Maturité", timing: "90-100%", note: "Entretien et finition." },
      ],
      nutrients: [
        { timing: "croissance végétative", note: "Soutient le couvert; ajuster au rythme de croissance." },
        { timing: "début", note: "Plus utile quand les racines se développent." },
        { timing: "formation du rendement", note: "Important pour le transport, la qualité et l'équilibre." },
      ],
    },
  },
  ht: {
    banana: {
      title: "Bannann / Bannann peze",
      stages: [
        { label: "Etablisman", timing: "0-2 mwa", note: "Rasin ak fey bonè." },
        { label: "Kwasans vejetatif", timing: "2-5 mwa", note: "Kwasans rapid nan kouvèti ak pseudotronk." },
        { label: "Kòmansman rejim", timing: "5-8 mwa", note: "Demann monte anvan flè parèt." },
        { label: "Ranpli", timing: "8-11 mwa", note: "Peryòd ranpli ak kalite fwi." },
        { label: "Rekòt / repouse", timing: "11+ mwa", note: "Kenbe vigè repouse ki swiv la." },
      ],
      nutrients: [
        { timing: "wo depi kòmansman rejim rive nan ranpli", note: "Souvan se eleman prensipal pou rendman ak ranpli." },
        { timing: "bonè rive nan mitan kwasans", note: "Sipòte zòn fèy; twòp ka fè tisi yo mou." },
        { timing: "anvan ak pandan ranpli", note: "Enpòtan pou kalite, transpò ak balans." },
      ],
    },
    "fruiting-vegetable": {
      title: "Legim fwi",
      stages: [
        { label: "Plantil", timing: "0-3 sem", note: "Etablisman rasin ak rekiperasyon apre repikaj." },
        { label: "Vejetatif", timing: "3-6 sem", note: "Fòmasyon kouvèti." },
        { label: "Flè", timing: "6-9 sem", note: "Chanje soti nan kwasans fèy pou flè ak fwi." },
        { label: "Fwi pran", timing: "9-13 sem", note: "Pik absòpsyon ak risk kalite." },
        { label: "Rekòt", timing: "13+ sem", note: "Kenbe apwovizyònman pandan rekòt repete." },
      ],
      nutrients: [
        { timing: "flè rive nan rekòt", note: "Kle pou ranpli fwi ak solid solib." },
        { timing: "kontinyèl, pi fò pandan kwasans fwi", note: "Bezwen koule dlo regilye; Ca folye pa ranplase totalman absòpsyon rasin." },
        { timing: "anvan flè", note: "Sipòte flè, polen ak fwi bonè." },
      ],
    },
    cassava: {
      title: "Manyòk / rasin depo",
      stages: [
        { label: "Etablisman", timing: "0-1 mwa", note: "Kòmansman rasin." },
        { label: "Kwasans kouvèti", timing: "1-3 mwa", note: "Zòn fèy mennen depo pita." },
        { label: "Angrèsisman rasin", timing: "3-7 mwa", note: "Peryòd prensipal demann rasin depo." },
        { label: "Angrèsisman ta", timing: "7-10 mwa", note: "Akimilasyon fèkiloz ak kalite." },
        { label: "Matirite", timing: "10+ mwa", note: "Evite twòp N ta." },
      ],
      nutrients: [
        { timing: "angrèsisman rasin", note: "Kritik pou rendman rasin ak mouvman fèkiloz." },
        { timing: "kouvèti bonè sèlman", note: "Twòp N ta favorize fèy olye rasin." },
        { timing: "etablisman", note: "Ede rasin sou tè twopikal ki ba P." },
      ],
    },
    "grain-legume": {
      title: "Pwa grenn",
      stages: [
        { label: "Leve", timing: "0-2 sem", note: "Rasin ak kòmansman nodilasyon." },
        { label: "Vejetatif", timing: "2-5 sem", note: "Fiksasyon N vin enpòtan." },
        { label: "Flè", timing: "5-7 sem", note: "Etap sansib pou estrès." },
        { label: "Ranpli gous", timing: "7-10 sem", note: "Ranpli grenn ak translocation." },
        { label: "Matirite", timing: "10+ sem", note: "Pifò absòpsyon fini." },
      ],
      nutrients: [
        { timing: "bonè rive nan flè", note: "Enpòtan pou rasin ak fiksasyon biyolojik N." },
        { timing: "flè ak ranpli gous", note: "Sipòte transpò ak ranpli grenn." },
        { timing: "bonè ak anvan flè", note: "Itil pou pwa sou tè twopikal asid." },
      ],
    },
    grain: {
      title: "Rekòt grenn",
      stages: [
        { label: "Leve", timing: "0-2 sem", note: "Nitrisyon demaraj ak rasin." },
        { label: "Vejetatif", timing: "2-6 sem", note: "Akimilasyon rapid biomès." },
        { label: "Kòmansman repwodiksyon", timing: "6-9 sem", note: "Konpozan rendman ap fikse." },
        { label: "Ranpli grenn", timing: "9-13 sem", note: "Translocation nan grenn." },
        { label: "Matirite", timing: "13+ sem", note: "Pifò absòpsyon fini." },
      ],
      nutrients: [
        { timing: "vejetatif rive nan repwodiksyon", note: "Motè prensipal kouvèti ak potansyèl rendman." },
        { timing: "bonè", note: "Limit bonè komen lè rasin piti." },
        { timing: "repwodiksyon rive nan ranpli", note: "Sipòte transpò, dlo ak ranpli grenn." },
      ],
    },
    "perennial-fruit": {
      title: "Rekòt fwi pèrenn",
      stages: [
        { label: "Apre rekòt", timing: "apre rekòt", note: "Rekiperasyon rezèv." },
        { label: "Bouj", timing: "nouvo kwasans", note: "Fèy ak branch yo elaji." },
        { label: "Flè", timing: "anvan flè", note: "Kalite flè ak fwi pran." },
        { label: "Kwasans fwi", timing: "pran-ranpli", note: "Pik demann fwi." },
        { label: "Matirite", timing: "fini", note: "Kalite ak balans rezèv." },
      ],
      nutrients: [
        { timing: "anvan flè ak bouj", note: "Enpòtan pou flè ak nouvo kwasans." },
        { timing: "kwasans fwi", note: "Kle pou gwosè, fèmè ak kalite." },
        { timing: "apre rekòt ak bouj", note: "Evite twòp kwasans vejetatif toupre flè." },
      ],
    },
    general: {
      title: "Rekòt twopikal jeneral",
      stages: [
        { label: "Etablisman", timing: "0-15%", note: "Rasin an premye." },
        { label: "Vejetatif", timing: "15-40%", note: "Bati zòn fèy." },
        { label: "Tranzisyon", timing: "40-65%", note: "Demann akselere." },
        { label: "Fòmasyon rendman", timing: "65-90%", note: "Pik absòpsyon." },
        { label: "Matirite", timing: "90-100%", note: "Antretyen ak fini." },
      ],
      nutrients: [
        { timing: "kwasans vejetatif", note: "Sipòte kouvèti; ajiste ak vitès kwasans." },
        { timing: "bonè", note: "Pi itil lè rasin ap devlope." },
        { timing: "fòmasyon rendman", note: "Enpòtan pou transpò, kalite ak balans." },
      ],
    },
  },
  pt: {
    banana: {
      title: "Banana / Banana-da-terra",
      stages: [
        { label: "Estabelecimento", timing: "0-2 meses", note: "Enraizamento e área foliar inicial." },
        { label: "Crescimento vegetativo", timing: "2-5 meses", note: "Rápido crescimento da copa e do pseudocaule." },
        { label: "Iniciação do cacho", timing: "5-8 meses", note: "A demanda aumenta antes da floração visível." },
        { label: "Enchimento", timing: "8-11 meses", note: "Período de enchimento e qualidade dos frutos." },
        { label: "Colheita / rebrota", timing: "11+ meses", note: "Manter vigor da rebrota seguinte." },
      ],
      nutrients: [
        { timing: "alto da iniciação do cacho ao enchimento", note: "Muitas vezes o nutriente dominante para rendimento e enchimento." },
        { timing: "início ao meio do crescimento", note: "Apoia a área foliar; excesso pode amolecer tecidos." },
        { timing: "antes e durante o enchimento", note: "Importante para qualidade, transporte e equilíbrio." },
      ],
    },
    "fruiting-vegetable": {
      title: "Hortaliça frutífera",
      stages: [
        { label: "Muda", timing: "0-3 sem", note: "Estabelecimento radicular e recuperação do transplantio." },
        { label: "Vegetativo", timing: "3-6 sem", note: "Formação da copa." },
        { label: "Floração", timing: "6-9 sem", note: "Mudança do crescimento foliar para floração e frutificação." },
        { label: "Frutificação", timing: "9-13 sem", note: "Pico de absorção e risco de qualidade." },
        { label: "Colheitas", timing: "13+ sem", note: "Manter suprimento nas colheitas repetidas." },
      ],
      nutrients: [
        { timing: "floração até colheita", note: "Chave para enchimento dos frutos e sólidos solúveis." },
        { timing: "contínuo, mais forte durante crescimento dos frutos", note: "Precisa de fluxo constante de água; Ca foliar não substitui totalmente a absorção radicular." },
        { timing: "antes da floração", note: "Apoia floração, pólen e frutificação precoce." },
      ],
    },
    cassava: {
      title: "Mandioca / raiz de armazenamento",
      stages: [
        { label: "Estabelecimento", timing: "0-1 mês", note: "Iniciação radicular." },
        { label: "Crescimento da copa", timing: "1-3 meses", note: "A área foliar impulsiona o armazenamento posterior." },
        { label: "Engrossamento radicular", timing: "3-7 meses", note: "Período principal de demanda das raízes de armazenamento." },
        { label: "Engrossamento tardio", timing: "7-10 meses", note: "Acúmulo de amido e qualidade." },
        { label: "Maturidade", timing: "10+ meses", note: "Evitar excesso tardio de N." },
      ],
      nutrients: [
        { timing: "engrossamento radicular", note: "Crítico para rendimento das raízes e movimento do amido." },
        { timing: "copa inicial apenas", note: "N tardio em excesso favorece folhas em vez de raízes." },
        { timing: "estabelecimento", note: "Ajuda o enraizamento em solos tropicais pobres em P." },
      ],
    },
    "grain-legume": {
      title: "Leguminosa de grão",
      stages: [
        { label: "Emergência", timing: "0-2 sem", note: "Enraizamento e início da nodulação." },
        { label: "Vegetativo", timing: "2-5 sem", note: "A fixação de N torna-se importante." },
        { label: "Floração", timing: "5-7 sem", note: "Estágio sensível ao estresse." },
        { label: "Enchimento de vagem", timing: "7-10 sem", note: "Enchimento de sementes e translocação." },
        { label: "Maturidade", timing: "10+ sem", note: "A maior parte da absorção está completa." },
      ],
      nutrients: [
        { timing: "início à floração", note: "Importante para raízes e fixação biológica de N." },
        { timing: "floração e enchimento de vagem", note: "Apoia transporte e enchimento de sementes." },
        { timing: "início e pré-floração", note: "Útil para leguminosas em solos tropicais ácidos." },
      ],
    },
    grain: {
      title: "Cultura de grão",
      stages: [
        { label: "Emergência", timing: "0-2 sem", note: "Nutrição inicial e raízes." },
        { label: "Vegetativo", timing: "2-6 sem", note: "Rápida acumulação de biomassa." },
        { label: "Início reprodutivo", timing: "6-9 sem", note: "Componentes de rendimento estão sendo definidos." },
        { label: "Enchimento de grão", timing: "9-13 sem", note: "Translocação para o grão." },
        { label: "Maturidade", timing: "13+ sem", note: "A maior parte da absorção está completa." },
      ],
      nutrients: [
        { timing: "vegetativo ao início reprodutivo", note: "Principal motor da copa e do potencial de rendimento." },
        { timing: "início", note: "Limites precoces comuns quando as raízes são pequenas." },
        { timing: "reprodutivo ao enchimento", note: "Apoia transporte, regulação hídrica e enchimento de grão." },
      ],
    },
    "perennial-fruit": {
      title: "Cultura frutífera perene",
      stages: [
        { label: "Pós-colheita", timing: "após colheita", note: "Recuperação de reservas." },
        { label: "Brotação", timing: "novo crescimento", note: "Expansão de folhas e brotos." },
        { label: "Floração", timing: "pré-flor", note: "Qualidade floral e frutificação." },
        { label: "Crescimento dos frutos", timing: "frutificação-enchimento", note: "Pico de demanda dos frutos." },
        { label: "Maturação", timing: "final", note: "Qualidade e equilíbrio de reservas." },
      ],
      nutrients: [
        { timing: "pré-floração e brotação", note: "Importante para floração e novo crescimento." },
        { timing: "crescimento dos frutos", note: "Chave para tamanho, firmeza e qualidade." },
        { timing: "pós-colheita e brotação", note: "Evitar excesso vegetativo perto da floração." },
      ],
    },
    general: {
      title: "Cultura tropical geral",
      stages: [
        { label: "Estabelecimento", timing: "0-15%", note: "Raízes primeiro." },
        { label: "Vegetativo", timing: "15-40%", note: "Construir área foliar." },
        { label: "Transição", timing: "40-65%", note: "A demanda acelera." },
        { label: "Formação de rendimento", timing: "65-90%", note: "Pico de absorção." },
        { label: "Maturidade", timing: "90-100%", note: "Manutenção e finalização." },
      ],
      nutrients: [
        { timing: "crescimento vegetativo", note: "Apoia a copa; ajustar à taxa de crescimento." },
        { timing: "início", note: "Mais útil quando as raízes estão se desenvolvendo." },
        { timing: "formação de rendimento", note: "Importante para transporte, qualidade e equilíbrio." },
      ],
    },
  },
  sw: {
    banana: {
      title: "Ndizi / Ndizi za kupika",
      stages: [
        { label: "Uanzishaji", timing: "miezi 0-2", note: "Kuota kwa mizizi na eneo la majani mapema." },
        { label: "Ukuaji wa mimea", timing: "miezi 2-5", note: "Ukuaji wa haraka wa kivuli na shina bandia." },
        { label: "Mwanzo wa kichala", timing: "miezi 5-8", note: "Mahitaji huongezeka kabla ya maua kuonekana." },
        { label: "Kujaza", timing: "miezi 8-11", note: "Kipindi cha kujaza na ubora wa matunda." },
        { label: "Mavuno / chipukizi", timing: "miezi 11+", note: "Kudumisha nguvu ya chipukizi inayofuata." },
      ],
      nutrients: [
        { timing: "juu kutoka mwanzo wa kichala hadi kujaza", note: "Mara nyingi virutubisho kuu kwa mavuno na kujaza." },
        { timing: "mapema hadi kati ya ukuaji", note: "Inasaidia eneo la majani; kupita kiasi kunaweza kulainisha tishu." },
        { timing: "kabla na wakati wa kujaza", note: "Muhimu kwa ubora, usafirishaji na usawa." },
      ],
    },
    "fruiting-vegetable": {
      title: "Mboga za matunda",
      stages: [
        { label: "Mche", timing: "wiki 0-3", note: "Kuimarisha mizizi na kupona baada ya kuhamisha." },
        { label: "Ukuaji wa mimea", timing: "wiki 3-6", note: "Kuunda kivuli." },
        { label: "Maua", timing: "wiki 6-9", note: "Kubadilika kutoka ukuaji wa majani hadi maua na matunda." },
        { label: "Kuweka matunda", timing: "wiki 9-13", note: "Kilele cha ufyonzaji na hatari ya ubora." },
        { label: "Mavuno", timing: "wiki 13+", note: "Dumisha ugavi katika mavuno ya mara kwa mara." },
      ],
      nutrients: [
        { timing: "maua hadi mavuno", note: "Muhimu kwa kujaza matunda na vitu vilivyoyeyuka." },
        { timing: "endelevu, imara zaidi wakati wa ukuaji wa matunda", note: "Inahitaji mtiririko thabiti wa maji; Ca ya majani haiwezi kuchukua nafasi kamili ya mizizi." },
        { timing: "kabla ya maua", note: "Inasaidia maua, chavua na kuweka matunda mapema." },
      ],
    },
    cassava: {
      title: "Muhogo / mzizi wa kuhifadhi",
      stages: [
        { label: "Uanzishaji", timing: "mwezi 0-1", note: "Mwanzo wa mizizi." },
        { label: "Ukuaji wa kivuli", timing: "miezi 1-3", note: "Eneo la majani linaendesha uhifadhi baadaye." },
        { label: "Kupanua mizizi", timing: "miezi 3-7", note: "Kipindi kikuu cha mahitaji ya mizizi ya kuhifadhi." },
        { label: "Kupanua marehemu", timing: "miezi 7-10", note: "Mkusanyiko wa wanga na ubora." },
        { label: "Ukomavu", timing: "miezi 10+", note: "Epuka N ya ziada marehemu." },
      ],
      nutrients: [
        { timing: "kupanua mizizi", note: "Muhimu kwa mavuno ya mizizi na uhamishaji wa wanga." },
        { timing: "kivuli cha mapema tu", note: "N nyingi marehemu inaweza kupendelea majani kuliko mizizi." },
        { timing: "uanzishaji", note: "Inasaidia kuota katika udongo wa kitropiki wenye P kidogo." },
      ],
    },
    "grain-legume": {
      title: "Kunde la nafaka",
      stages: [
        { label: "Kuchipua", timing: "wiki 0-2", note: "Mizizi na mwanzo wa nodulation." },
        { label: "Ukuaji wa mimea", timing: "wiki 2-5", note: "Ufixishaji wa N unakuwa muhimu." },
        { label: "Maua", timing: "wiki 5-7", note: "Hatua nyeti kwa msongo." },
        { label: "Kujaza ganda", timing: "wiki 7-10", note: "Kujaza mbegu na uhamishaji." },
        { label: "Ukomavu", timing: "wiki 10+", note: "Ufyonzaji mwingi umekamilika." },
      ],
      nutrients: [
        { timing: "mapema hadi maua", note: "Muhimu kwa mizizi na ufixishaji wa kibiolojia wa N." },
        { timing: "maua na kujaza ganda", note: "Inasaidia usafirishaji na kujaza mbegu." },
        { timing: "mapema na kabla ya maua", note: "Muhimu kwa kunde katika udongo wa kitropiki wenye asidi." },
      ],
    },
    grain: {
      title: "Zao la nafaka",
      stages: [
        { label: "Kuchipua", timing: "wiki 0-2", note: "Lishe ya kuanza na mizizi." },
        { label: "Ukuaji wa mimea", timing: "wiki 2-6", note: "Mkusanyiko wa haraka wa biomass." },
        { label: "Mwanzo wa uzazi", timing: "wiki 6-9", note: "Vipengele vya mavuno vinawekwa." },
        { label: "Kujaza nafaka", timing: "wiki 9-13", note: "Uhamishaji kwenye nafaka." },
        { label: "Ukomavu", timing: "wiki 13+", note: "Ufyonzaji mwingi umekamilika." },
      ],
      nutrients: [
        { timing: "mimea hadi mwanzo wa uzazi", note: "Kichocheo kikuu cha kivuli na uwezo wa mavuno." },
        { timing: "mapema", note: "Vikwazo vya mapema vinavyoonekana mizizi ikiwa ndogo." },
        { timing: "uzazi hadi kujaza", note: "Inasaidia usafirishaji, maji na kujaza nafaka." },
      ],
    },
    "perennial-fruit": {
      title: "Zao la matunda la kudumu",
      stages: [
        { label: "Baada ya mavuno", timing: "baada ya mavuno", note: "Kupona kwa akiba." },
        { label: "Chipukizi", timing: "ukuaji mpya", note: "Majani na machipukizi yanapanuka." },
        { label: "Maua", timing: "kabla ya maua", note: "Ubora wa maua na kuweka matunda." },
        { label: "Ukuaji wa matunda", timing: "kuweka-kujaza", note: "Kilele cha mahitaji ya matunda." },
        { label: "Ukomavu", timing: "mwisho", note: "Ubora na usawa wa akiba." },
      ],
      nutrients: [
        { timing: "kabla ya maua na chipukizi", note: "Muhimu kwa maua na ukuaji mpya." },
        { timing: "ukuaji wa matunda", note: "Muhimu kwa ukubwa, ugumu na ubora." },
        { timing: "baada ya mavuno na chipukizi", note: "Epuka ukuaji wa mimea kupita kiasi karibu na maua." },
      ],
    },
    general: {
      title: "Zao la jumla la kitropiki",
      stages: [
        { label: "Uanzishaji", timing: "0-15%", note: "Mizizi kwanza." },
        { label: "Ukuaji wa mimea", timing: "15-40%", note: "Jenga eneo la majani." },
        { label: "Mpito", timing: "40-65%", note: "Mahitaji huongezeka kasi." },
        { label: "Uundaji wa mavuno", timing: "65-90%", note: "Kilele cha ufyonzaji." },
        { label: "Ukomavu", timing: "90-100%", note: "Matengenezo na kumaliza." },
      ],
      nutrients: [
        { timing: "ukuaji wa mimea", note: "Inasaidia kivuli; linganisha na kiwango cha ukuaji." },
        { timing: "mapema", note: "Inafaa zaidi mizizi inapokuwa inakua." },
        { timing: "uundaji wa mavuno", note: "Muhimu kwa usafirishaji, ubora na usawa." },
      ],
    },
  },
};

function buildProfiles(language: Language): UptakeProfile[] {
  const text = UPTAKE_TEXT[language] || UPTAKE_TEXT.en;

  return UPTAKE_STRUCTURE.map((base) => {
    const localized = text[base.key] || UPTAKE_TEXT.en[base.key];

    return {
      key: base.key,
      pattern: base.pattern,
      title: localized.title,
      stages: base.stages.map((stage, index) => ({
        uptake: stage.uptake,
        focus: [...stage.focus],
        label: localized.stages[index].label,
        timing: localized.stages[index].timing,
        note: localized.stages[index].note,
      })),
      nutrients: base.nutrients.map((nutrient, index) => ({
        symbol: nutrient.symbol,
        timing: localized.nutrients[index].timing,
        note: localized.nutrients[index].note,
      })),
    };
  });
}

const PROFILE_CACHE: Partial<Record<Language, UptakeProfile[]>> = {};

export function getUptakeProfiles(language: Language): UptakeProfile[] {
  if (!PROFILE_CACHE[language]) {
    PROFILE_CACHE[language] = buildProfiles(language);
  }
  return PROFILE_CACHE[language]!;
}

export function getUptakeProfileForCrop(
  selectedCropName: string | null | undefined,
  language: Language
): UptakeProfile {
  const crop = (selectedCropName || "").toLowerCase();
  const matchers: Array<[RegExp, string]> = [
    [/\b(banana|banano|platan|plantain|guineo)\b/, "banana"],
    [/\b(tomato|tomate|pepper|pimiento|chili|aji|ají|pepino|cucumber|eggplant|berenjena)\b/, "fruiting-vegetable"],
    [/\b(cassava|yuca|manioc|mandioca)\b/, "cassava"],
    [/\b(bean|beans|frijol|frijoles|soya|soybean|cowpea|legume)\b/, "grain-legume"],
    [/\b(maize|corn|maiz|maíz|rice|arroz|sorghum|wheat|trigo)\b/, "grain"],
    [/\b(coffee|cafe|café|cacao|cocoa|mango|citrus|limon|limón|orange|naranja|pineapple|piña|papaya|avocado|aguacate)\b/, "perennial-fruit"],
  ];
  const profileKey = matchers.find(([pattern]) => pattern.test(crop))?.[1] || "general";
  const profiles = getUptakeProfiles(language);
  return profiles.find((profile) => profile.key === profileKey) || profiles[profiles.length - 1];
}
