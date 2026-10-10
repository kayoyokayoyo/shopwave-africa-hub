import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Facebook, Instagram, Loader2, RefreshCw, Send, Unplug,
  AlertTriangle, Lock, Zap, TrendingUp, Eye, MousePointerClick,
  CheckCircle2, ChevronUp, Sparkles, Share2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMyShop, useShopProducts, type Product } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import {
  metaStatus, metaAuthUrl, metaExchange, metaListPages,
  metaSelectPage, metaDisconnect, metaPublish, metaRefreshStats,
} from "@/lib/meta.functions";

type Search = { code?: string; state?: string; error_description?: string };

export const Route = createFileRoute("/_authenticated/dashboard/meta")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    state: typeof s["state"] === "string" ? s["state"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reseaux sociaux - MarketNet" },
      { name: "description", content: "Publiez vos produits sur Facebook et Instagram." },
      { property: "og:title", content: "Reseaux sociaux - MarketNet" },
      { property: "og:description", content: "Publication automatique de vos produits sur Meta." },
    ],
  }),
  component: MetaPage,
});

const redirectUri = () => `${window.location.origin}/dashboard/meta`;

function MetaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const statusFn = useServerFn(metaStatus);
  const authFn = useServerFn(metaAuthUrl);
  const exchangeFn = useServerFn(metaExchange);
  const pagesFn = useServerFn(metaListPages);
  const selectFn = useServerFn(metaSelectPage);
  const disconnectFn = useServerFn(metaDisconnect);
  const refreshFn = useServerFn(metaRefreshStats);
  const [busy, setBusy] = useState(false);
  const exchanged = useRef(false);

  const status = useQuery({ queryKey: ["metaStatus"], queryFn: () => statusFn() });
  const conn = status.data?.connection;
  const pages = useQuery({
    queryKey: ["metaPages"],
    enabled: !!conn && !conn.pageSelected,
    queryFn: () => pagesFn(),
  });

  useEffect(() => {
    if (search.error_description) {
      toast.error(search.error_description);
      navigate({ to: "/dashboard/meta", search: {}, replace: true });
      return;
    }
    if (!search.code || !search.state || exchanged.current) return;
    exchanged.current = true;
    setBusy(true);
    exchangeFn({ data: { code: search.code, state: search.state, redirectUri: redirectUri() } })
      .then(() => {
        toast.success("Compte Facebook connecte !");
        qc.invalidateQueries({ queryKey: ["metaStatus"] });
        qc.invalidateQueries({ queryKey: ["metaPages"] });
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => { setBusy(false); navigate({ to: "/dashboard/meta", search: {}, replace: true }); });
  }, [search.code, search.state, search.error_description]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy(true);
    try {
      const { url } = await authFn({ data: { redirectUri: redirectUri() } });
      window.location.assign(url);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["metaStatus"] });
      await qc.invalidateQueries({ queryKey: ["metaPages"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function refreshStats() {
    setBusy(true);
    try {
      const result = await refreshFn();
      await qc.invalidateQueries({ queryKey: ["metaStatus"] });
      if (result.errors.length > 0) {
        toast.error(`Statistiques incomplÃ¨tes : ${result.errors[0]}`);
      } else {
        toast.success(`Statistiques actualisÃ©es (${result.updated} publication(s))`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status.isLoading || !shop) return (
    <div className="grid place-items-center py-32 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
  if (status.error) return <p className="text-destructive">{(status.error as Error).message}</p>;
  const s = status.data!;

  const totalReach = s.posts.reduce((acc, p) => acc + (p.reach ?? 0), 0);
  const totalClicks = s.posts.reduce((acc, p) => acc + (p.clicks ?? 0), 0);
  const hasReach = s.posts.some((p) => p.reach != null);
  const hasClicks = s.posts.some((p) => p.clicks != null);
  const totalPosts = s.posts.length;
  const publishedProductIds = new Set(s.posts.map((post) => post.product_id).filter(Boolean));
  const productsToPublish = (products ?? []).filter(
    (product) => product.status !== "hidden" && !publishedProductIds.has(product.id),
  );

  // Auto-refresh stats if posts exist but stats are null (first load after publish)
  useEffect(() => {
    if (s.posts.length > 0 && s.posts.some(p => p.reach === null) && !busy) {
      refreshStats();
    }
  }, [s.posts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-4xl space-y-8">

      {/* Hero banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-8"
        style={{ background: "linear-gradient(135deg, #1877F2 0%, #E1306C 60%, #F56040 100%)" }}
      >
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute bottom-4 right-4 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-1.5 backdrop-blur-sm">
              <Share2 className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Reseaux Sociaux</span>
            </div>
            {conn?.pageSelected && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-emerald-400/20 px-3 py-1.5 backdrop-blur-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-xs font-medium text-emerald-200">Connecte</span>
              </div>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Facebook & Instagram</h1>
          <p className="mt-2 text-white/75 text-sm max-w-lg">
            Publiez vos produits automatiquement sur votre page Facebook et votre compte Instagram professionnel.
          </p>
          {conn?.pageSelected && totalPosts > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm">
              {[
                { icon: Send, label: "Publications", value: totalPosts },
                { icon: Eye, label: "Vues totales", value: hasReach ? totalReach.toLocaleString("fr-FR") : "â€”" },
                { icon: MousePointerClick, label: "Clics totaux", value: hasClicks ? totalClicks.toLocaleString("fr-FR") : "â€”" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-white/15 backdrop-blur-sm p-3 text-center">
                  <Icon className="h-4 w-4 text-white/80 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-xs text-white/60">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!s.metaAccess ? (
        <div className="rounded-3xl border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Fonctionnalite Pro</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Votre plan actuel <strong>({s.planName ?? "Gratuit"})</strong> n'inclut pas la publication sur les reseaux sociaux.
          </p>
          <Button asChild className="mt-6 h-11 px-6 rounded-xl">
            <Link to="/"><Zap className="h-4 w-4" />Passer au plan Pro</Link>
          </Button>
        </div>

      ) : !conn ? (
        <div className="rounded-3xl border bg-card overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1877F2]/10">
                <Facebook className="h-7 w-7 text-[#1877F2]" />
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E1306C]/10">
                <Instagram className="h-7 w-7 text-[#E1306C]" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Connectez vos reseaux</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Liez votre page Facebook pour publier vos produits. Si un compte Instagram professionnel est associe, il sera automatiquement disponible.
            </p>
            <Button
              id="btn-connect-facebook"
              className="mt-6 h-12 px-6 rounded-xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#1877F2,#0d5fd4)" }}
              onClick={connect}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
              Se connecter avec Facebook
            </Button>
          </div>
          <div className="border-t bg-muted/30 px-8 py-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Ce que vous obtenez</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Send, text: "Publication en 1 clic sur Facebook & Instagram" },
                { icon: TrendingUp, text: "Statistiques de portee et de clics en temps reel" },
                { icon: Sparkles, text: "Legende generee automatiquement depuis le produit" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : !conn.pageSelected ? (
        <div className="rounded-3xl border bg-card p-8">
          <h2 className="text-lg font-bold mb-1">Choisissez votre page Facebook</h2>
          <p className="text-sm text-muted-foreground mb-6">Selectionnez la page depuis laquelle vos produits seront publies.</p>
          {pages.isLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground py-6">
              <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Chargement des pages...</span>
            </div>
          ) : pages.error ? (
            <p className="text-sm text-destructive">{(pages.error as Error).message}</p>
          ) : (pages.data?.pages.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-muted/50 p-5 text-center">
              <p className="text-sm text-muted-foreground">Aucune page trouvee. Verifiez que vous gerez une page Facebook et que vous avez accorde l'acces.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.data!.pages.map((p) => (
                <button
                  key={p.id}
                  id={`btn-page-${p.id}`}
                  disabled={busy}
                  onClick={() => run(() => selectFn({ data: { pageId: p.id } }), "Page selectionnee")}
                  className="group flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2]/10">
                      <Facebook className="h-5 w-5 text-[#1877F2]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.instagram ? "Facebook + Instagram" : "Facebook uniquement"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.instagram && <Instagram className="h-4 w-4 text-[#E1306C]" />}
                    <Facebook className="h-4 w-4 text-[#1877F2]" />
                    <span className="ml-2 text-xs text-primary font-medium opacity-0 transition-opacity group-hover:opacity-100">Choisir</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" className="mt-4" disabled={busy} onClick={() => run(() => disconnectFn(), "Deconnecte")}>
            Annuler
          </Button>
        </div>

      ) : (
        <>
          <div className="rounded-3xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1877F2]/10">
                  <Facebook className="h-6 w-6 text-[#1877F2]" />
                  {conn.hasInstagram && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-[#E1306C] to-[#F56040] ring-2 ring-card">
                      <Instagram className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page connectee</p>
                  <p className="font-bold">{conn.pageName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {conn.hasInstagram ? "Facebook + Instagram connectes" : "Facebook uniquement"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" disabled={busy} onClick={connect}>
                  <RefreshCw className="h-3.5 w-3.5" />Reconnecter
                </Button>
                <Button
                  variant="outline" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5"
                  disabled={busy}
                  onClick={() => { if (confirm("Deconnecter Facebook et Instagram ?")) run(() => disconnectFn(), "Deconnecte"); }}
                >
                  <Unplug className="h-3.5 w-3.5" />Deconnecter
                </Button>
              </div>
            </div>
            {conn.expired && (
              <div className="mx-6 mb-4 flex items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                L'acces a expire. Cliquez sur Reconnecter pour rafraichir la connexion.
              </div>
            )}
            {!conn.hasInstagram && (
              <div className="mx-6 mb-4 flex items-center gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <Instagram className="h-4 w-4 shrink-0" />
                Aucun compte Instagram professionnel lie a cette page.
              </div>
            )}
          </div>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold">Publier un produit</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {productsToPublish.length} produit(s) disponible(s)
              </p>
            </div>
            <div className="space-y-3">
              {productsToPublish.map((p) => (
                <PublishRow key={p.id} product={p} hasInstagram={conn.hasInstagram} />
              ))}
              {productsToPublish.length === 0 && (
                <div className="rounded-3xl border border-dashed bg-muted/30 p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {(products ?? []).some((product) => product.status !== "hidden")
                      ? "Tous vos produits disponibles ont dÃ©jÃ  Ã©tÃ© publiÃ©s. Consultez les rÃ©sultats des publications ci-dessous."
                      : "Aucun produit Ã  publier. Ajoutez d'abord des produits depuis l'onglet Produits."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Resultats des publications</h2>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={busy} onClick={refreshStats}>
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />Actualiser
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Les statistiques peuvent prendre jusqu&apos;a 24h apres publication.</p>
            {s.posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed bg-muted/30 p-10 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune publication pour l'instant. Publiez un produit pour voir les statistiques ici.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border bg-card divide-y">
              {s.posts.map((p) => {
                  const prod = products?.find((x) => x.id === p.product_id);
                  const postUrl = p.external_id
                    ? p.platform === "facebook"
                      ? `https://www.facebook.com/${p.external_id}`
                      : `https://www.instagram.com/p/${p.external_id}/`
                    : null;
                  const rowContent = (
                    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted relative">
                        {prod?.images?.[0] ? (
                          <img src={mediaUrl(prod.images[0])!} alt={prod.name} className="h-full w-full object-cover" />
                        ) : p.platform === "facebook" ? (
                          <div className="grid h-full place-items-center bg-[#1877F2]/10"><Facebook className="h-4 w-4 text-[#1877F2]" /></div>
                        ) : (
                          <div className="grid h-full place-items-center bg-[#E1306C]/10"><Instagram className="h-4 w-4 text-[#E1306C]" /></div>
                        )}
                        {/* Platform badge */}
                        <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card ${
                          p.platform === "facebook" ? "bg-[#1877F2]" : "bg-gradient-to-br from-[#E1306C] to-[#F56040]"
                        }`}>
                          {p.platform === "facebook"
                            ? <Facebook className="h-2.5 w-2.5 text-white" />
                            : <Instagram className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{prod?.name ?? "Produit supprime"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {p.reach == null ? (
                              <span className="text-amber-500 font-medium">En attenteâ€¦</span>
                            ) : p.reach.toLocaleString("fr-FR")}
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3.5 w-3.5" />
                            {p.clicks == null ? (
                              <span className="text-amber-500 font-medium">En attenteâ€¦</span>
                            ) : p.clicks.toLocaleString("fr-FR")}
                          </span>
                        </div>
                        {postUrl && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  return postUrl ? (
                    <a key={p.id} href={postUrl} target="_blank" rel="noreferrer" className="block">
                      {rowContent}
                    </a>
                  ) : (
                    <div key={p.id}>{rowContent}</div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs text-center text-muted-foreground pb-4">
            Bientot : synchronisation du catalogue avec Meta Commerce Manager et publicites sponsorisees.
          </p>
        </>
      )}
    </div>
  );
}

function PublishRow({ product, hasInstagram }: { product: Product; hasInstagram: boolean }) {
  const qc = useQueryClient();
  const publishFn = useServerFn(metaPublish);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState(true);
  const [ig, setIg] = useState(hasInstagram);
  const [caption, setCaption] = useState(
    `${product.name} - ${formatPrice(Number(product.price), product.currency)}\n\n${product.description ?? ""}`.trim()
  );
  const img = mediaUrl(product.images?.[0]);

  async function publish() {
    const platforms = [...(fb ? ["facebook" as const] : []), ...(ig ? ["instagram" as const] : [])];
    if (!platforms.length) return toast.error("Choisissez au moins une plateforme");
    setBusy(true);
    try {
      const { results } = await publishFn({ data: { productId: product.id, platforms, caption, origin: window.location.origin } });
      results.forEach((r) =>
        r.ok
          ? toast.success(`Publie sur ${r.platform === "facebook" ? "Facebook" : "Instagram"}`)
          : toast.error(r.error ?? "Erreur")
      );
      qc.invalidateQueries({ queryKey: ["metaStatus"] });
      if (results.some((r) => r.ok)) setOpen(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-card transition-all duration-200 ${open ? "shadow-md" : "hover:shadow-sm"}`}>
      <div className="flex items-center gap-4 p-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {img && <img src={img} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-sm">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatPrice(Number(product.price), product.currency)}</p>
        </div>
        <Button
          id={`btn-publish-${product.id}`}
          size="sm"
          variant={open ? "secondary" : "default"}
          className="rounded-xl shrink-0"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <><Send className="h-4 w-4" />Publier</>}
        </Button>
      </div>
      {open && (
        <div className="border-t bg-muted/30 px-4 pb-4 pt-3 space-y-3">
          <Textarea
            rows={4}
            maxLength={2000}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="rounded-xl resize-none text-sm"
            placeholder="Legende de la publication..."
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
              <input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} className="accent-[#1877F2]" />
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              Facebook
            </label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm transition-colors ${hasInstagram ? "hover:bg-muted/50" : "opacity-40 cursor-not-allowed"}`}>
              <input type="checkbox" disabled={!hasInstagram} checked={ig} onChange={(e) => setIg(e.target.checked)} className="accent-[#E1306C]" />
              <Instagram className="h-4 w-4 text-[#E1306C]" />
              Instagram
            </label>
            <Button
              id={`btn-publish-now-${product.id}`}
              className="ml-auto rounded-xl"
              disabled={busy}
              onClick={publish}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publier maintenant
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-right">{caption.length}/2000 caracteres</p>
        </div>
      )}
    </div>
  );
}

