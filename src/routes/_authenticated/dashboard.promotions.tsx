import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Play,
  Pause,
  Trash2,
  Copy,
  GripVertical,
  Calendar,
  Eye,
  MousePointerClick,
  Share2,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ArrowUpDown,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Package,
  Layers,
  Percent,
  X,
  Loader2,
  ImagePlus,
  LayoutTemplate,
  SplitSquareVertical,
  Flame,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts, type Product } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { compressAndUpload } from "@/lib/upload";
import { cloudinaryUploadSignature } from "@/lib/cloudinary.functions";
import {
  PROMO_TEMPLATES,
  PROMO_STATUS,
  promoLiveState,
  formatDate,
  applyDiscount,
  discountLabel,
  type PromoTemplate,
  type DiscountType,
  type Promotion,
} from "@/lib/promotions";
import { PromoSlide } from "@/components/promo/PromoSlide";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions — MarketNet" },
      { name: "description", content: "Gérez les offres et bannières promotionnelles de votre boutique." },
    ],
  }),
  component: PromotionsPage,
});

type PromotionWithProducts = Promotion & {
  products: {
    product_id: string;
    position: number;
    discount_type: string | null;
    discount_value: number | null;
  }[];
  stats?: { views: number; clicks: number };
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  image_url: string | null;
  template: PromoTemplate;
  discount_type: DiscountType | "none";
  discount_value: string;
  badge_label: string;
  button_label: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "published" | "paused";
  selectedProducts: {
    product_id: string;
    discount_type: DiscountType | "none" | "default";
    discount_value: string;
  }[];
};

