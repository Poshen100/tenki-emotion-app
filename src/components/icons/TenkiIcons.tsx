import { type SVGProps, type ReactNode } from "react";

const ACCENT = "var(--tenki-accent, #5FE9D0)";
const OK = "#5FE9D0";
const FAIL = "#5E7596";
const WARN = "#FFC68A";

export type TenkiIconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: TenkiIconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function Sense(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="4,12 7.5,12 9.5,7.5 12,15.5 14,11 15.5,12 20,12" stroke={ACCENT} /></Svg>);
}
export function Baseline(props: TenkiIconProps) {
  return (<Svg {...props}><polyline points="3,8.5 6,15 8.2,6.5 10.2,13 12,11.8 21,11.8" /><circle cx="16" cy="11.8" r="1.5" fill={ACCENT} stroke="none" /></Svg>);
}
export function Fingerprint(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="8.4" /><path d="M7.6 14 a4.6 4.6 0 0 1 8.8 0" stroke={ACCENT} /><path d="M9.2 14 a3 3 0 0 1 5.6 0" /><path d="M10.7 14 a1.6 1.6 0 0 1 2.6 0" /><line x1="12" y1="14" x2="12" y2="12.6" /></Svg>);
}
export function SoulFace(props: TenkiIconProps) {
  return (<Svg {...props}><ellipse cx="12" cy="12" rx="6.4" ry="7.4" strokeDasharray="2 2.6" opacity={0.55} /><circle cx="9.2" cy="10" r="0.95" fill={ACCENT} stroke="none" /><circle cx="14.6" cy="9.4" r="0.85" fill="currentColor" stroke="none" /><circle cx="12" cy="12.6" r="1.15" fill={ACCENT} stroke="none" /><circle cx="10" cy="15" r="0.8" fill="currentColor" stroke="none" /><circle cx="15" cy="14.4" r="0.8" fill="currentColor" stroke="none" /><circle cx="12.4" cy="7.8" r="0.7" fill="currentColor" stroke="none" /></Svg>);
}
export function Camera(props: TenkiIconProps) {
  return (<Svg {...props}><rect x="3" y="6.5" width="18" height="13" rx="3.2" /><path d="M8.6 6.5 l1.4 -2 h4 l1.4 2" /><circle cx="12" cy="13" r="3.4" stroke={ACCENT} /><circle cx="12" cy="13" r="0.7" fill="currentColor" stroke="none" /></Svg>);
}
export function Align(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="1.5" fill={ACCENT} stroke="none" /><polyline points="9,4.4 12,6.8 15,4.4" /><polyline points="9,19.6 12,17.2 15,19.6" /><polyline points="4.4,9 6.8,12 4.4,15" /><polyline points="19.6,9 17.2,12 19.6,15" /></Svg>);
}
export function Scan(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="3" stroke={ACCENT} /><circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" /><line x1="12" y1="2.6" x2="12" y2="5.4" /><line x1="12" y1="18.6" x2="12" y2="21.4" /><line x1="2.6" y1="12" x2="5.4" y2="12" /><line x1="18.6" y1="12" x2="21.4" y2="12" /></Svg>);
}
export function Explore(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="8.4" /><path d="M12 5.4 L14 12 L12 12.6 Z" fill={ACCENT} stroke="none" /><path d="M12 18.6 L10 12 L12 11.4 Z" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></Svg>);
}
export function Ready(props: TenkiIconProps) {
  return (<Svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="7.5,12.5 10.5,15.5 16.5,8.5" stroke={ACCENT} /></Svg>);
}
export function StatusOk({ size = 24, ...props }: TenkiIconProps) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={OK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9" /><polyline points="7.5,12.5 10.5,15.5 16.5,8.5" /></svg>);
}
export function StatusFail({ size = 24, ...props }: TenkiIconProps) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={FAIL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>);
}
export function StatusWarn({ size = 24, ...props }: TenkiIconProps) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={WARN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9" /><line x1="12" y1="7.5" x2="12" y2="13" /><circle cx="12" cy="16.2" r="0.5" fill={WARN} stroke="none" /></svg>);
}

export const TenkiIcons = { sense: Sense, baseline: Baseline, fingerprint: Fingerprint, soulFace: SoulFace, camera: Camera, align: Align, scan: Scan, explore: Explore, ready: Ready, statusOk: StatusOk, statusFail: StatusFail, statusWarn: StatusWarn } as const;
export type TenkiIconName = keyof typeof TenkiIcons;
