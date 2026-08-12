import type { CSSProperties } from "react";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5Image } from "../data/proposalV5Types";

export interface EditorialImageProps {
  image: ProposalV5Image | null;
  width?: string;
  height?: string;
}

export function EditorialImage({ image, width = proposalV5Tokens.page.contentWidth, height = "62mm" }: EditorialImageProps) {
  const frameStyle: CSSProperties = {
    width,
    height,
    margin: 0,
    overflow: "hidden",
    background: proposalV5Tokens.colors.softPanel,
    border: `0.4mm solid ${proposalV5Tokens.colors.rule}`,
  };

  if (!image?.url) {
    throw new Error("EditorialImage requires a resolved ProposalV5Image with a URL.");
  }

  return (
    <figure
      aria-label={image.alt || "V5 proposal image"}
      role="img"
      style={{
        ...frameStyle,
        backgroundImage: `url("${image.url}")`,
        backgroundPosition: image.cropPosition || "center center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    />
  );
}
