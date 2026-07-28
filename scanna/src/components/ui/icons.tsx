// Small hand-rolled icon set (no icon-library dependency) — stroke-based,
// 24x24 viewBox, inherits currentColor. Decorative by default (aria-hidden);
// callers add aria-label on the wrapping button/link when the icon is the
// only content, per accessibility.md.
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const CameraIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const CollectionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5" width="6" height="14" rx="1" />
    <rect x="14.5" y="5" width="6" height="14" rx="1" />
  </svg>
);

export const ListingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export const DashboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 19V11M12 19V5M20 19v-7" />
  </svg>
);

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ExternalLinkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M14 4h6v6M20 4 10 14M6 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
  </svg>
);

export const WifiOffIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M2 8.5a17 17 0 0 1 5.5-3.5M22 8.5a17 17 0 0 0-8.4-4.3M9 13a8 8 0 0 1 6-1.9M6 16a11.5 11.5 0 0 1 3.2-2.1M12 19.5h.01M2 2l20 20" />
  </svg>
);

/** Non-financial buy-signal glyphs — shape conveys the signal alongside
 * colour + text label (accessibility.md: never colour-only meaning). */
export const BelowEstimateGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M12 17 5 8h14z" />
  </svg>
);

export const InLineEstimateGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M12 5 19 12 12 19 5 12z" />
  </svg>
);

export const AboveEstimateGlyph = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M12 7 19 16H5z" />
  </svg>
);
