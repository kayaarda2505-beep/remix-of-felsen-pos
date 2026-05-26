import logoUrl from "@/assets/saints-logo.jpeg";

export function SaintsLogo({
  size = 36,
  withWordmark = false,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoUrl}
        alt="SAINTS Logo"
        width={size}
        height={size}
        className="rounded-xl object-cover ring-1 ring-white/10"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-[0.18em]">SAINTS</div>
          <div className="text-[9px] text-muted-foreground tracking-[0.25em] -mt-0.5">
            POS SYSTEM
          </div>
        </div>
      )}
    </div>
  );
}
