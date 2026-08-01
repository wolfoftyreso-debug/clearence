import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Varje ny sida och varje nytt steg börjar överst.
 *
 * Utan det här behåller webbläsaren rullningen från föregående vy. Har du
 * scrollat ned i en lång likviditetsplan och trycker Nästa hamnar du mitt i
 * nästa steg, ofta nedanför rubriken som förklarar vad du ska göra. Det ser
 * ut som att ingenting hände, och i en produkt vars enda uppgift är att
 * vägleda någon som är stressad är det ett rejält fel.
 *
 * `behavior: "instant"` med flit: mjuk rullning över en hel sidhöjd är en
 * halv sekund där användaren tittar på fel innehåll, och den drar dessutom
 * blicken uppåt genom material som inte längre gäller.
 */
const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};

/**
 * Rullar upp när ett värde ändras - typiskt ett stegnummer i en guide.
 *
 * Guiderna byter steg i eget tillstånd och inte i adressen, så en
 * ruttbaserad lösning når dem aldrig. Anropas med samma värde som styr vilket
 * steg som ritas ut.
 */
export const useScrollToTopOnChange = (value: unknown) => {
  useEffect(() => {
    scrollToTop();
  }, [value]);
};

/**
 * Rullar upp vid varje navigering.
 *
 * Två undantag, båda medvetna:
 *
 *  - Finns en ankarlänk i adressen (t.ex. /#how-it-works) ska webbläsaren få
 *    hoppa dit. Att rulla upp då vore att gå emot vad användaren just klickade
 *    på.
 *  - Byter bara sökparametrarna, inte sökvägen, är det samma sida med ett
 *    filter ändrat. Att kasta upp någon till toppen mitt i en lista de bläddrar
 *    i är irriterande, inte hjälpsamt.
 */
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    scrollToTop();
  }, [pathname, hash]);

  return null;
};
