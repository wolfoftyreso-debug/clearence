import { Link, useParams } from "react-router";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_DISCLAIMER,
  findArticle,
} from "@/lib/knowledge";
import { GlossaryText, SimplerLanguageSuggestion } from "@/components/language/GlossaryText";
import { ArrowRight, BookOpen, Scale } from "lucide-react";

/**
 * Kunskapsmotorns publika sidor: översikten och artikeln.
 *
 * Publika med avsikt - den som söker "kontrollbalansräkning skyldighet"
 * klockan 23 en söndag ska landa i begriplig, källhänvisad information
 * utan konto. Sidorna renderar datamodulen och dess gränsmarkering; de
 * äger inget eget innehåll, och det är därför innehållet går att testa.
 */

const Disclaimer = () => (
  <p className="mt-8 flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
    <Scale className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
    <span>{KNOWLEDGE_DISCLAIMER}</span>
  </p>
);

const KnowledgeIndex = () => (
  <main data-guide="kunskapsbanken" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-24">
    <h1 className="font-display text-3xl text-foreground">Kunskap</h1>
    <p className="mt-2 leading-relaxed text-muted-foreground">
      Företagskrisens regler, förklarade med källhänvisningar. Vad lagen
      säger, vilka datum som styr och vad de olika vägarna innebär.
    </p>
    <ul className="mt-8 space-y-3">
      {KNOWLEDGE_ARTICLES.map((article) => (
        <li key={article.slug}>
          <Link
            to={`/kunskap/${article.slug}`}
            className="group flex items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-accent"
          >
            <BookOpen className="mt-1 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{article.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                {article.summary}
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
    <Disclaimer />
  </main>
);

const KnowledgeArticlePage = ({ slug }: { slug: string }) => {
  const article = findArticle(slug);

  if (!article) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-24">
        <h1 className="font-display text-2xl text-foreground">Artikeln finns inte</h1>
        <p className="mt-2 text-muted-foreground">
          <Link to="/kunskap" className="text-accent underline">
            Till kunskapsöversikten
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-24">
      <nav aria-label="Brödsmulor" className="text-sm text-muted-foreground">
        <Link to="/kunskap" className="underline-offset-4 hover:underline">
          Kunskap
        </Link>{" "}
        / {article.title}
      </nav>
      <h1 className="mt-3 font-display text-3xl leading-tight text-foreground">
        {article.title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{article.summary}</p>

      {/* Klickar läsaren på många begreppsförklaringar föreslås enklare
          språk - EN gång, och ett nej respekteras. */}
      <div className="mt-4">
        <SimplerLanguageSuggestion />
      </div>

      {article.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <GlossaryText
              key={paragraph.slice(0, 40)}
              text={paragraph}
              className="mt-3 leading-relaxed text-foreground/90"
            />
          ))}
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Källor
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {article.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </section>

      {article.related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Läs vidare
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {article.related.map((slug2) => {
              const related = findArticle(slug2);
              if (!related) return null;
              return (
                <li key={slug2}>
                  <Link
                    to={`/kunskap/${slug2}`}
                    className="inline-block rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
                  >
                    {related.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Disclaimer />
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Osäker på var ditt bolag står?{" "}
        <Link to="/wizard" className="font-medium text-accent underline underline-offset-4">
          Gör utvärderingen
        </Link>{" "}
        – tio minuter, och du får fristerna och nästa steg för just er situation.
      </p>
    </main>
  );
};

const Knowledge = () => {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      {slug ? <KnowledgeArticlePage slug={slug} /> : <KnowledgeIndex />}
      <Footer />
    </div>
  );
};

export default Knowledge;
