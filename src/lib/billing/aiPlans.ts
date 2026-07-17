import type { AIPlan } from "./types";

/** Default AI plan catalog — extensible for Basic / Pro / Enterprise later. */
export const DEFAULT_AI_PLANS: AIPlan[] = [
  {
    id: "standard",
    slug: "standard",
    name: "AI Assistant",
    description:
      "Optional monthly subscription for unlimited AI access (subject to fair use). Independent from your software license.",
    priceMonthlyCents: 1000,
    monthlyQuestionLimit: 500,
    features: [
      "Unlimited AI Access (fair use)",
      "Agronomic Assistant",
      "Laboratory Explanation",
      "Recommendation Analysis",
      "Fertilizer Guidance",
      "Follow-up Questions",
      "Context Awareness",
      "Faster Responses",
    ],
    active: true,
    sortOrder: 0,
  },
];

export function getActiveAiPlans(plans: AIPlan[] = DEFAULT_AI_PLANS) {
  return [...plans]
    .filter((p) => p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findAiPlan(id: string, plans: AIPlan[] = DEFAULT_AI_PLANS) {
  return plans.find((p) => p.id === id || p.slug === id) ?? null;
}
