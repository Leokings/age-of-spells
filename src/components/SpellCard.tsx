import type {IngredientDefinition} from "../cards";

type SpellCardProps = {
  card: IngredientDefinition;
  selected?: boolean;
  disabled?: boolean;
  displayOnly?: boolean;
  compact?: boolean;
  onSelect?: () => void;
};

function CardContents({card, selected}: {card: IngredientDefinition; selected: boolean}) {
  return (
    <>
      <span className="aos-card-topline">
        <span className="aos-card-rarity"><i />{card.rarity}</span>
        <span className="aos-card-pull">{card.pullRate} pull</span>
      </span>
      <span className="aos-card-art">
        <img src={card.art} alt="" loading="lazy" decoding="async" />
        <span className="aos-card-art-shade" aria-hidden="true" />
        <b aria-hidden="true">{card.glyph}</b>
        <span className="aos-card-art-label">{card.element}</span>
      </span>
      <span className="aos-card-element">{card.catalyst ? "arcane catalyst" : "primal element"}</span>
      <strong className="aos-card-name">{card.name}</strong>
      <span className="aos-card-affinities">
        {card.affinities.map((affinity) => <span key={affinity}>{affinity}</span>)}
      </span>
      <small>{card.description}</small>
      <span className="aos-card-footer" aria-hidden="true"><i /><b>AGE OF SPELLS</b><i /></span>
      {selected ? <span className="aos-card-selected"><b>✓</b> Selected for fusion</span> : null}
    </>
  );
}

export default function SpellCard({
  card,
  selected = false,
  disabled = false,
  displayOnly = false,
  compact = false,
  onSelect,
}: SpellCardProps) {
  const className = `aos-card aos-ingredient-card element-${card.element} rarity-${card.rarity} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`;

  if (displayOnly) {
    return (
      <article className={className} title={card.description}>
        <CardContents card={card} selected={false} />
      </article>
    );
  }

  return (
    <button
      className={className}
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      title={card.description}
    >
      <CardContents card={card} selected={selected} />
    </button>
  );
}