function PromotionsPage() {
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [promoToDelete, setPromoToDelete] = useState<string | null>(null);

  // Fetch shop plan
  const { data: plan } = useQuery({
    queryKey: ["shop-plan", shop?.plan_id],
    enabled: !!shop?.plan_id,
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("id", shop!.plan_id).single();
      return data;
    },
  });

  // Fetch promotions
  const { data: promotions, isLoading } = useQuery({
    queryKey: ["promotions", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data: promos, error } = await supabase
        .from("promotions")
        .select(`
          *,
          promotion_products!promotion_products_promotion_id_fkey (product_id, position, discount_type, discount_value)
        `)
        .eq("shop_id", shop!.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Also fetch events counts per promo
      const promoIds = (promos ?? []).map((p) => p.id);
      let eventCounts: Record<string, { views: number; clicks: number }> = {};
      if (promoIds.length > 0) {
        const { data: events } = await supabase
          .from("promotion_events")
          .select("promotion_id, kind")
          .in("promotion_id", promoIds);

        if (events) {
          for (const ev of events) {
            if (!eventCounts[ev.promotion_id]) eventCounts[ev.promotion_id] = { views: 0, clicks: 0 };
            if (ev.kind === "view") eventCounts[ev.promotion_id].views++;
            if (ev.kind === "click") eventCounts[ev.promotion_id].clicks++;
          }
        }
      }

      return (promos ?? []).map((p) => {
        const { promotion_products, ...restPromo } = p as any;
        return {
          ...restPromo,
          products: (promotion_products ?? []).sort((a: any, b: any) => a.position - b.position),
          stats: eventCounts[p.id] || { views: 0, clicks: 0 },
        };
      }) as PromotionWithProducts[];
    },
  });

  const activeCount = useMemo(() => {
    return (promotions ?? []).filter((p) => promoLiveState(p) === "active").length;
  }, [promotions]);

  const maxActive = plan?.max_active_promotions ?? null;
  const isLimitReached = maxActive !== null && activeCount >= maxActive;

  const blankForm = (): FormState => ({
    title: "",
    description: "",
    image_url: null,
    template: (plan?.promo_templates?.[0] as PromoTemplate) || "fullscreen",
    discount_type: "percent",
    discount_value: "",
    badge_label: "",
    button_label: "Voir l'offre",
    starts_at: "",
    ends_at: "",
    status: isLimitReached ? "draft" : "published",
    selectedProducts: [],
  });

  const editForm = (p: PromotionWithProducts): FormState => ({
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    image_url: p.image_url,
    template: p.template as PromoTemplate,
    discount_type: (p.discount_type as DiscountType) || "none",
    discount_value: p.discount_value ? String(p.discount_value) : "",
    badge_label: (p as any).badge_label ?? "",
    button_label: p.button_label,
    starts_at: p.starts_at ? new Date(p.starts_at).toISOString().slice(0, 16) : "",
    ends_at: p.ends_at ? new Date(p.ends_at).toISOString().slice(0, 16) : "",
    status: p.status as "draft" | "published" | "paused",
    selectedProducts: p.products.map((pp) => ({
      product_id: pp.product_id,
      discount_type: pp.discount_type ? (pp.discount_type as DiscountType) : "default",
      discount_value: pp.discount_value ? String(pp.discount_value) : "",
    })),
  });

  async function toggleStatus(p: PromotionWithProducts) {
    const nextStatus = p.status === "published" ? "paused" : "published";
    if (nextStatus === "published" && maxActive !== null && activeCount >= maxActive) {
      toast.error(`Limite de ${maxActive} promotion(s) active(s) atteinte sur votre plan.`);
      return;
    }
    const { error } = await supabase.from("promotions").update({ status: nextStatus }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(nextStatus === "published" ? "Promotion activée" : "Promotion mise en pause");
    qc.invalidateQueries({ queryKey: ["promotions", shop?.id] });
  }

  async function duplicatePromo(p: PromotionWithProducts) {
    const promoRow = {
      shop_id: p.shop_id,
      title: `${p.title} (Copie)`.slice(0, 80),
      description: p.description,
      image_url: p.image_url,
      template: p.template,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      badge_label: p.badge_label,
      button_label: p.button_label,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      is_hidden: p.is_hidden ?? false,
      status: "draft",
      position: promotions?.length ?? 0,
    };

    const { data: newPromo, error } = await supabase
      .from("promotions")
      .insert(promoRow)
      .select()
      .single();

    if (error) return toast.error(error.message);

    if (p.products && p.products.length > 0) {
      const { error: ppErr } = await supabase.from("promotion_products").insert(
        p.products.map((pp) => ({
          promotion_id: newPromo.id,
          product_id: pp.product_id,
          position: pp.position,
          discount_type: pp.discount_type,
          discount_value: pp.discount_value,
        }))
      );
      if (ppErr) {
        toast.error(ppErr.message);
        return;
      }
    }

    toast.success("Promotion dupliquée");
    qc.invalidateQueries({ queryKey: ["promotions", shop?.id] });
  }

  async function confirmDeletePromo() {
    if (!promoToDelete) return;
    const id = promoToDelete;
    setPromoToDelete(null);
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Promotion supprimée");
    qc.invalidateQueries({ queryKey: ["promotions", shop?.id] });
  }

  async function movePosition(index: number, direction: "up" | "down") {
    if (!promotions) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= promotions.length) return;

    const list = [...promotions];
    const temp = list[index]!;
    list[index] = list[targetIdx]!;
    list[targetIdx] = temp;

    // Save updated positions
    for (let i = 0; i < list.length; i++) {
      await supabase.from("promotions").update({ position: i }).eq("id", list[i]!.id);
    }
    qc.invalidateQueries({ queryKey: ["promotions", shop?.id] });
  }

  if (!shop) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Promotions & Bannières</h1>
          <p className="text-sm text-muted-foreground">
            {promotions?.length ?? 0} promotion(s) · {activeCount} active(s)
            {maxActive !== null && ` sur ${maxActive} max`}
          </p>
        </div>
        <Button onClick={() => setForm(blankForm())} className="rounded-xl">
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle promotion
        </Button>
      </div>

      {isLimitReached && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-700 dark:text-amber-300">
          <Sparkles className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Limite de promotions actives atteinte ({maxActive})</p>
            <p className="opacity-90">
              Mettez en pause une offre existante ou passez à un plan supérieur pour en diffuser davantage sur votre boutique.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center">Chargement des promotions…</p>
      ) : !promotions || promotions.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed p-10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Tag className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Aucune promotion en cours</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Créez votre première offre promotionnelle pour afficher une bannière dynamique en haut de votre boutique.
            </p>
          </div>
          <Button onClick={() => setForm(blankForm())} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Créer une promotion
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {promotions.map((p, idx) => {
            const liveState = promoLiveState(p);
            const statusBadge =
              liveState === "active"
                ? { label: "En ligne", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
                : liveState === "scheduled"
                ? { label: "Programmée", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" }
                : liveState === "ended"
                ? { label: "Terminée", cls: "bg-muted text-muted-foreground" }
                : PROMO_STATUS[p.status] || { label: p.status, cls: "bg-muted text-muted-foreground" };

            const disc = discountLabel(p.discount_type, p.discount_value, shop.currency);

            return (
              <div
                key={p.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Order control */}
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePosition(idx, "up")}
                      className="p-1 hover:text-foreground disabled:opacity-20"
                      title="Monter"
                    >
                      ▲
                    </button>
                    <span className="text-[10px] font-mono">{idx + 1}</span>
                    <button
                      type="button"
                      disabled={idx === promotions.length - 1}
                      onClick={() => movePosition(idx, "down")}
                      className="p-1 hover:text-foreground disabled:opacity-20"
                      title="Descendre"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-muted relative">
                    {p.image_url ? (
                      <img src={mediaUrl(p.image_url)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs font-bold text-muted-foreground">Minimal</div>
                    )}
                    {disc && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-bold text-white">
                        {disc}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base truncate">{p.title}</h3>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", statusBadge.cls)}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{p.products.length} produit(s) lié(s)</span>
                      <span>•</span>
                      <span>Modèle : {PROMO_TEMPLATES.find((t) => t.id === p.template)?.name || p.template}</span>
                      {p.ends_at && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Jusqu'au {formatDate(p.ends_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Stats pill */}
                    <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-blue-500" /> {p.stats?.views ?? 0} vue(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5 text-orange-500" /> {p.stats?.clicks ?? 0} clic(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = p.products.length > 1
                        ? `${window.location.origin}/b/${shop.slug}/promo/${p.id}?src=share`
                        : `${window.location.origin}/b/${shop.slug}?promo=${p.id}&src=share`;
                      navigator.clipboard.writeText(link);
                      toast.success("Lien de la promotion copié !");
                    }}
                    className="rounded-xl h-8 px-2.5 text-xs gap-1"
                    title="Copier le lien de la promotion"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Copier le lien
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = p.products.length > 1
                        ? `${window.location.origin}/b/${shop.slug}/promo/${p.id}?src=share`
                        : `${window.location.origin}/b/${shop.slug}?promo=${p.id}&src=share`;
                      const text = `Découvrez notre offre « ${p.title} » sur ${shop.name} : ${link}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    }}
                    className="rounded-xl h-8 px-2.5 text-xs gap-1 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500/10 dark:text-emerald-400"
                    title="Partager sur WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStatus(p)}
                    className="rounded-xl h-8 px-2"
                    title={p.status === "published" ? "Mettre en pause" : "Activer"}
                  >
                    {p.status === "published" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => duplicatePromo(p)} className="rounded-xl h-8 px-2" title="Dupliquer">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setForm(editForm(p))} className="rounded-xl h-8 text-xs">
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPromoToDelete(p.id)}
                    className="rounded-xl h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Promotion Form Sheet */}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-hidden rounded-t-3xl sm:mx-auto sm:max-w-4xl lg:max-w-5xl p-0 flex flex-col">
          {form && (
            <PromoFormModal
              form={form}
              shop={shop}
              planTemplates={plan?.promo_templates ?? ["fullscreen", "split", "badge", "minimal", "countdown"]}
              products={products ?? []}
              onClose={() => setForm(null)}
              onDone={() => {
                setForm(null);
                qc.invalidateQueries({ queryKey: ["promotions", shop.id] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      {/* Confirmation Suppression Promotion */}
      <AlertDialog open={!!promoToDelete} onOpenChange={(open) => !open && setPromoToDelete(null)}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Supprimer cette promotion ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La bannière promotionnelle et ses statistiques seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePromo}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const WIZARD_STEPS = [
  { id: "visual", label: "Modèle & Image", desc: "Choisissez le modèle et le visuel" },
  { id: "content", label: "Message & Réduction", desc: "Titre, réduction et validité" },
  { id: "products", label: "Articles liés", desc: "Produits concernés par l'offre" },
  { id: "review", label: "Confirmation", desc: "Vérification et mise en ligne" },
] as const;

function PromoFormModal({
  form: initial,
  shop,
  planTemplates,
  products,
  onClose,
  onDone,
}: {
  form: FormState;
  shop: any;
  planTemplates: string[];
  products: Product[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [step, setStep] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [previewTab, setPreviewTab] = useState<"desktop" | "mobile">("mobile");
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const signUpload = useServerFn(cloudinaryUploadSignature);

  const set = (p: Partial<FormState>) => setF((prev) => ({ ...prev, ...p }));
  const availableTemplates = PROMO_TEMPLATES;
  const TEMPLATE_ICONS: Record<PromoTemplate, any> = {
    fullscreen: LayoutTemplate,
    split: SplitSquareVertical,
    badge: Zap,
    countdown: Flame,
    minimal: Sparkles,
  };
  const sel = "flex h-12 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  async function handleImageUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await compressAndUpload(file, "promo", signUpload, 1400);
      set({ image_url: url });
      toast.success("Image ajoutée");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function toggleProductSelection(p: Product) {
    const exists = f.selectedProducts.find((sp) => sp.product_id === p.id);
    if (exists) {
      set({ selectedProducts: f.selectedProducts.filter((sp) => sp.product_id !== p.id) });
    } else {
      if (f.selectedProducts.length >= 24) {
        toast.error("Maximum 24 produits");
        return;
      }
      set({
        selectedProducts: [
          ...f.selectedProducts,
          { product_id: p.id, discount_type: "default", discount_value: "" },
        ],
      });
    }
  }

  function updateProductDiscount(
    productId: string,
    discount_type: DiscountType | "none" | "default",
    discount_value: string
  ) {
    set({
      selectedProducts: f.selectedProducts.map((sp) =>
        sp.product_id === productId ? { ...sp, discount_type, discount_value } : sp
      ),
    });
  }

  function handleNextStep() {
    if (step === 0) {
      if (f.template !== "minimal" && !f.image_url) {
        return toast.error("Une image est requise pour ce modèle");
      }
    }
    if (step === 1) {
      if (!f.title.trim()) return toast.error("Le titre est requis");
      if (f.title.length > 80) return toast.error("Titre trop long (80 max)");
      if (!f.badge_label.trim()) return toast.error("Le badge / étiquette est obligatoire");
      if (f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at)) {
        return toast.error("La date de fin doit être après le début");
      }
    }
    setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  }

  async function handleSave(statusToSet: "draft" | "published") {
    if (!f.title.trim()) return toast.error("Le titre est requis");
    if (!f.badge_label.trim()) return toast.error("Le badge / étiquette est obligatoire");
    if (f.template !== "minimal" && !f.image_url) {
      return toast.error("Une image est requise pour ce modèle");
    }

    const defaultVal = f.discount_value ? Number(f.discount_value.replace(",", ".")) : null;

    setBusy(true);
    try {
      const promoRow = {
        shop_id: shop.id,
        title: f.title.trim(),
        description: f.description.trim() || null,
        image_url: f.image_url,
        template: f.template,
        discount_type: f.discount_type === "none" ? null : f.discount_type,
        discount_value: f.discount_type === "none" ? null : defaultVal,
        badge_label: f.badge_label.trim() || null,
        button_label: f.button_label.trim() || "Voir l'offre",
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
        status: statusToSet,
      };

      let promoId = f.id;
      if (promoId) {
        const { error } = await supabase.from("promotions").update(promoRow).eq("id", promoId);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from("promotions").insert(promoRow).select().single();
        if (error) throw error;
        promoId = created.id;
      }

      await supabase.from("promotion_products").delete().eq("promotion_id", promoId);

      if (f.selectedProducts.length > 0) {
        const productRows = f.selectedProducts.map((sp, idx) => {
          const customVal = sp.discount_value ? Number(sp.discount_value.replace(",", ".")) : null;
          return {
            promotion_id: promoId!,
            product_id: sp.product_id,
            position: idx,
            discount_type: sp.discount_type === "default" ? null : sp.discount_type === "none" ? null : sp.discount_type,
            discount_value: sp.discount_type === "default" || sp.discount_type === "none" ? null : customVal,
          };
        });
        const { error: ppError } = await supabase.from("promotion_products").insert(productRows);
        if (ppError) throw ppError;
      }

      toast.success(f.id ? "Promotion mise à jour" : "Promotion créée");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const previewSlideData = {
    title: f.title || "Titre de l'offre",
    description: f.description || null,
    image_url: f.image_url,
    template: f.template,
    discount_type: f.discount_type === "none" ? null : f.discount_type,
    discount_value: f.discount_value ? Number(f.discount_value.replace(",", ".")) : null,
    badge_label: f.badge_label || null,
    button_label: f.button_label || "Voir l'offre",
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
  };

  const filteredCatalog = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="flex flex-col h-full max-h-[92vh] bg-background">
      {/* Header aéré et épuré (sans boutons superflus) */}
      <div className="sticky top-0 z-30 shrink-0 border-b bg-card px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm">
              {step + 1}
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                {WIZARD_STEPS[step].label}
              </h2>
              <p className="text-xs text-muted-foreground hidden sm:block truncate">
                {WIZARD_STEPS[step].desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Bouton d'aperçu pour mobile */}
            <Button
              type="button"
              variant={showMobilePreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMobilePreview((v) => !v)}
              className="lg:hidden rounded-xl h-9 px-3 text-xs font-semibold gap-1.5"
            >
              <Eye className="h-4 w-4" />
              <span>{showMobilePreview ? "Formulaire" : "Aperçu"}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={busy}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Barre de progression fluide */}
        <div className="mt-3.5 grid grid-cols-4 gap-2">
          {WIZARD_STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => idx <= step && setStep(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === step
                  ? "bg-primary shadow-xs"
                  : idx < step
                  ? "bg-primary/45"
                  : "bg-muted"
              )}
              aria-label={s.label}
            />
          ))}
        </div>
      </div>

      {/* Conteneur principal sans double-scrollbar étouffante */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
          {/* Formulaire gauche */}
          <div className={cn("space-y-5 lg:col-span-7", showMobilePreview && "hidden lg:block")}>
            {/* STEP 1: Modèle & Image */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">Modèle d'affichage</Label>
                    <span className="text-xs text-muted-foreground font-semibold">5 modèles disponibles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {availableTemplates.map((t) => {
                      const isSelected = f.template === t.id;
                      const Icon = TEMPLATE_ICONS[t.id] || Sparkles;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => set({ template: t.id })}
                          className={cn(
                            "group flex flex-col text-left p-3.5 rounded-2xl border transition-all text-xs relative",
                            isSelected
                              ? "border-primary bg-primary/10 font-bold ring-2 ring-primary/20 shadow-xs"
                              : "border-border hover:bg-muted/50 hover:border-muted-foreground/30"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-xl transition-colors",
                              isSelected ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground group-hover:text-foreground"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                              isSelected ? "bg-primary/20 text-primary" : "bg-muted/80 text-muted-foreground"
                            )}>
                              {t.tag}
                            </span>
                          </div>
                          <span className="truncate text-foreground font-bold text-sm">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {t.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      Photo d'illustration {f.template === "minimal" ? "(optionnelle)" : "(requise)"}
                    </Label>
                    {f.image_url && (
                      <button
                        type="button"
                        onClick={() => set({ image_url: null })}
                        className="text-xs text-destructive hover:underline font-medium"
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative aspect-video w-36 sm:w-44 shrink-0 overflow-hidden rounded-2xl bg-muted border shadow-xs">
                      {f.image_url ? (
                        <img src={mediaUrl(f.image_url)!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6 opacity-60" />
                        </div>
                      )}
                    </div>
                    <label className="flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors px-3 text-center">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <ImagePlus className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{f.image_url ? "Changer" : "Ajouter une image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => handleImageUpload(e.target.files)}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-3">
                  <Button variant="hero" size="lg" onClick={handleNextStep} className="h-12 w-full rounded-xl font-bold">
                    Continuer vers le message
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Message & Réduction (Propre & aéré comme Produits) */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Titre de l'offre</Label>
                    <span className="text-[11px] text-muted-foreground">{f.title.length}/80</span>
                  </div>
                  <Input
                    className="h-12 rounded-xl text-base"
                    value={f.title}
                    maxLength={80}
                    placeholder="Ex. Vente Flash de fin de semaine"
                    onChange={(e) => set({ title: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Description (optionnelle)</Label>
                  <Textarea
                    rows={2}
                    maxLength={300}
                    className="rounded-xl resize-none"
                    placeholder="Détails, conditions ou informations de livraison"
                    value={f.description}
                    onChange={(e) => set({ description: e.target.value })}
                  />
                </div>

                {/* Badge personnalisé (obligatoire) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      Badge / Étiquette <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground">{f.badge_label.length}/30</span>
                  </div>
                  <Input
                    className="h-12 rounded-xl"
                    maxLength={30}
                    value={f.badge_label}
                    placeholder="Ex. Vente Flash, Promo, Nouveauté, Liquidation…"
                    onChange={(e) => set({ badge_label: e.target.value })}
                    required
                  />
                </div>

                {/* Réduction & Valeur en ligne unifiée */}
                <div className={cn("grid gap-2.5", f.discount_type !== "none" ? "grid-cols-[1fr_110px]" : "grid-cols-1")}>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Réduction globale</Label>
                    <select
                      className={sel}
                      value={f.discount_type}
                      onChange={(e) => set({ discount_type: e.target.value as any })}
                    >
                      <option value="percent">Pourcentage (%)</option>
                      <option value="amount">Montant fixe ({shop.currency})</option>
                      <option value="none">Sans réduction chiffrée</option>
                    </select>
                  </div>

                  {f.discount_type !== "none" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">Valeur</Label>
                      <Input
                        className="h-12 font-mono text-base rounded-xl"
                        inputMode="decimal"
                        placeholder={f.discount_type === "percent" ? "20" : "5000"}
                        value={f.discount_value}
                        onChange={(e) => set({ discount_value: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Bouton d'action</Label>
                  <Input
                    className="h-12 rounded-xl"
                    maxLength={30}
                    value={f.button_label}
                    placeholder="Voir l'offre"
                    onChange={(e) => set({ button_label: e.target.value })}
                  />
                </div>

                {/* Dates de début et fin côte à côte */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Début (optionnel)</Label>
                    <Input
                      type="datetime-local"
                      className="h-12 rounded-xl text-xs sm:text-sm"
                      value={f.starts_at}
                      onChange={(e) => set({ starts_at: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Fin (optionnelle)</Label>
                    <Input
                      type="datetime-local"
                      className="h-12 rounded-xl text-xs sm:text-sm"
                      value={f.ends_at}
                      onChange={(e) => set({ ends_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <Button variant="outline" size="lg" onClick={() => setStep(0)} className="h-12 rounded-xl px-5">
                    Retour
                  </Button>
                  <Button variant="hero" size="lg" onClick={handleNextStep} className="h-12 flex-1 rounded-xl font-bold">
                    Continuer vers les articles
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Produits */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Articles concernés ({f.selectedProducts.length}/24)</Label>
                    <span className="text-[11px] text-muted-foreground">
                      {f.selectedProducts.length === 0
                        ? "Action : Contact WhatsApp"
                        : f.selectedProducts.length === 1
                        ? "Action : Page du produit"
                        : "Action : Vitrine dédiée"}
                    </span>
                  </div>
                  <Input
                    className="h-12 rounded-xl"
                    placeholder="Rechercher un produit…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                {/* Articles sélectionnés */}
                {f.selectedProducts.length > 0 && (
                  <div className="space-y-2 max-h-56 overflow-y-auto rounded-2xl border p-2 bg-card">
                    {f.selectedProducts.map((sp) => {
                      const prod = products.find((p) => p.id === sp.product_id);
                      if (!prod) return null;

                      const effType = sp.discount_type === "default" ? f.discount_type : sp.discount_type;
                      const effVal =
                        sp.discount_type === "default"
                          ? f.discount_value
                            ? Number(f.discount_value.replace(",", "."))
                            : null
                          : sp.discount_value
                          ? Number(sp.discount_value.replace(",", "."))
                          : null;

                      const finalPrice = applyDiscount(Number(prod.price), effType === "none" ? null : effType, effVal);

                      return (
                        <div
                          key={sp.product_id}
                          className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-muted/40 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-card border">
                              {prod.images[0] && (
                                <img src={mediaUrl(prod.images[0])!} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[160px] sm:max-w-[220px]">{prod.name}</p>
                              <p className="text-muted-foreground">
                                <span className="line-through">{formatPrice(Number(prod.price), prod.currency)}</span>
                                {" → "}
                                <span className="font-bold text-primary">{formatPrice(finalPrice, prod.currency)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <select
                              value={sp.discount_type}
                              onChange={(e) => updateProductDiscount(sp.product_id, e.target.value as any, sp.discount_value)}
                              className="h-8 rounded-lg border border-input bg-card px-2 text-[11px]"
                            >
                              <option value="default">Par défaut</option>
                              <option value="percent">% Perso</option>
                              <option value="amount">Montant perso</option>
                              <option value="none">Sans remise</option>
                            </select>

                            {sp.discount_type !== "default" && sp.discount_type !== "none" && (
                              <Input
                                type="number"
                                className="h-8 w-14 text-xs font-mono rounded-lg px-1.5"
                                value={sp.discount_value}
                                onChange={(e) => updateProductDiscount(sp.product_id, sp.discount_type, e.target.value)}
                              />
                            )}

                            <button
                              type="button"
                              onClick={() => toggleProductSelection(prod)}
                              className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive"
                              aria-label="Retirer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Liste catalogue rapide */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Cliquez sur un produit pour l'ajouter :</p>
                  <div className="max-h-44 overflow-y-auto rounded-2xl border p-1 bg-card divide-y divide-border/40">
                    {filteredCatalog.slice(0, 15).map((p) => {
                      const isSelected = f.selectedProducts.some((sp) => sp.product_id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProductSelection(p)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 p-2.5 rounded-xl text-left text-xs transition-colors",
                            isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">{formatPrice(Number(p.price), p.currency)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <Button variant="outline" size="lg" onClick={() => setStep(1)} className="h-12 rounded-xl px-5">
                    Retour
                  </Button>
                  <Button variant="hero" size="lg" onClick={handleNextStep} className="h-12 flex-1 rounded-xl font-bold">
                    Vérifier & Finaliser
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Récapitulatif */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-card p-5 space-y-3 text-xs shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <span className="text-muted-foreground">Titre de l'offre</span>
                    <span className="font-bold truncate max-w-[200px]">{f.title}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <span className="text-muted-foreground">Modèle d'affichage</span>
                    <span className="font-bold capitalize">{f.template}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <span className="text-muted-foreground">Articles associés</span>
                    <span className="font-bold">{f.selectedProducts.length} article(s)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Réduction appliquée</span>
                    <span className="font-bold">
                      {f.discount_type === "none"
                        ? "Aucune"
                        : f.discount_type === "percent"
                        ? `-${f.discount_value}%`
                        : `-${f.discount_value} ${shop.currency}`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Statut de diffusion</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => set({ status: "published" })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-center text-xs transition-all font-semibold",
                        f.status === "published"
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs"
                          : "hover:bg-muted"
                      )}
                    >
                      En ligne
                    </button>
                    <button
                      type="button"
                      onClick={() => set({ status: "draft" })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-center text-xs transition-all font-semibold",
                        f.status === "draft"
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs"
                          : "hover:bg-muted"
                      )}
                    >
                      Brouillon
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-3">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => handleSave(f.status === "draft" ? "draft" : "published")}
                    disabled={busy}
                    className="h-12 rounded-xl font-bold"
                  >
                    {busy ? "Enregistrement…" : f.status === "published" ? "Publier la promotion" : "Enregistrer le brouillon"}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setStep(2)} className="h-12 rounded-xl">
                    Retour aux articles
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Aperçu live : sticky à droite sur grand écran, ou affiché quand activé sur mobile */}
          <div
            className={cn(
              "space-y-4 lg:col-span-5",
              showMobilePreview ? "block" : "hidden lg:block"
            )}
          >
            <div className="sticky top-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Aperçu en direct
                </span>

                <div className="flex items-center gap-1 rounded-xl border bg-muted/50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("desktop")}
                    className={cn("px-2.5 py-1 rounded-lg transition-all", previewTab === "desktop" && "bg-card shadow-xs font-semibold")}
                  >
                    Large
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("mobile")}
                    className={cn("px-2.5 py-1 rounded-lg transition-all", previewTab === "mobile" && "bg-card shadow-xs font-semibold")}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-3xl border bg-card overflow-hidden shadow-xl transition-all mx-auto",
                  previewTab === "mobile" ? "max-w-[320px]" : "w-full"
                )}
              >
                <div className="px-3 py-1.5 border-b bg-muted/40 text-[10px] text-center font-mono text-muted-foreground flex justify-between">
                  <span>Modèle : {f.template}</span>
                  <span>{previewTab === "mobile" ? "Mobile" : "Bannière"}</span>
                </div>
                <div className="bg-background">
                  <PromoSlide promo={previewSlideData} currency={shop.currency} />
                </div>
              </div>

              {showMobilePreview && (
                <Button
                  variant="outline"
                  className="w-full lg:hidden rounded-xl h-12 font-medium"
                  onClick={() => setShowMobilePreview(false)}
                >
                  Revenir au formulaire
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
