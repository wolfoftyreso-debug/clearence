/**
 * Tester för kunskapsmotorn.
 *
 * Lagrummen testas ordagrant och strukturen hårt: en artikel utan källa är
 * en åsikt, en trasig relaterad-länk är en återvändsgränd, och en artikel
 * som råkar ge råd i stället för information är ett gränsfel.
 */

import { KNOWLEDGE_ARTICLES, KNOWLEDGE_DISCLAIMER, findArticle } from "../src/lib/knowledge";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const bySlug = (slug: string) => KNOWLEDGE_ARTICLES.find((a) => a.slug === slug);

/* --- struktur ------------------------------------------------------------- */
check("sex artiklar", KNOWLEDGE_ARTICLES.length === 6, String(KNOWLEDGE_ARTICLES.length));
check(
  "unika sluggar",
  new Set(KNOWLEDGE_ARTICLES.map((a) => a.slug)).size === KNOWLEDGE_ARTICLES.length,
);
for (const article of KNOWLEDGE_ARTICLES) {
  check(`${article.slug}: har källor`, article.sources.length > 0);
  check(
    `${article.slug}: inga tomma avsnitt`,
    article.sections.length > 0 && article.sections.every((s) => s.paragraphs.length > 0),
  );
  check(
    `${article.slug}: relaterade artiklar finns`,
    article.related.every((slug) => bySlug(slug) !== undefined),
    article.related.join(","),
  );
  check(`${article.slug}: pekar inte på sig själv`, !article.related.includes(article.slug));
}

/* --- lagrummen, ordagrant -------------------------------------------------- */
const kbr = bySlug("kontrollbalansrakning")!;
const kbrText = JSON.stringify(kbr);
check("KBR: 13 § och skäl att anta", kbrText.includes("25 kap. 13 §") && kbrText.includes("skäl att ANTA"));
check("KBR: åttamånadersfristen", kbrText.includes("åtta månader") && kbrText.includes("25 kap. 16 §"));
check("KBR: ansvarsparagrafen", kbrText.includes("25 kap. 18 §"));

const rek = bySlug("foretagsrekonstruktion")!;
check("Rekonstruktion: 2022 års lag", JSON.stringify(rek).includes("(2022:964)"));
check("Rekonstruktion: livskraftstestet", JSON.stringify(rek).includes("livskraft"));

const konkurs = bySlug("konkurs")!;
check("Konkurs: obeståndsdefinitionen", JSON.stringify(konkurs).includes("1 kap. 2 § konkurslagen"));

const ansvar = bySlug("foretradaransvar")!;
check(
  "Företrädaransvar: 59 kap. SFL",
  JSON.stringify(ansvar).includes("59 kap. 12-13 §§ skatteförfarandelagen"),
);
check("Företrädaransvar: förfallodagen", JSON.stringify(ansvar).includes("SENAST på skattens förfallodag"));

const garanti = bySlug("lonegaranti")!;
check("Lönegaranti: lagen och taket", JSON.stringify(garanti).includes("(1992:497)") && JSON.stringify(garanti).includes("fyra prisbasbelopp"));

/* --- gränsen -------------------------------------------------------------- */
check("gränsmarkeringen säger 'inte rådgivning'", KNOWLEDGE_DISCLAIMER.includes("inte rådgivning"));
check("gränsmarkeringen pekar mot rådgivare", KNOWLEDGE_DISCLAIMER.includes("revisor eller juridisk rådgivare"));
check("findArticle: träff", findArticle("konkurs")?.title.startsWith("Konkurs") === true);
check("findArticle: okänd slug ger null", findArticle("finns-inte") === null);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
