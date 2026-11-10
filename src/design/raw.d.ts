/** Vite's `?raw` imports: the design guide reads globals.css as text. */
declare module "*.css?raw" {
  const content: string
  export default content
}
