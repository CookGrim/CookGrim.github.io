// Compare "Crème brûlée" et "creme brulee" comme identiques — utile pour
// une recherche qui ne force pas l'utilisateur à taper les accents.
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
