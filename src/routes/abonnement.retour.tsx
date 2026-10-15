import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Clock, RefreshCw, ArrowLeft, Receipt, FileDown, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaymentStatus } from "@/lib/subscriptions.functions";
import { formatCDF } from "@/lib/subscriptions";

export const Route = createFileRoute("/abonnement/retour")({
  head: () => ({
    meta: [
      { title: "Vérification du paiement — MarketNet" },
      { name: "description", content: "Vérification de votre paiement d'abonnement MarketNet." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : null,
  }),
  component: PaymentReturnPage,
});

type PollState =
  | { phase: "polling" }
  | { phase: "success"; data: PaymentData }
  | { phase: "failed"; reason: string }
  | { phase: "timeout" }
  | { phase: "no-ref" };

interface PaymentData {
  id: string;
  plan_id: string;
  period: string;
  montant_usd?: number | null;
  montant_cdf: number | null;
  currency?: string | null;
  montant_debite: number | null;
  frais: number | null;
  paye_le: string | null;
  transaction_id: string | null;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  business: "Business",
};

const PERIOD_LABELS: Record<string, string> = {
  mensuel: "mensuel",
  annuel: "annuel",
};

function PaymentReturnPage() {
  const { ref: paymentId } = Route.useSearch();
  const navigate = useNavigate();
  const getStatusFn = useServerFn(getPaymentStatus);

  const [state, setState] = useState<PollState>(
    paymentId ? { phase: "polling" } : { phase: "no-ref" }
  );
  const [dots, setDots] = useState(".");

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(Date.now());

  // Animated dots for "polling" state
  useEffect(() => {
    if (state.phase !== "polling") return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, [state.phase]);

  // Polling loop
  useEffect(() => {
    if (!paymentId || state.phase !== "polling") return;

    async function poll() {
      try {
        const result = await getStatusFn({ data: { paymentId: paymentId! } });

        if (result.statut === "payé") {
          clearTimeout(timeoutTimer.current!);
          setState({
            phase: "success",
            data: {
              id: result.id,
              plan_id: result.plan_id,
              period: result.period,
              montant_cdf: result.montant_cdf,
              montant_debite: result.montant_debite,
              frais: result.frais,
              paye_le: result.paye_le,
              transaction_id: result.transaction_id,
            },
          });
          return;
        }

        if (result.statut === "échoué" || result.statut === "annulé") {
          clearTimeout(timeoutTimer.current!);
          setState({
            phase: "failed",
            reason:
              result.statut === "annulé"
                ? "Le paiement a été annulé."
                : "Le paiement a échoué. Vérifiez votre moyen de paiement et réessayez.",
          });
          return;
        }

        // Encore en_attente ou à_vérifier — continuer si timeout pas atteint
        if (Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
          pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (_err) {
        if (Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
          pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    // Timeout global : après 60s on arrête
    timeoutTimer.current = setTimeout(() => {
      clearTimeout(pollTimer.current!);
      setState((s) => (s.phase === "polling" ? { phase: "timeout" } : s));
    }, POLL_TIMEOUT_MS);

    poll();

    return () => {
      clearTimeout(pollTimer.current!);
      clearTimeout(timeoutTimer.current!);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendu ──

  if (state.phase === "no-ref") {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold">Lien invalide</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien de retour est invalide ou a expiré.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/dashboard/reglages" })}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux réglages
          </Button>
        </div>
      </PageShell>
    );
  }

  if (state.phase === "polling") {
    return (
      <PageShell>
        <div className="text-center space-y-5">
          <div className="relative mx-auto h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-9 w-9 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Vérification du paiement{dots}</h1>
            <p className="text-sm text-muted-foreground">
              Nous confirmons votre paiement avec la passerelle SasPay.
              <br />
              Cela peut prendre jusqu'à 60 secondes.
            </p>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Ne fermez pas cette page.
          </p>
        </div>
      </PageShell>
    );
  }

  if (state.phase === "success") {
    const { data } = state;
    const planLabel = PLAN_LABELS[data.plan_id] ?? data.plan_id;
    const periodLabel = PERIOD_LABELS[data.period] ?? data.period;

    return (
      <PageShell>
        <div className="space-y-6">
          {/* En-tête succès */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping animation-delay-100" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                Paiement confirmé !
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Votre abonnement <strong>{planLabel}</strong> ({periodLabel}) est maintenant actif.
              </p>
            </div>
          </div>

          {/* Reçu */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Reçu de paiement
              </span>
            </div>
            <div className="divide-y text-sm">
              <ReceiptRow label="Plan souscrit" value={`${planLabel} (${periodLabel})`} />
              <ReceiptRow
                label="Montant facturé"
                value={formatCDF(data.montant_cdf ?? 0)}
              />
              {data.montant_debite != null && (
                <ReceiptRow
                  label="Montant débité"
                  value={formatCDF(data.montant_debite)}
                />
              )}
              {data.frais != null && data.frais > 0 && (
                <ReceiptRow
                  label="Frais de paiement"
                  value={formatCDF(data.frais)}
                  muted
                />
              )}
              {data.paye_le && (
                <ReceiptRow
                  label="Date de paiement"
                  value={new Date(data.paye_le).toLocaleString("fr-FR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                />
              )}
              {data.transaction_id && (
                <ReceiptRow
                  label="Référence transaction"
                  value={data.transaction_id}
                  mono
                />
              )}
              <ReceiptRow label="Référence paiement" value={data.id} mono />
            </div>
          </div>

          {/* Notification envoi automatique email */}
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 text-xs">
            <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="leading-snug">
              <span className="font-semibold block">Facture PDF envoyée par e-mail</span>
              <span className="text-[11px] opacity-80">Votre reçu officiel a été transmis automatiquement.</span>
            </div>
          </div>

          {/* Bouton de téléchargement de la facture */}
          <Button
            variant="outline"
            className="w-full rounded-xl font-semibold h-11 text-xs gap-2 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
            onClick={() => {
              window.open(`/api/public/invoice-pdf?paymentId=${data.id}`, "_blank");
            }}
          >
            <FileDown className="h-4 w-4" />
            Télécharger la facture PDF
          </Button>

          <Button
            className="w-full rounded-xl font-bold h-11 gap-2"
            onClick={() => navigate({ to: "/dashboard/abonnement" })}
          >
            Accéder à mon tableau de bord
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </PageShell>
    );
  }

  if (state.phase === "failed") {
    return (
      <PageShell>
        <div className="text-center space-y-5">
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400">
              Paiement non abouti
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{state.reason}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard/reglages" })}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Mes réglages
            </Button>
            <Button
              onClick={() => navigate({ to: "/dashboard/reglages" })}
              className="rounded-xl font-bold"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // timeout
  return (
    <PageShell>
      <div className="text-center space-y-5">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-amber-500/10">
          <Clock className="h-10 w-10 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Paiement non confirmé</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nous n'avons pas pu confirmer votre paiement dans le délai imparti.
            <br />
            Il peut être en cours de traitement.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/dashboard/reglages" })}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Vérifier mon abonnement
          </Button>
          <Button
            onClick={() => {
              startedAt.current = Date.now();
              setState({ phase: "polling" });
            }}
            className="rounded-xl font-bold"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer la vérification
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

// ── Composants utilitaires ─────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / marque */}
        <div className="text-center mb-8">
          <span className="font-extrabold text-2xl tracking-tight text-foreground">
            Market<span className="text-primary">Net</span>
          </span>
        </div>
        <div className="rounded-3xl border bg-card shadow-lg p-6 sm:p-8">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Des questions ? Contactez{" "}
          <a
            href="mailto:support@marketnet.cd"
            className="underline underline-offset-2 hover:text-foreground"
          >
            support@marketnet.cd
          </a>
        </p>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  muted = false,
  mono = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span
        className={`text-xs font-semibold text-right break-all ${
          muted ? "text-muted-foreground" : "text-foreground"
        } ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
