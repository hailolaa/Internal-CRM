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
    deepInk: "#061D20",
    paper: "#F3EEE5",
    card: "#FCFBF8",
    headingInk: "#0B292C",
    muted: "#526B6D",
    teal: "#5BCBC5",
    strongTeal: "#0F716D",
    rule: "#D2DEDA",
    softPanel: "#EAF2EF",
    mint: "#D9F1EE",
    secondaryDark: "#0C2A30",
    copper: "#974824",
    copperLight: "#D47C51",
    peach: "#F5E5D9",
  },
  type: {
    coverHeadline: "34pt",
    internalHeadline: "30pt",
    lede: "14pt",
    body: "11pt",
    legal: "8pt",
  },
  darkPages: [1, 3, 6, 8, 12, 13],
} as const;

export type ProposalV5Tokens = typeof proposalV5Tokens;
