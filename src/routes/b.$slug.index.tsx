import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { publicShopQuery } from "@/lib/storefront.query";
import { StoreHeader, ProductCard } from "@/components/store/StoreParts";
import { ShareButtons } from "@/components/store/ShareButtons";
import { useCart } from "@/components/store/cart";
import { cn } from "@/lib/utils";
import type { Variant } from "@/lib/marketnet";

export const Route = createFileRoute("/b/$slug/")({
  component: ShopHome,
});

function ShopHome() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicShopQuery(slug));
  const { shop, products, categories, origin } = data;
  const { add } = useCart();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<"" | "asc" | "desc">("");
  const [maxPrice, setMaxPrice] = useState("");

  const list = useMemo(() => {
    let l = products.filter((p) => (!cat || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
    const mp = Number(maxPrice);
    if (maxPrice && mp > 0) l = l.filter((p) => Number(p.price) <= mp);
    if (sort) l = [...l].sort((a, b) => (sort === "asc" ? 1 : -1) * (Number(a.price) - Number(b.price)));
    return l;
  }, [products, cat, q, sort, maxPrice]);
  const featured = products.filter((p) => p.featured);
  const filtering = q || cat || sort || maxPrice;

  return (
    <div>
      <StoreHeader shop={shop} />
      <div className="mx-auto max-w-5xl px-4">
        <div className="mt-4"><ShareButtons url={`${origin}/b/${shop.slug}`} text={`Découvrez ${shop.name} :`} /></div>

        {!filtering && featured.length > 0 && (
          <section className="mt-8">
            <h2 className="font-shop-heading text-lg font-bold">À la une</h2>
            <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
              {featured.map((p) => (
                <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
                  <ProductCard product={p} onAdd={(p.variants as Variant[]).length ? undefined : () => add({ productId: p.id, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] })}
                    href={<Link to="/b/$slug/p/$productId" params={{ slug, productId: p.id }} className="absolute inset-0" aria-label={p.name} />} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="flex h-12 items-center gap-2 rounded-shop border border-current/15 bg-shop-card px-3">
            <Search className="h-4 w-4 text-shop-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit" className="h-full flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={!cat} onClick={() => setCat(null)}>Tout</Chip>
            {categories.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
          </div>
          <div className="mt-3 flex gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 flex-1 rounded-shop border border-current/15 bg-shop-card px-2 text-sm">
              <option value="">Trier</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option>
            </select>
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Prix max" className="h-10 w-28 rounded-shop border border-current/15 bg-shop-card px-3 text-sm" />
          </div>
          {list.length === 0 ? <p className="py-12 text-center text-shop-muted">Aucun produit trouvé.</p> : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <ProductCard key={p.id} product={p}
                  onAdd={(p.variants as Variant[]).length ? undefined : () => add({ productId: p.id, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] })}
                  href={<Link to="/b/$slug/p/$productId" params={{ slug, productId: p.id }} className="absolute inset-0" aria-label={p.name} />} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-medium", active ? "bg-shop text-shop-foreground" : "border border-current/15")}>{children}</button>;
}
