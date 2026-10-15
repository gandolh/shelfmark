import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

/**
 * `npm run icons -w @shelfmark/web` redraws public/icons/ from public/icon.svg;
 * the PNGs are committed. The SVG carries its own ground and keeps its mark
 * inside the maskable safe zone, so no padding or background is added here.
 */
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
    assetName: (type, size) => {
      switch (type) {
        case "transparent":
          return `icons/icon-${size.width}.png`;
        case "maskable":
          return `icons/maskable-${size.width}.png`;
        case "apple":
          return `icons/apple-touch-icon-${size.width}.png`;
      }
    },
  },
  images: ["public/icon.svg"],
});
