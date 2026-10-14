/** Guided tours for first-time users. Each step points at an element marked with data-tour="…". */

export const TOUR_IDS = ["welcome", "project"] as const;
export type TourId = (typeof TOUR_IDS)[number];

export interface TourStep {
  /** data-tour names, first visible one wins (e.g. desktop nav, else the mobile menu button). No target = centred card. */
  target?: string[];
  title: string;
  body: string;
}

export const TOURS: Record<TourId, TourStep[]> = {
  welcome: [
    {
      title: "Welcome to TmtechSolar Pro 👋",
      body: "This quick tour shows you around. It takes about a minute, and you can replay it any time from the ? button at the top of the page.",
    },
    {
      target: ["new-project"],
      title: "Start a new design",
      body: "Give the project a name, pick the site location and create it. Keep “Start with a sample 3-bedroom load list” ticked the first time: every step is filled in so you can see how the design flows, then edit the loads to match your client.",
    },
    {
      target: ["projects"],
      title: "Your projects",
      body: "All your designs appear here with their size, cost and progress. Search, filter by status or sort them, and open one to continue where you left off.",
    },
    {
      target: ["stats"],
      title: "Your portfolio at a glance",
      body: "Totals across all your projects: PV and battery capacity designed, pipeline value and average progress.",
    },
    {
      target: ["nav", "nav-mobile"],
      title: "Everything else is up here",
      body: "Equipment holds real inverters, batteries, controllers and 21,000+ PV modules (and your own). Organisations let your team design together. Approvals collects changes waiting for you. Quick calc sizes a system in seconds.",
    },
    {
      target: ["theme"],
      title: "Light or dark",
      body: "Switch between light and dark mode. Your choice is remembered on this device.",
    },
    {
      target: ["help"],
      title: "Need a reminder?",
      body: "Press ? any time to replay this tour. Inside a project it explains the design workspace instead.",
    },
  ],
  project: [
    {
      title: "Your design workspace",
      body: "A design is built step by step, from the load audit to commissioning and the final report. Each step uses the results of the ones before it, so work through them in order.",
    },
    {
      target: ["steps", "steps-mobile"],
      title: "The design steps",
      body: "Jump to any step here. A ✓ means reviewed and complete. Red and orange counts flag failing checks and warnings that need your attention.",
    },
    {
      target: ["save-status"],
      title: "Saved automatically",
      body: "Every change saves as you type. With no internet connection, changes are kept on your device and sync when you reconnect.",
    },
    {
      target: ["progress"],
      title: "Design progress",
      body: "Progress counts the steps you have marked complete.",
    },
    {
      target: ["checks"],
      title: "Automatic design checks",
      body: "Each step checks your inputs against IEC standards and good practice, like string voltage at the coldest temperature or cable voltage drop, and explains anything that fails.",
    },
    {
      target: ["complete"],
      title: "Mark the step complete",
      body: "When you have reviewed a step, tick this box. It updates your progress and the step list.",
    },
    {
      target: ["next"],
      title: "Move on",
      body: "Go to the next step. Later steps (single-line diagram, array layout, Bill of Quantities, report) are generated from your earlier inputs.",
    },
    {
      target: ["share"],
      title: "Work with your team",
      body: "Share the project with an organisation so teammates can help. When someone edits a section you created, you approve the change, and two people can't edit the same step at once.",
    },
    {
      target: ["status"],
      title: "Project status",
      body: "Track the job from draft through design, review, approval and installation to commissioning.",
    },
    {
      title: "You're ready",
      body: "Start with the Site step, then the Load audit. The Report step pulls everything into a printable design report you can save as PDF. Press ? any time to see this again.",
    },
  ],
};

/** Which tour belongs to a page. */
export function tourForPath(pathname: string): TourId {
  return pathname.startsWith("/projects/") ? "project" : "welcome";
}
