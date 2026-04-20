export type Artwork = {
  id: string;
  title: string;
  filename: string;
  size: string;
  medium: string;
  year: string;
};

// Put your real painting files into: /client/public/artworks/
// Example filename values below: art-01.jpg, art-02.jpg ...
export const artworks: Artwork[] = [
  { id: "art-01", title: "Evening Silence", filename: "art-01.jpg", size: "60 x 80 cm", medium: "Oil on canvas", year: "2023" },
  { id: "art-02", title: "Light Over Stone", filename: "art-02.jpg", size: "50 x 70 cm", medium: "Oil on canvas", year: "2022" },
  { id: "art-03", title: "Blue Memory", filename: "art-03.jpg", size: "70 x 90 cm", medium: "Oil on canvas", year: "2024" },
  { id: "art-04", title: "Old Street Air", filename: "art-04.jpg", size: "55 x 75 cm", medium: "Oil on canvas", year: "2021" },
  { id: "art-05", title: "Warm Horizon", filename: "art-05.jpg", size: "65 x 85 cm", medium: "Oil on canvas", year: "2023" },
  { id: "art-06", title: "City Pulse", filename: "art-06.jpg", size: "60 x 90 cm", medium: "Oil on canvas", year: "2024" },
  { id: "art-07", title: "Silent Motion", filename: "art-07.jpg", size: "50 x 70 cm", medium: "Oil on canvas", year: "2020" },
  { id: "art-08", title: "Dust and Sun", filename: "art-08.jpg", size: "80 x 100 cm", medium: "Oil on canvas", year: "2022" },
];

export function getArtworkSrc(filename: string): string {
  return `/artworks/${filename}`;
}
