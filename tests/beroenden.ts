/**
 * BEROENDENA: de beslut som annars bara finns i ett commit-meddelande.
 *
 * Bakgrunden är react-router. Rådet GHSA-qwww-vcr4-c8h2 gällde 7.12.0-8.2.0
 * och bedömdes som icke-nåbart, eftersom det kräver RSC-läge och den här
 * appen kör en deklarativ router utan loaders. Bedömningen stämde - men den
 * var en åsikt, och åsikter håller inte när någon annan uppgraderar.
 *
 * Sedan visade sig det som gjorde saken avgjord: den föreslagna
 * "åtgärden" var att gå NER till 7.11.0, och 7.11.0 bär flera egna råd,
 * däribland öppen omdirigering i <Link> och useNavigate. Det hade bytt ett
 * råd vi inte kan nå mot flera vi kan. Vägen ur var uppåt: react-router 8,
 * som kräver React 19.
 *
 * Efter den flytten är beroendeträdet rent - noll råd. Det här är
 * kontrollen som håller det så. Den är avsiktligt trubbig: den läser vad
 * som FAKTISKT är installerat, inte vad package.json önskar sig.
 *
 * Vad den INTE gör: den ersätter inte `npm audit`. Nya råd publiceras utan
 * att någon rör repot, och det fångar bara en granskning som körs
 * regelbundet. Det den gör är att fånga en ÄNDRING här inne som tar oss
 * tillbaka in i ett känt råd.
 */

import fs from "node:fs";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};

const rot = process.cwd();
const las = (sokvag: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(fs.readFileSync(`${rot}/${sokvag}`, "utf8"));
  } catch {
    return null;
  }
};

const version = (paket: string): string | null => {
  const p = las(`node_modules/${paket}/package.json`);
  return typeof p?.version === "string" ? p.version : null;
};

/** [major, minor, patch] ur en installerad version. */
const delar = (v: string): number[] => v.split(".").map((d) => parseInt(d, 10) || 0);

/** Sant när v ligger i [lag, hog], inklusive båda ändar. */
const inom = (v: string, lag: string, hog: string): boolean => {
  const jamfor = (a: string, b: string): number => {
    const [x, y] = [delar(a), delar(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  return jamfor(v, lag) >= 0 && jamfor(v, hog) <= 0;
};

/* --- 1. react-router ligger utanför de kända råden ------------------------- */

const router = version("react-router");
check("react-router är installerat", router !== null, String(router));

if (router) {
  /*
   * De två intervall projektet faktiskt stått i. Ett tredje kan publiceras
   * imorgon - därför är den här listan ett golv och inte ett tak, och
   * därför står `npm audit` kvar som den regelbundna kontrollen.
   */
  check(
    "react-router ligger inte i RSC-rådets intervall (GHSA-qwww-vcr4-c8h2)",
    !inom(router, "7.12.0", "8.2.0"),
    router,
  );
  check(
    "och inte i intervallet för omdirigeringsråden (t.o.m. 7.11.0)",
    !inom(router, "6.0.0", "7.11.0"),
    router,
  );
  // Nedgraderingen var det som såg ut som en lösning och inte var det.
  check("versionen är alltså 8 eller senare", delar(router)[0] >= 8, router);
}

/*
 * react-router-dom finns inte längre. Paketet gick upp i react-router i
 * version 8, och en kvarglömd installation hade dragit in hela den gamla
 * 7-serien igen genom bakvägen - med sina råd.
 */
check(
  "react-router-dom är borta ur trädet",
  version("react-router-dom") === null,
  String(version("react-router-dom")),
);

const pkg = las("package.json") as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null;
check(
  "och står inte kvar i package.json",
  !pkg?.dependencies?.["react-router-dom"] && !pkg?.devDependencies?.["react-router-dom"],
);

/* --- 2. React möter det routern kräver ------------------------------------ */

/*
 * react-router 8 kräver react >= 19.2.7. Blir React kvar på 18 medan
 * routern går upp får man ett bygge som lyckas och en app som faller
 * sönder först i webbläsaren - peer-beroenden är varningar, inte fel.
 */
const react = version("react");
const reactDom = version("react-dom");
check("react är installerat", react !== null, String(react));
check("react-dom är installerat", reactDom !== null, String(reactDom));
if (react && reactDom) {
  check("react är 19.2.7 eller senare, som routern kräver", !inom(react, "0.0.0", "19.2.6"), react);
  check("react och react-dom går i takt", delar(react)[0] === delar(reactDom)[0], `${react} / ${reactDom}`);
}

/* --- 3. Typerna följer med -------------------------------------------------- */

/*
 * @types/react på 18 mot react på 19 ger ett typcheck som godkänner det
 * som inte längre finns. Det märks inte förrän i körning.
 */
const typerReact = version("@types/react");
if (typerReact && react) {
  check(
    "@types/react har samma huvudversion som react",
    delar(typerReact)[0] === delar(react)[0],
    `${typerReact} / ${react}`,
  );
}

/* --- 4. Vi använder inte det som råden handlar om -------------------------- */

/*
 * Båda råden gäller ytor vi inte har: RSC-läget och dataroutern med
 * loaders, actions och redirect(). Det är därför de var onåbara även
 * innan uppgraderingen.
 *
 * Kontrollen står kvar EFTER uppgraderingen med flit. Den dag någon
 * inför createBrowserRouter eller en RSC-ingång är den här filen platsen
 * där det ska stå att bedömningen behöver göras om - inte ett
 * commit-meddelande från förra året.
 */
const kallor = (kat: string): string[] => {
  const ut: string[] = [];
  for (const post of fs.readdirSync(`${rot}/${kat}`, { withFileTypes: true })) {
    const sokvag = `${kat}/${post.name}`;
    if (post.isDirectory()) ut.push(...kallor(sokvag));
    else if (/\.tsx?$/.test(post.name)) ut.push(sokvag);
  }
  return ut;
};

const allKod = kallor("src")
  .map((f) => fs.readFileSync(`${rot}/${f}`, "utf8"))
  .join("\n");

check("ingen datarouter (createBrowserRouter)", !/createBrowserRouter/.test(allKod));
check("inga RSC-ingångar", !/react-router\/rsc|matchRSCServerRequest/.test(allKod));
check("ingen kvarvarande import från react-router-dom", !/from "react-router-dom"/.test(allKod));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
