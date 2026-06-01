/**
 * src/global.d.ts
 * Ambient type declarations untuk side-effect CSS imports + asset modules.
 * Vite handle CSS as side-effect import; TypeScript butuh ambient declaration
 * supaya `import "./styles.css"` tidak error TS2882.
 */
declare module "*.css"
declare module "*.svg"
declare module "*.png"
declare module "*.jpg"
declare module "*.jpeg"
declare module "*.gif"
declare module "*.webp"
declare module "*.ico"
