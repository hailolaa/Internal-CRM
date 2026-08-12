export const proposalV5Tokens = {
  page: {
    width: "210mm",
    height: "297mm",
    safeMarginX: "17mm",
    safeMarginY: "17mm",
    contentWidth: "176mm",
  },
  font: {
    family: 'var(--font-jakarta, "Plus Jakarta Sans", Arial, Helvetica, sans-serif)',
  },
  colors: {
    deepInk: "#011418",
    paper: "#F4FAFA",
    headingInk: "#132E35",
    muted: "#5F777B",
    teal: "#57BBB6",
    strongTeal: "#2F9E99",
    rule: "#C8DFDD",
    softPanel: "#DFF1EF",
    secondaryDark: "#0C2A30",
  },
  type: {
    coverHeadline: "34pt",
    internalHeadline: "30pt",
    lede: "14pt",
    body: "11pt",
    legal: "8pt",
  },
  darkPages: [1, 3, 5, 8, 11, 18, 19],
} as const;

export type ProposalV5Tokens = typeof proposalV5Tokens;
