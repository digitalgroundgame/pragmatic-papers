import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"
import { createArticle, validateWriters } from "../articles"
import type { SerializedLexicalNode } from "../richtext"
import { createParagraph, createRichText, createTextNode } from "../richtext"

/**
 * Creates an inline math block node (renders LaTeX within a paragraph)
 */
export function createMathInlineBlock(math: string): SerializedLexicalNode {
  return {
    type: "inlineBlock",
    fields: {
      blockType: "inlineMathBlock",
      math,
    },
    format: "",
    version: 1,
  } as SerializedLexicalNode
}

/**
 * Creates a display math block node (renders LaTeX as a standalone block)
 */
export function createMathDisplayBlock(math: string): SerializedLexicalNode {
  return {
    type: "block",
    fields: {
      blockType: "displayMathBlock",
      math,
    },
    format: "",
    version: 2,
  } as SerializedLexicalNode
}

const createMathBlocksContent = () => {
  const children = [
    createParagraph(
      "Mathematics is the language of science and philosophy alike. This article demonstrates both inline and display math rendering using LaTeX expressions.",
    ),
    // --- Inline math section ---
    createParagraph(
      "Inline math allows equations to flow naturally within a sentence. For example, Einstein's famous mass-energy equivalence",
    ),
    createParagraph([
      createTextNode("Einstein's mass-energy equivalence "),
      createMathInlineBlock("E = mc^2"),
      createTextNode(
        " is one of the most recognisable equations in all of physics, relating energy, mass, and the speed of light.",
      ),
    ]),
    createParagraph([
      createTextNode("Bayes' theorem "),
      createMathInlineBlock("P(A \\mid B) = \\dfrac{P(B \\mid A)\\,P(A)}{P(B)}"),
      createTextNode(
        " underpins modern probabilistic reasoning and has become central to debates in epistemology about rational belief revision.",
      ),
    ]),
    createParagraph([
      createTextNode("The sum of the first "),
      createMathInlineBlock("n"),
      createTextNode(" natural numbers is given by the closed form "),
      createMathInlineBlock("\\sum_{i=1}^{n} i = \\dfrac{n(n+1)}{2}"),
      createTextNode(
        ", a result attributed to Gauss that elegantly illustrates the power of algebraic thinking.",
      ),
    ]),
    // --- Display math section ---
    createParagraph(
      "Display math is used for equations that deserve their own line — derivations, definitions, and results that the reader is meant to pause and study.",
    ),
    createParagraph(
      "The Gaussian integral is a cornerstone of probability theory and quantum mechanics:",
    ),
    createMathDisplayBlock("\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}"),
    createParagraph(
      "The Fundamental Theorem of Calculus connects differentiation and integration, forming the backbone of analysis:",
    ),
    createMathDisplayBlock("\\frac{d}{dx}\\left[\\int_a^x f(t)\\,dt\\right] = f(x)"),
    createParagraph(
      "The time-dependent Schrödinger equation describes how the quantum state of a physical system evolves:",
    ),
    createMathDisplayBlock(
      "i\\hbar\\,\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\,\\Psi(\\mathbf{r},t)",
    ),
    createParagraph(
      "Gauss's law — one of Maxwell's equations — relates the electric flux through a closed surface to the enclosed charge:",
    ),
    createMathDisplayBlock("\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}"),
    // --- Closing ---
    createParagraph(
      "Together, inline and display math blocks make it possible to write rigorous, typeset-quality mathematics within the flow of an article — bringing the precision of LaTeX to long-form philosophical and scientific writing.",
    ),
  ]

  return createRichText(children)
}

export const createMathBlocksArticle = async (
  payload: Payload,
  writers: User[],
  mediaDocs: Media[],
  topics: number[] = [],
): Promise<number> => {
  validateWriters(writers)

  const writer = writers[0]!
  const title = "Equations in Context: Demonstrating Inline and Display Math"

  const article = await createArticle(payload, {
    title,
    content: createMathBlocksContent(),
    authors: [writer.id],
    topics: topics,
    slug: "equations-in-context-demonstrating-inline-and-display-math",
    meta: {
      title,
      description:
        "A guide to inline and display math rendering, demonstrating LaTeX equations from Bayes' theorem to the Schrödinger equation.",
      image: mediaDocs[0]?.id,
    },
  })

  return article.id
}
