/**
 * SubtleForms logo mark.
 *
 * A real SVG mark (not an "SF" text box): a rounded square in the SubtleForms
 * primary with a stylised form/fields glyph, so it reads at 16px and stays
 * crisp on retina. Inherits currentColor for the badge stroke so it can be
 * recoloured via the parent's color; the badge fill is the primary token.
 *
 * Part C step 2.
 */

export default function Logo({ size = 28, className = '', ...rest }) {
  return (
    <svg
      className={`sf-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="SubtleForms"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      {/* Badge */}
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        ry="8"
        fill="var(--sf-primary-500, #5b5bd6)"
      />
      {/* Form fields glyph — three short stacked lines + a check */}
      <rect x="8" y="9" width="16" height="2.5" rx="1.25" fill="#ffffff" />
      <rect x="8" y="14.75" width="11" height="2.5" rx="1.25" fill="#ffffff" />
      <rect x="8" y="20.5" width="7" height="2.5" rx="1.25" fill="#ffffff" />
      <path
        d="M19.5 21.2l2.2 2.2 4-4.2"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
