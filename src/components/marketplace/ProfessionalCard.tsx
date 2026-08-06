import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, MapPin, CheckCircle2, Mail, Phone, ExternalLink, Loader2, ShieldQuestion } from "lucide-react";
import { useRecordReferral } from "@/hooks/useRecordReferral";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { ContactRequestSection } from "@/components/marketplace/ContactRequestSection";
import type { CaseRecord, ProfessionalRecord, ProfileClaimRecord } from "@/data/types";

interface ProfessionalCardProps {
  professional: ProfessionalRecord;
  rating: { average: number; count: number } | null;
  /** Den inloggades eget anspråk på just den här profilen, om något. */
  myClaim?: ProfileClaimRecord | null;
  /** Aktivt ärende för "Kontakta via CLEARANCE"; null utan ärende. */
  caseRecord?: CaseRecord | null;
  /** Sant när ärendet redan har en förfrågan till den här rådgivaren. */
  alreadyContacted?: boolean;
}

/**
 * "Är detta din profil?" på förifyllda, overifierade katalogposter.
 *
 * Anspråket är starten på en manuell granskning: vi kontrollerar
 * företrädarrätten innan profilen kopplas till ett konto och märks
 * Verifierad. Kontrollen är manuell med flit: den prövar
 * företrädarrätt, vilket ingen legitimationstjänst gör åt oss.
 */
const ClaimSection = ({ professional, myClaim }: { professional: ProfessionalRecord; myClaim: ProfileClaimRecord | null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivation, setMotivation] = useState("");
  const [contact, setContact] = useState("");

  const claim = useMutation({
    mutationFn: () =>
      data.professionals.claimProfile({
        professionalId: professional.id,
        motivation: motivation.trim(),
        contact: contact.trim(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile-claims"] }),
  });

  if (myClaim?.status === "pending") {
    return (
      <p className="rounded-md bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
        Ditt anspråk är under granskning. Vi kontrollerar företrädarrätten
        manuellt och hör av oss via kontaktvägen du angav.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      {myClaim?.status === "rejected" && (
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          Ditt tidigare anspråk avslogs
          {myClaim.reviewNote ? `: ${myClaim.reviewNote}` : "."} Du kan ansöka
          igen med kompletterande underlag.
        </p>
      )}
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Företräder du {professional.company ?? professional.name}?
          </span>
          {user ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
              Är detta din profil?
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/login">Logga in och gör anspråk</Link>
            </Button>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (motivation.trim() && contact.trim()) claim.mutate();
          }}
          className="space-y-2"
        >
          <label className="block text-xs font-medium text-foreground">
            Varför är profilen din?
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="t.ex. Jag är delägare på byrån och står i förordnandelistan."
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block text-xs font-medium text-foreground">
            Kontaktväg för kontrollen
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="t.ex. växelnummer eller e-post på byråns domän"
              className="mt-1 bg-background"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!motivation.trim() || !contact.trim() || claim.isPending}
            >
              {claim.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Skicka anspråk
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Granskningen är manuell: vi kontrollerar företrädarrätten innan
            profilen kopplas till ditt konto och märks Verifierad.
          </p>
          {claim.isError && (
            <p className="text-xs text-destructive" role="alert">
              {claim.error instanceof Error ? claim.error.message : "Kunde inte skicka anspråket."}
            </p>
          )}
        </form>
      )}
    </div>
  );
};

const categoryLabels: Record<string, string> = {
  konkursforvaltare: 'Konkursförvaltare',
  rekonstruktor: 'Rekonstruktör',
  revisor: 'Revisor',
  affarsjurist: 'Affärsjurist',
  kreditbolag: 'Kreditbolag'
};

const formatPrice = (price: number) => {
  if (price === 0) return 'Kostnadsfritt';
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(price);
};

const ProfessionalCard = ({
  professional,
  rating,
  myClaim = null,
  caseRecord = null,
  alreadyContacted = false,
}: ProfessionalCardProps) => {
  const recordReferral = useRecordReferral();

  return (
    <Card className="bg-card border-border hover:border-accent/50 transition-colors duration-300 hover:shadow-lg group">
      <CardHeader className="pb-3">
        {/* min-w-0 on the name block and wrapping on the row: without both, a
            long company name pushes the category badge past the viewport on a
            narrow phone. flex-1 alone does not permit shrinking below content
            width. */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="min-w-0 break-words font-semibold text-lg text-foreground group-hover:text-accent transition-colors">
                {professional.name}
              </h3>
              {professional.verified ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Verifierad
                </span>
              ) : (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Ej verifierad
                </Badge>
              )}
            </div>
            {professional.company && professional.company !== professional.name && (
              <p className="text-sm text-muted-foreground">{professional.company}</p>
            )}
          </div>
          <Badge variant="secondary" className="flex-shrink-0 whitespace-normal text-xs">
            {categoryLabels[professional.category] || professional.category}
          </Badge>
        </div>

        {/* Rating */}
        {rating && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(rating.average)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-muted-foreground'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {rating.average.toFixed(1)} ({rating.count} {rating.count === 1 ? 'omdöme' : 'omdömen'})
            </span>
          </div>
        )}

        {/* Location */}
        {professional.location && (
          <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{professional.location}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {professional.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {professional.description}
          </p>
        )}

        {/* Specializations */}
        {professional.specializations && professional.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {professional.specializations.slice(0, 3).map((spec, index) => (
              <Badge key={index} variant="outline" className="text-xs font-normal">
                {spec}
              </Badge>
            ))}
          </div>
        )}

        {/* Fixed Prices */}
        {professional.fixedPrices.length > 0 && (
          <div className="bg-secondary/50 rounded-md p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fasta priser</p>
            <div className="space-y-1.5">
              {professional.fixedPrices.slice(0, 3).map((price, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-foreground">{price.service}</span>
                  <span className="font-medium text-accent">{formatPrice(price.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Actions.
            Each of these is the billable event the referral model rests on,
            so record it before handing off to the mail/phone client. The
            record is best-effort: a failure here must never stop someone in
            a crisis from reaching an advisor. */}
        <div className="flex gap-2 pt-2">
          {professional.email && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
              onClick={() => recordReferral(professional.id, "email")}
            >
              <a href={`mailto:${professional.email}`}>
                <Mail className="w-4 h-4 mr-2" />
                E-post
              </a>
            </Button>
          )}
          {professional.phone && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              asChild
              onClick={() => recordReferral(professional.id, "phone")}
            >
              <a href={`tel:${professional.phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Ring
              </a>
            </Button>
          )}
          {professional.website && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              onClick={() => recordReferral(professional.id, "website")}
            >
              <a href={professional.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>

        {/* Den strukturerade vägen: förfrågan med samtycke och underlag.
            Bara verifierade profiler - en förfrågan till en obekräftad
            kontaktväg vore att skicka ärendedata ut i tomma luften. */}
        {professional.verified && (
          <ContactRequestSection
            professional={professional}
            caseRecord={caseRecord}
            alreadyContacted={alreadyContacted}
          />
        )}

        {/* Förifyllda profiler kan tas i anspråk av sin rättmätiga ägare. */}
        {!professional.verified && (
          <ClaimSection professional={professional} myClaim={myClaim} />
        )}
      </CardContent>
    </Card>
  );
};

export default ProfessionalCard;
