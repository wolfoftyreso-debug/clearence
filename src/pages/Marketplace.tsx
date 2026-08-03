import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ProfessionalCard from "@/components/marketplace/ProfessionalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Users, Briefcase, Scale, Calculator, CreditCard } from "lucide-react";

type CategoryFilter = 'all' | 'konkursforvaltare' | 'rekonstruktor' | 'revisor' | 'affarsjurist' | 'kreditbolag';

const categoryLabels: Record<CategoryFilter, string> = {
  all: 'Alla',
  konkursforvaltare: 'Konkursförvaltare',
  rekonstruktor: 'Rekonstruktörer',
  revisor: 'Revisorer',
  affarsjurist: 'Affärsjurister',
  kreditbolag: 'Kreditbolag'
};

const categoryIcons: Record<CategoryFilter, React.ElementType> = {
  all: Users,
  konkursforvaltare: Scale,
  rekonstruktor: Briefcase,
  revisor: Calculator,
  affarsjurist: Scale,
  kreditbolag: CreditCard
};

const Marketplace = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [locationFilter, setLocationFilter] = useState("");

  // Fetch professionals
  const { data: professionals, isLoading: professionalsLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => data.professionals.listActive()
  });

  // Fetch ratings
  const { data: ratings } = useQuery({
    queryKey: ['professional_ratings'],
    queryFn: () => data.professionals.listRatings()
  });

  // The signed-in user's own profile claims, so a card can show "under
  // granskning" instead of offering the claim button twice.
  const { user } = useAuth();
  const { data: myClaims } = useQuery({
    queryKey: ["my-profile-claims"],
    queryFn: () => data.professionals.listMyClaims(),
    enabled: !!user,
    retry: false,
  });

  // Ärendet driver "Kontakta via CLEARANCE": förfrågan byggs på det, och
  // redan kontaktade rådgivare markeras i stället för att kontaktas igen.
  const { data: latestCase } = useQuery({
    queryKey: ["latest-case-marketplace"],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
    retry: false,
  });
  const { data: caseShares } = useQuery({
    queryKey: ["case-shares", latestCase?.id],
    queryFn: () => data.leads.listForCase(latestCase?.id as string),
    enabled: !!latestCase,
    retry: false,
  });

  // Calculate average ratings per professional
  const getAverageRating = (professionalId: string) => {
    const professionalRatings = ratings?.filter(r => r.professionalId === professionalId) || [];
    if (professionalRatings.length === 0) return null;
    
    const totalScores = professionalRatings.reduce((acc, r) => {
      const scores = [
        r.communicationScore,
        r.expertiseScore,
        r.priceTransparencyScore,
        r.responseTimeScore,
        r.overallScore
      ].filter(s => s !== null) as number[];
      return acc + scores.reduce((a, b) => a + b, 0) / scores.length;
    }, 0);
    
    return {
      average: totalScores / professionalRatings.length,
      count: professionalRatings.length
    };
  };

  // Filter professionals
  const filteredProfessionals = professionals?.filter(p => {
    const matchesSearch = searchQuery === "" || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    
    const matchesLocation = locationFilter === "" || 
      p.location?.toLowerCase().includes(locationFilter.toLowerCase());
    
    return matchesSearch && matchesCategory && matchesLocation;
  }) || [];

  // Get unique locations for filter
  const locations = [...new Set(
    professionals?.map(p => p.location).filter((l): l is string => !!l) || []
  )];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <section className="container px-4 mb-12">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">
              Hitta rådgivare
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Konkursförvaltare, rekonstruktörer, revisorer och jurister.
              Märkningen <span className="font-medium text-foreground">Verifierad</span> betyder
              att vi kontrollerat behörigheten. Profiler märkta{" "}
              <span className="font-medium text-foreground">Ej verifierad</span> är förifyllda
              från offentliga källor och kan tas i anspråk av byrån själv.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mt-8 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Sök på namn, företag eller specialisering..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-card border-border"
              />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="container px-4 mb-8">
          {/* Category Pills */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(categoryLabels) as CategoryFilter[]).map((category) => {
              const Icon = categoryIcons[category];
              return (
                <Button
                  key={category}
                  variant={categoryFilter === category ? "accent" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(category)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {categoryLabels[category]}
                </Button>
              );
            })}
          </div>

          {/* Location Filter */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Alla orter</option>
                {locations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="container px-4">
          {professionalsLoading ? (
            <div className="py-12">
              <p className="text-muted-foreground">Hämtar rådgivare…</p>
            </div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-8">
              <h3 className="text-lg font-semibold text-foreground">Inga träffar</h3>
              <p className="mt-1 text-muted-foreground">
                Här visas rådgivare som matchar sökningen, kategorin och orten.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setLocationFilter("");
                }}
              >
                Visa alla rådgivare
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Visar {filteredProfessionals.length} rådgivare
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProfessionals.map(professional => (
                  <ProfessionalCard
                    key={professional.id}
                    professional={professional}
                    rating={getAverageRating(professional.id)}
                    caseRecord={latestCase ?? null}
                    alreadyContacted={(caseShares ?? []).some(
                      (s) =>
                        s.professionalId === professional.id &&
                        (s.status === "sent" || s.status === "unlocked"),
                    )}
                    myClaim={
                      // Ett väntande anspråk trumfar ett gammalt avslag.
                      (myClaims ?? [])
                        .filter((c) => c.professionalId === professional.id)
                        .sort(
                          (a, b) =>
                            Number(b.status === "pending") - Number(a.status === "pending") ||
                            b.createdAt.localeCompare(a.createdAt),
                        )[0] ?? null
                    }
                  />
                ))}
              </div>
            </>
          )}
        </section>
        {/* Supply-side entry point: the catalogue is only useful if advisors
            can actually get into it. */}
        <section className="container px-4 mt-16">
          <div className="rounded-md border border-border bg-card p-6 md:p-8">
            <h2 className="font-display text-2xl text-foreground">
              Är du konkursförvaltare, rekonstruktör, revisor eller jurist?
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Ansök om att synas i katalogen. Vi kontrollerar behörighet innan
              publicering, så företag vet vad listan är värd.
            </p>
            <Button variant="accent" size="lg" className="mt-6" asChild>
              <Link to="/for-radgivare">Anslut dig som rådgivare</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Marketplace;
