import Image, { type ImageProps } from "next/image";

/**
 * next/image wrapper. Local SVG placeholders are served as-is (Next does not
 * optimise SVG); uploaded photos (Supabase Storage) are optimised and
 * responsive.
 */
export function ProductImage(props: ImageProps & { src: string }) {
  const isSvg = props.src.toLowerCase().endsWith(".svg");
  return <Image {...props} unoptimized={isSvg || props.unoptimized} alt={props.alt} />;
}
