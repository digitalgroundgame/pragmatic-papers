/**
 * The hover and keyboard-focus effects a card's image and headline share. The card's
 * outer element carries `cardGroup`, so pointing anywhere on the card (eyebrow, image,
 * headline, description, byline) or tabbing to any link in it lifts the image and dims
 * the headline together. `group-focus-visible` covers a card that is itself the link;
 * `group-has-focus-visible` covers a card whose links sit inside it.
 */
export const cardGroup = "group/card"

/** A small lift in contrast and saturation, eased, for the card's image. */
export const cardImageHover =
  "transition-[filter] duration-300 ease-out group-hover/card:brightness-[1.02] group-hover/card:contrast-[1.16] group-hover/card:saturate-[1.16] group-focus-visible/card:brightness-[1.02] group-focus-visible/card:contrast-[1.16] group-focus-visible/card:saturate-[1.16] group-has-focus-visible/card:brightness-[1.02] group-has-focus-visible/card:contrast-[1.16] group-has-focus-visible/card:saturate-[1.16]"

/** The headline fades to 80%: lighter on the light theme, darker on the dark one. */
export const cardTitleHover =
  "group-hover/card:text-foreground/80 group-focus-visible/card:text-foreground/80 group-has-focus-visible/card:text-foreground/80"
