export const PROFILE_PROFESSIONS = [
  "Farmer",
  "Student",
  "Researcher",
  "Agronomist",
  "Extension agent",
  "Technician",
  "Consultant",
  "Other",
] as const;

export type ProfileProfession = (typeof PROFILE_PROFESSIONS)[number];
