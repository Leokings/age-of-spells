type SiteBrandProps = {
  compact?: boolean;
};

export default function SiteBrand({compact = false}: SiteBrandProps) {
  return (
    <span className={`aos-site-brand ${compact ? "compact" : ""}`}>
      <img
        src="/brand/age-of-spells-elemental-mark-v2.webp"
        alt=""
        width="72"
        height="72"
        decoding="async"
      />
      <span>
        <strong>Age of Spells</strong>
        {compact ? null : <small>Intelligent elemental duels</small>}
      </span>
    </span>
  );
}
