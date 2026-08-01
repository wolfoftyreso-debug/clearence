import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, CheckCircle2, Mail, Phone, ExternalLink } from "lucide-react";
import { useRecordReferral } from "@/hooks/useRecordReferral";
import type { ProfessionalRecord } from "@/data/types";

interface ProfessionalCardProps {
  professional: ProfessionalRecord;
  rating: { average: number; count: number } | null;
}

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

const ProfessionalCard = ({ professional, rating }: ProfessionalCardProps) => {
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
              {professional.verified && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fasta priser</p>
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
      </CardContent>
    </Card>
  );
};

export default ProfessionalCard;
