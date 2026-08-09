"use client";

import Image from "next/image";

/**
 * ClinicGrowerLogo - shared app logo component.
 *
 * Full variant: ClinicGrower wordmark
 * Compact variant: CG icon mark only
 */

interface ClinicGrowerLogoProps {
  variant?: "full" | "compact";
}

const LOGO_INLINE = "/brand/clinic-grower-logo-inline.png";
const LOGO_ICON = "/brand/clinic-grower-icon-light-circular.png";

export default function ClinicGrowerLogo({
  variant = "full",
}: ClinicGrowerLogoProps) {
  const iconStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    imageRendering: "auto",
  };

  if (variant === "compact") {
    return (
      <div
        aria-label="ClinicGrower Internal CRM"
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          background: "transparent",
        }}
      >
        <Image
          src={LOGO_ICON}
          alt="ClinicGrower Internal CRM"
          width={36}
          height={36}
          style={iconStyle}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ gap: 3 }}
      aria-label="ClinicGrower Internal CRM"
    >
      <Image
        src={LOGO_INLINE}
        alt="ClinicGrower"
        width={186}
        height={35}
        style={{
          width: "clamp(130px, 20vw, 176px)",
          maxWidth: "100%",
          height: "auto",
          display: "block",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
