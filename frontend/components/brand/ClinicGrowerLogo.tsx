"use client";

/**
 * ClinicGrowerLogo - shared app logo component.
 *
 * Full variant: CG icon mark + wordmark + Mission Control subtitle
 * Compact variant: CG icon mark only
 */

interface ClinicGrowerLogoProps {
  variant?: "full" | "compact";
}

const LOGO_ICON =
  "https://eu.chat-img.sintra.ai/57e4b3da-c2ee-48f8-956d-828adc30d734/f09acbf8-3fb3-43fe-a5fb-8d82c035723f/IMG_3004.jpeg";

export default function ClinicGrowerLogo({
  variant = "full",
}: ClinicGrowerLogoProps) {
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    filter: "hue-rotate(60deg)",
    imageRendering: "auto",
  };

  if (variant === "compact") {
    return (
      <div
        aria-label="ClinicGrower Mission Control"
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          background: "transparent",
        }}
      >
        <img src={LOGO_ICON} alt="ClinicGrower Mission Control" style={imgStyle} />
      </div>
    );
  }

  return (
    <div
      className="flex items-center"
      style={{ gap: 10 }}
      aria-label="ClinicGrower Mission Control"
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          background: "transparent",
        }}
      >
        <img src={LOGO_ICON} alt="ClinicGrower Mission Control" style={imgStyle} />
      </div>

      <div className="flex flex-col" style={{ gap: 0 }}>
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.1,
            letterSpacing: "0.02em",
            color: "#151f21",
          }}
        >
          <span style={{ fontWeight: 500 }}>Clinic</span>
          <span style={{ fontWeight: 700 }}>Grower</span>
        </div>
        <div
          className="hidden sm:block"
          style={{
            fontSize: 8.5,
            lineHeight: 1,
            letterSpacing: "0.16em",
            color: "#5e8a8d",
            fontWeight: 500,
            textTransform: "uppercase" as const,
            marginTop: 3,
          }}
        >
          Mission Control
        </div>
      </div>
    </div>
  );
}
