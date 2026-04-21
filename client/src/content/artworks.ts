export type Artwork = {
  id: string;
  title: string;
  filename: string;
  size: string;
  medium: string;
};

// Put your real painting files into: /client/public/artworks/
// Example filename values below: art-01.jpg, art-02.jpg ...
export const artworks: Artwork[] = [
  { id: "art-01", title: "Landscape", filename: "1.jpg", size: "60x70", medium: "Oil on Canvas" },
  { id: "art-02", title: "Khor Virap", filename: "2.jpg", size: "50x70", medium: "Oil on Canvas" },
  { id: "art-03", title: "Paruyr Sevak", filename: "3.jpg", size: "40x50", medium: "Oil on Canvas" },
  { id: "art-04", title: "Frunzik Mkrtchyan", filename: "4.jpg", size: "40x50", medium: "Oil on Canvas" },
  { id: "art-05", title: "Abstract", filename: "5.jpg", size: "50x70", medium: "Oil on Canvas" },
  { id: "art-06", title: "Eghishe Charenc", filename: "6.jpg", size: "40x50", medium: "Oil on Canvas" },
  { id: "art-07", title: "Still life", filename: "7.jpg", size: "50x60", medium: "Oil on Canvas" },
  { id: "art-08", title: "Model", filename: "8.jpg", size: "50x70", medium: "Oil on Canvas" },
  { id: "art-09", title: "Model", filename: "9.jpg", size: "50x60", medium: "Oil on Canvas" },
  { id: "art-10", title: "Still life", filename: "10.jpg", size: "50x70", medium: "Oil on Canvas" },
  { id: "art-11", title: "Mother and son", filename: "11.jpg", size: "50x60", medium: "Oil on Canvas" },
];

export function getArtworkSrc(filename: string): string {
  return `/artworks/${filename}`;
}
