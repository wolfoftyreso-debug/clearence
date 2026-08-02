/**
 * Nedladdning av genererade filer.
 *
 * En plats, inte tre kopior: aktexporten, fristkalendern och
 * kreditunderlagspaketet laddar alla ned text. Revoke sker efter ett kort
 * uppskov - återkallas URL:en synkront hinner vissa webbläsare inte starta
 * nedladdningen, och då händer ingenting alls, tyst.
 */
export const downloadTextFile = (
  content: string,
  fileName: string,
  mimeType: string,
): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Öppnar en (signerad) fil-URL i ny flik via ett ankarklick i stället för
 * window.open: popupanrop blockeras tyst i inbäddade och mobila vyer -
 * "Sånt här måste fungera"-klassen av fel - medan ett ankare med target
 * beter sig som en vanlig länk och följer med användargesten.
 */
export const openFileUrl = (url: string): void => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};
