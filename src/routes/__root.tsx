import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas ou a été déplacée.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("Route error:", error);
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });

    // Auto-retry once on hydration/network glitch
    const timer = setTimeout(() => {
      try {
        setRetrying(true);
        router.invalidate();
        reset();
      } catch {
        setRetrying(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setRetrying(true);
    router.invalidate();
    reset();
    setTimeout(() => setRetrying(false), 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Cette page n'a pas pu se charger</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vérifiez votre connexion et réessayez.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {retrying ? "Rechargement…" : "Réessayer"}
          </button>
          <a href="/" className="inline-flex h-11 items-center rounded-xl border border-input bg-card px-5 text-sm font-semibold">
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MarketNet — Votre boutique en ligne, vos commandes sur WhatsApp" },
      { name: "description", content: "Créez votre boutique en ligne en quelques minutes et recevez vos commandes sur WhatsApp." },
      { property: "og:site_name", content: "MarketNet" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#E8590C" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.jpg", type: "image/jpeg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <div id="root-loader" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #ea580c, #f97316, #3b82f6)",
          zIndex: 99999,
          transform: "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 0.4s ease, opacity 0.3s ease",
          opacity: 0,
          pointerEvents: "none",
        }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Indicateur de chargement réel non-bloquant lors des transitions de routes et actualisations
  const isLoading = router.state.status === "pending";

  useEffect(() => {
    const el = document.getElementById("root-loader");
    if (!el) return;
    if (isLoading) {
      el.style.opacity = "1";
      el.style.transform = "scaleX(0.7)";
    } else {
      el.style.transform = "scaleX(1)";
      const timer = setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => {
          el.style.transform = "scaleX(0)";
        }, 300);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      queryClient.invalidateQueries();
      router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
