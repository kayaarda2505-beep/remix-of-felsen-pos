import logoAsset from "@/assets/piratino-logo.png.asset.json";

export function PiratinoLogo({
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
        src={logoAsset.url}
        alt="Piratino Logo"
        width={size}
        height={size}
        className="rounded-xl object-contain"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-[0.18em]">PIRATINO</div>
          <div className="text-[9px] text-muted-foreground tracking-[0.25em] -mt-0.5">
            POS SYSTEM
          </div>
        </div>
      )}
    </div>
  );
}
