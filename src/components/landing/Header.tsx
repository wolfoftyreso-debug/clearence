import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/50">
      <div className="container px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm surface-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-display text-xl text-foreground">CLEARANCE</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Funktioner
            </a>
            <a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Så fungerar det
            </a>
            <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Hitta rådgivare
            </Link>
            <Link to="/om" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Om oss
            </Link>
            <a href="/#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Kontakt
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">
                    Mitt konto
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Logga ut
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Logga in
                  </Button>
                </Link>
                <Link to="/wizard">
                  <Button variant="accent" size="sm">
                    Starta utvärdering
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-2">
              <a
                href="/#features"
                className="px-4 py-3 text-foreground hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Funktioner
              </a>
              <a
                href="/#how-it-works"
                className="px-4 py-3 text-foreground hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Så fungerar det
              </a>
              <Link
                to="/marketplace"
                className="px-4 py-3 text-foreground hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Hitta rådgivare
              </Link>
              <a
                href="/#contact"
                className="px-4 py-3 text-foreground hover:bg-secondary rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Kontakt
              </a>
              <div className="flex flex-col gap-2 mt-4 px-4">
                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="accent" className="w-full">
                        Mitt konto
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full" onClick={handleSignOut}>
                      Logga ut
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        Logga in
                      </Button>
                    </Link>
                    <Link to="/wizard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="accent" className="w-full">
                        Starta utvärdering
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
