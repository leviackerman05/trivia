import { ICON_PATHS, type IconName } from '../../lib/icons';

/**
 * [AIRBNB v3] In-repo SVG line icon for React islands (the Astro pages use
 * Icon.astro). Wraps the same path table; unknown names fall back to
 * `question`. Inherits color via currentColor; stroke defaults live in the
 * `.pb-icon` CSS class.
 */
interface IconProps {
  name: IconName | string;
  /** Rendered px; 14-18 for inline chrome in islands. */
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 16, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      strokeWidth={strokeWidth !== 1.75 ? strokeWidth : undefined}
      aria-hidden="true"
      className={`pb-icon ${className ?? ''}`}
    >
      <g
        dangerouslySetInnerHTML={{ __html: ICON_PATHS[name as IconName] ?? ICON_PATHS.question }}
      />
    </svg>
  );
}
