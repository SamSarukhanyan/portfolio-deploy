// Failure scenarios. Details (break / oracle / reset, expected fix): contracts/scenarios.md.
// The agent never sees these; it only gets the alert and what its tools return.

import type { ScenarioSummary } from "./api.js";

export const SCENARIOS: readonly ScenarioSummary[] = [
  { id: "nginx-stopped", title: "Stop the web server",
    blurb: "The program that answers visitors suddenly stops." },
  { id: "disk-full", title: "Fill the disk",
    blurb: "A runaway file eats all free space, and the site can't save anything." },
  { id: "bad-release", title: "Ship a broken version",
    blurb: "A new version with a bug goes live and visitors see a blank page." },
  { id: "bad-config", title: "Break the settings",
    blurb: "A typo in the web server's settings stops it from starting." },
  { id: "cpu-hog", title: "Overload the CPU",
    blurb: "A greedy program takes all the processing power and the site crawls." },
];
