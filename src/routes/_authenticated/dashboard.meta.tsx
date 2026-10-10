import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Facebook, Instagram, Loader2, RefreshCw, Send, Unplug, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMyShop, useShopProducts, type Product } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import {
  metaStatus, metaAuthUrl, metaExchange, metaListPages, metaSelectPage, metaDisconnect, metaPublish, metaRefreshStats,
} from "@/lib/meta.functions";

type Search = { code?: string; state?: string; error_description?: string };

export const Route = createFileRoute("/_authenticated/dashboard/meta")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s["code"] === "string" ? s["code"] : undefined,
    state: typeof s["state"] === "string" ? s["state"] : undefined,
    error_description: typeof s["error_description"] === "string" ? s["error_description"] : undefined,
  }),
  head: () => ({ meta: [
    { title: "Facebook & Instagram — MarketNet" },
    { name: "description", content: "Publiez vos produits sur Facebook et Instagram." },
    { property: "og:title", content: "Facebook & Instagram — MarketNet" },
    { property: "og:description", content: "Publication automatique de vos produits sur Meta." },
  ] }),
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
  const pages = useQuery({ queryKey: ["metaPages"], enabled: !!conn && !conn.pageSelected, queryFn: () => pagesFn() });

  useEffect(() => {
    if (search.error_description) { toast.error(search.error_description); navigate({ to: "/dashboard/meta", search: {}, replace: true }); return; }
    if (!search.code || !search.state || exchanged.current) return;
    exchanged.current = true;
    setBusy(true);
    exchangeFn({ data: { code: search.code, state: search.state, redirectUri: redirectUri() } })
      .then(() => { toast.success("Compte Facebook connecté"); qc.invalidateQueries({ queryKey: ["metaStatus"] }); qc.invalidateQueries({ queryKey: ["metaPages"] }); })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => { setBusy(false); navigate({ to: "/dashboard/meta", search: {}, replace: true }); });
  }, [search.code, search.state, search.error_description]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy(true);
    try { const { url } = await authFn({ data: { redirectUri: redirectUri() } }); window.top ? (window.top.location.href = url) : (window.location.href = url); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); await qc.invalidateQueries({ queryKey: ["metaStatus"] }); await qc.invalidateQueries({ queryKey: ["metaPages"] }); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (status.isLoading || !shop) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (status.error) return <p className="text-destructive">{(status.error as Error).message}</p>;
  const s = status.data!;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Facebook & Instagram</h1>
        <p className="mt-1 text-sm text-muted-foreground">Publication automatique de vos produits sur votre page Facebook et votre compte Instagram professionnel. Il s'agit de publications normales sur vos comptes, pas de publicité.</p>
      </div>

      {!s.metaAccess ? (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Disponible à partir du plan Pro</p>
          <p className="mt-1 text-sm text-muted-foreground">Votre plan actuel ({s.planName ?? "Gratuit"}) n'inclut pas la publication Meta.</p>
          <Button asChild className="mt-4"><Link to="/">Voir les plans</Link></Button>
        </div>
      ) : !conn ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3"><Facebook className="h-8 w-8 text-primary" /><Instagram className="h-8 w-8 text-primary" /></div>
          <p className="mt-3 font-semibold">Connectez votre page Facebook</p>
          <p className="mt-1 text-sm text-muted-foreground">Vous choisirez ensuite la page à utiliser. Si un compte Instagram professionnel est lié à cette page, il sera aussi disponible.</p>
          <Button className="mt-4 h-12 w-full sm:w-auto" onClick={connect} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}Se connecter avec Facebook</Button>
        </div>
      ) : !conn.pageSelected ? (
        <div className="rounded-2xl border bg-card p-6">
          <p className="font-semibold">Choisissez la page à utiliser</p>
          {pages.isLoading ? <Loader2 className="mt-4 h-5 w-5 animate-spin" /> : pages.error ? <p className="mt-3 text-sm text-destructive">{(pages.error as Error).message}</p> :
            (pages.data?.pages.length ?? 0) === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aucune page trouvée. Vérifiez que vous gérez une page Facebook et que vous avez accordé l'accès.</p> : (
            <div className="mt-4 space-y-2">
              {pages.data!.pages.map((p) => (
                <button key={p.id} disabled={busy} onClick={() => run(() => selectFn({ data: { pageId: p.id } }), "Page sélectionnée")}
                  className="flex w-full items-center justify-between rounded-xl border p-4 text-left hover:bg-secondary">
                  <span className="font-medium">{p.name}</span>
                  <span className="flex gap-1.5 text-muted-foreground"><Facebook className="h-4 w-4" />{p.instagram && <Instagram className="h-4 w-4" />}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" className="mt-4" disabled={busy} onClick={() => run(() => disconnectFn(), "Déconnecté")}>Annuler</Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Page connectée</p>
                <p className="mt-0.5 flex items-center gap-2 font-semibold"><Facebook className="h-4 w-4" />{conn.pageName}{conn.hasInstagram && <Instagram className="h-4 w-4" />}</p>
                {!conn.hasInstagram && <p className="mt-1 text-xs text-muted-foreground">Aucun compte Instagram professionnel lié à cette page.</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={connect}><RefreshCw className="h-4 w-4" />Reconnecter</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm("Déconnecter Facebook et Instagram ?")) run(() => disconnectFn(), "Déconnecté"); }}><Unplug className="h-4 w-4" />Déconnecter</Button>
              </div>
            </div>
            {conn.expired && <p className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />L'accès a expiré. Cliquez sur « Reconnecter ».</p>}
          </div>

          <section>
            <h2 className="mb-3 font-bold">Publier un produit</h2>
            <div className="space-y-2">
              {(products ?? []).filter((p) => p.status !== "hidden").map((p) => <PublishRow key={p.id} product={p} hasInstagram={conn.hasInstagram} />)}
              {products?.length === 0 && <p className="text-sm text-muted-foreground">Ajoutez d'abord des produits.</p>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Résultats des publications</h2>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => refreshFn(), "Statistiques mises à jour")}><RefreshCw className="h-4 w-4" />Actualiser</Button>
            </div>
            {s.posts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune publication pour l'instant.</p> : (
              <div className="overflow-hidden rounded-2xl border bg-card">
                {s.posts.map((p) => {
                  const prod = products?.find((x) => x.id === p.product_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-0">
                      <span className="flex min-w-0 items-center gap-2">{p.platform === "facebook" ? <Facebook className="h-4 w-4 shrink-0" /> : <Instagram className="h-4 w-4 shrink-0" />}<span className="truncate">{prod?.name ?? "Produit supprimé"}</span></span>
                      <span className="shrink-0 text-muted-foreground">{p.reach ?? 0} vues · {p.clicks ?? 0} clics · {new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">Bientôt : synchronisation du catalogue avec Meta Commerce Manager et publicités sponsorisées (budget payé par vous).</p>
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
  const [caption, setCaption] = useState(`${product.name} — ${formatPrice(Number(product.price), product.currency)}\n\n${product.description ?? ""}`.trim());
  const img = mediaUrl(product.images?.[0]);

  async function publish() {
    const platforms = [...(fb ? ["facebook" as const] : []), ...(ig ? ["instagram" as const] : [])];
    if (!platforms.length) return toast.error("Choisissez au moins une plateforme");
    setBusy(true);
    try {
      const { results } = await publishFn({ data: { productId: product.id, platforms, caption, origin: window.location.origin } });
      results.forEach((r) => r.ok ? toast.success(`Publié sur ${r.platform === "facebook" ? "Facebook" : "Instagram"}`) : toast.error(r.error ?? "Erreur"));
      qc.invalidateQueries({ queryKey: ["metaStatus"] });
      if (results.some((r) => r.ok)) setOpen(false);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">{img && <img src={img} alt="" className="h-full w-full object-cover" />}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{product.name}</p><p className="text-sm text-muted-foreground">{formatPrice(Number(product.price), product.currency)}</p></div>
        <Button size="sm" variant={open ? "ghost" : "default"} onClick={() => setOpen(!open)}>{open ? "Fermer" : <><Send className="h-4 w-4" />Publier</>}</Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <Textarea rows={4} maxLength={2000} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} />Facebook</label>
            <label className={hasInstagram ? "flex items-center gap-2" : "flex items-center gap-2 opacity-50"}><input type="checkbox" disabled={!hasInstagram} checked={ig} onChange={(e) => setIg(e.target.checked)} />Instagram</label>
            <Button className="ml-auto" disabled={busy} onClick={publish}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Publier maintenant</Button>
          </div>
        </div>
      )}
    </div>
  );
}
