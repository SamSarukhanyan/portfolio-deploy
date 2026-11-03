/** Fill in your public contact endpoints. Copy is served from i18n (and optional MySQL). */
export const site = {
  displayName: "Samvel Sarukhanyan",
  domain: "samsarukhanyan.com",
  email: "sarukhanyandev@gmail.com",
  githubUrl: "https://github.com/SamSarukhanyan",
  linkedinUrl: "https://www.linkedin.com/in/samvel-sarukhanyan-684327401",
  telegramUrl: "",
} as const;

/**
 * Incident Lab (/lab, docs/ai-oncall/PLAN.md) is paused: hidden from the menu and the router,
 * its Control Plane stopped. The code stays in the repo (and as a lazy chunk nobody loads).
 * Turn it back on: set this to true, then follow "Resume" in docs/ai-oncall/PLAN.md.
 */
export const features = {
  incidentLab: false,
} as const;
