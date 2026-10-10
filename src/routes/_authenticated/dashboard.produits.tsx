import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts, useShopCategories, type Product } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice, mediaUrl, type Variant } from "@/lib/marketnet";
import { compressAndUpload } from "@/lib/upload";
import { cloudinaryUploadSignature } from "@/lib/cloudinary.functions";

export const Route = createFileRoute("/_authenticated/dashboard/produits")({
  head: () => ({ meta: [{ title: "Produits — MarketNet" }, { name: "description", content: "Gérez vos produits." }, { property: "og:title", content: "Produits — MarketNet" }, { property: "og:description", content: "Gestion des produits MarketNet." }] }),
  component: ProductsPage,
});

type Form = {
  id?: string; name: string; description: string; price: string; currency: string; images: string[];
  category_id: string; stock: string; status: Product["status"]; featured: boolean; variants: { name: string; options: string }[];
};
const MAX_IMAGES = 6;

function ProductsPage() {
  const { data: shop } = useMyShop();
  const { data: products, isLoading } = useShopProducts(shop?.id);
  const { data: categories } = useShopCategories(shop?.id);
  const [form, setForm] = useState<Form | null>(null);
  const [filter, setFilter] = useState("");
  const qc = useQueryClient();
  if (!shop) return null;

  const blank = (): Form => ({ name: "", description: "", price: "", currency: shop.currency, images: [], category_id: "", stock: "", status: "active", featured: false, variants: [] });
  const edit = (p: Product): Form => ({
    id: p.id, name: p.name, description: p.description ?? "", price: String(p.price), currency: p.currency, images: p.images,
    category_id: p.category_id ?? "", stock: p.stock == null ? "" : String(p.stock), status: p.status, featured: p.featured,
    variants: ((p.variants as Variant[]) ?? []).map((v) => ({ name: v.name, options: v.options.join(", ") })),
  });
  const list = (products ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Produits</h1><p className="text-sm text-muted-foreground">{products?.length ?? 0} produit(s)</p></div>
        <Button onClick={() => setForm(blank())}><Plus />Ajouter</Button>
      </div>
      <Input className="mt-4 h-12" placeholder="Rechercher un produit…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <CategoryManager shopId={shop.id} />
      {isLoading ? <p className="mt-8 text-muted-foreground">Chargement…</p> : list.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">Aucun produit pour l'instant.</div>
      ) : (
        <div className="mt-6 space-y-2">
          {list.map((p) => (
            <button key={p.id} onClick={() => setForm(edit(p))} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-2.5 text-left">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{p.images[0] && <img src={mediaUrl(p.images[0])!} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-semibold">{p.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}{p.name}</p>
                <p className="text-sm font-bold text-primary">{formatPrice(Number(p.price), p.currency)}</p>
                <p className="text-xs text-muted-foreground">{categories?.find((c) => c.id === p.category_id)?.name ?? "Sans catégorie"}{p.stock != null && ` · Stock ${p.stock}`}</p>
              </div>
              <StatusBadge s={p.status} />
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl sm:mx-auto sm:max-w-xl">
          {form && <ProductForm key={form.id ?? "new"} initial={form} shopId={shop.id} categories={categories ?? []}
            onDone={(again) => { qc.invalidateQueries({ queryKey: ["products", shop.id] }); setForm(again ? blank() : null); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadge({ s }: { s: Product["status"] }) {
  const m = { active: ["Actif", "bg-success/15 text-success"], hidden: ["Masqué", "bg-muted text-muted-foreground"], out_of_stock: ["Rupture", "bg-destructive/15 text-destructive"] }[s];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${m[1]}`}>{m[0]}</span>;
}

function CategoryManager({ shopId }: { shopId: string }) {
  const { data: cats } = useShopCategories(shopId);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("product_categories").insert({ shop_id: shopId, name: name.trim().slice(0, 50), position: cats?.length ?? 0 });
    if (error) return toast.error(error.message);
    setName(""); qc.invalidateQueries({ queryKey: ["categories", shopId] });
  }
  async function del(id: string) {
    await supabase.from("product_categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["categories", shopId] });
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {cats?.map((c) => <span key={c.id} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm">{c.name}<button aria-label="Supprimer" onClick={() => del(c.id)}><X className="h-3.5 w-3.5" /></button></span>)}
      <div className="flex items-center gap-1">
        <Input className="h-9 w-40" placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button size="sm" variant="outline" onClick={add}><Plus /></Button>
      </div>
    </div>
  );
}

function ProductForm({ initial, shopId, categories, onDone }: { initial: Form; shopId: string; categories: { id: string; name: string }[]; onDone: (again: boolean) => void }) {
  const [f, setF] = useState<Form>(initial);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const signUpload = useServerFn(cloudinaryUploadSignature);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const sel = "flex h-12 w-full rounded-xl border border-input bg-card px-3 text-sm";

  async function addImages(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - f.images.length;
    if (room <= 0) return toast.error(`${MAX_IMAGES} photos maximum`);
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files).slice(0, room)) paths.push(await compressAndUpload(file, "product", signUpload));
      setF((x) => ({ ...x, images: [...x.images, ...paths] }));
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }

  async function save(again: boolean) {
    const price = Number(f.price.replace(",", "."));
    if (!f.name.trim()) return toast.error("Le nom est requis");
    if (!isFinite(price) || price < 0) return toast.error("Prix invalide");
    const stock = f.stock.trim() === "" ? null : parseInt(f.stock, 10);
    if (stock !== null && (isNaN(stock) || stock < 0)) return toast.error("Stock invalide");
    const row = {
      shop_id: shopId, name: f.name.trim().slice(0, 120), description: f.description.trim() || null, price, currency: f.currency,
      images: f.images, category_id: f.category_id || null, stock, status: f.status, featured: f.featured,
      variants: f.variants.filter((v) => v.name.trim() && v.options.trim()).map((v) => ({ name: v.name.trim(), options: v.options.split(",").map((o) => o.trim()).filter(Boolean) })),
    };
    setBusy(true);
    const { error } = f.id ? await supabase.from("products").update(row).eq("id", f.id) : await supabase.from("products").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(f.id ? "Produit mis à jour" : "Produit ajouté");
    onDone(again);
  }

  async function remove() {
    if (!f.id || !confirm("Supprimer ce produit ?")) return;
    await supabase.from("products").delete().eq("id", f.id);
    onDone(false);
  }

  return (
    <div className="space-y-4 pb-4">
      <SheetHeader><SheetTitle className="font-display text-xl">{f.id ? "Modifier le produit" : "Nouveau produit"}</SheetTitle></SheetHeader>
      <div>
        <Label>Photos ({f.images.length}/{MAX_IMAGES})</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {f.images.map((img, i) => (
            <div key={img} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              <img src={mediaUrl(img)!} alt="" className="h-full w-full object-cover" />
              <button aria-label="Retirer" onClick={() => set({ images: f.images.filter((_, j) => j !== i) })} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/70 text-background"><X className="h-3.5 w-3.5" /></button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1 text-[10px] text-background">Principale</span>}
            </div>
          ))}
          {f.images.length < MAX_IMAGES && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed text-muted-foreground">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addImages(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>
      </div>
      <div className="space-y-1.5"><Label>Nom</Label><Input className="h-12" value={f.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <div className="space-y-1.5"><Label>Prix</Label><Input className="h-12" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Devise</Label><select className={sel} value={f.currency} onChange={(e) => set({ currency: e.target.value })}><option>USD</option><option>CDF</option></select></div>
      </div>
      <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} maxLength={3000} value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label>Catégorie</Label><select className={sel} value={f.category_id} onChange={(e) => set({ category_id: e.target.value })}><option value="">Aucune</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label>Stock (optionnel)</Label><Input className="h-12" inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value })} /></div>
      </div>
      <div className="space-y-1.5"><Label>Statut</Label>
        <select className={sel} value={f.status} onChange={(e) => set({ status: e.target.value as Product["status"] })}><option value="active">Actif</option><option value="hidden">Masqué</option><option value="out_of_stock">Rupture de stock</option></select>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-semibold">Mettre en avant</p><p className="text-xs text-muted-foreground">Affiché en premier sur votre boutique</p></div><Switch checked={f.featured} onCheckedChange={(v) => set({ featured: v })} /></div>
      <div>
        <div className="flex items-center justify-between"><Label>Variantes (optionnel)</Label><Button size="sm" variant="ghost" onClick={() => set({ variants: [...f.variants, { name: "", options: "" }] })}><Plus />Ajouter</Button></div>
        {f.variants.map((v, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <Input className="w-28" placeholder="Taille" value={v.name} onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <Input placeholder="S, M, L" value={v.options} onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)) })} />
            <Button size="icon" variant="ghost" aria-label="Retirer" onClick={() => set({ variants: f.variants.filter((_, j) => j !== i) })}><X /></Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <Button variant="hero" size="lg" onClick={() => save(false)} disabled={busy || uploading}>Enregistrer</Button>
        {!f.id && <Button variant="outline" size="lg" onClick={() => save(true)} disabled={busy || uploading}>Enregistrer et ajouter un autre</Button>}
        {f.id && <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 />Supprimer</Button>}
      </div>
    </div>
  );
}
