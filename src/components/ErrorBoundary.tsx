import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="text-center max-w-md">
            <h1 className="mb-2 text-2xl font-display font-semibold text-foreground">
              Något gick fel
            </h1>
            <p className="mb-6 text-muted-foreground">
              Ett oväntat fel inträffade. Prova att ladda om sidan.
            </p>
            <Button variant="accent" onClick={() => window.location.assign("/")}>
              Till startsidan
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
