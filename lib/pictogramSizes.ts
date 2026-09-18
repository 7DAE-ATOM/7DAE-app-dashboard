/**
 * Display sizes shared by the two pictograms of an application — its category
 * (`ChipCategory`) and its business criticality (`ChipBusinessCriticality`).
 *
 * They live here rather than at each call site because the two must stay the
 * *same* size wherever they sit side by side. The criticality artwork is a
 * gauge (four bars, n lit), so a size that is comfortable for a category
 * pictogram is not necessarily enough to tell two neighbouring levels apart —
 * these values are set by the gauge, and the category follows.
 */
export const PICTOGRAM_SIZE = {
  card: 45,
  cardCompact: 40,
  detail: 60,
} as const;
