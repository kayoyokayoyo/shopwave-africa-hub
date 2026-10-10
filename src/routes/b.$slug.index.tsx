import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PackageSearch, Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { publicShopQuery } from "@/lib/storefront.query";
import { StoreHeader, ProductCard } from "@/components/store/StoreParts";
import { useCart } from "@/components/store/cart";
import { cn } from "@/lib/utils";
import { formatPrice, mediaUrl, type Variant } from "@/lib/marketnet";

export const Route = createFileRoute("/b/$slug/")({
  component: ShopHome,
});

function ShopHome() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicShopQuery(slug));
  const { shop, products, categories } = data;
  const { add } = useCart();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<"" | "asc" | "desc">("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [animPlaceholder, setAnimPlaceholder] = useState("");

  // Autocomplete
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Typewriter animation for search placeholder using real product names
  useEffect(() => {
    if (products.length === 0) return;
    const names = products.slice(0, 5).map(p => p.name);
    let nameIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    function tick() {
      const name = names[nameIdx % names.length];
      if (!deleting) {
        charIdx++;
        setAnimPlaceholder("Rechercher " + name.slice(0, charIdx) + "|");
        if (charIdx >= name.length) {
          deleting = true;
          timeout = setTimeout(tick, 2000);
        } else {
          timeout = setTimeout(tick, 100);
        }
      } else {
        charIdx--;
        setAnimPlaceholder(charIdx > 0 ? "Rechercher " + name.slice(0, charIdx) + "|" : "");
        if (charIdx <= 0) {
          deleting = false;
          nameIdx++;
          timeout = setTimeout(tick, 800);
        } else {
          timeout = setTimeout(tick, 50);
        }
      }
    }
    timeout = setTimeout(tick, 1500);
    return () => clearTimeout(timeout);
  }, [products.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => {
    if (!q.trim() || q.length < 2) return [];
    const lower = q.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(lower) || p.description?.toLowerCase().includes(lower))
      .slice(0, 6);
  }, [q, products]);

  const showDropdown = focused && suggestions.length > 0;

  const closeDropdown = useCallback(() => {
    setFocused(false);
    setActiveIdx(-1);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeDropdown]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const p = suggestions[activeIdx];
      setQ(p.name); closeDropdown();
      navigate({ to: "/b/$slug/p/$productId", params: { slug, productId: p.id } });
    }
    else if (e.key === "Escape") closeDropdown();
  }

  const list = useMemo(() => {
    let l = products.filter((p) => (!cat || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
    const mp = Number(maxPrice);
    if (maxPrice && mp > 0) l = l.filter((p) => Number(p.price) <= mp);
    if (sort) l = [...l].sort((a, b) => (sort === "asc" ? 1 : -1) * (Number(a.price) - Number(b.price)));
    return l;
  }, [products, cat, q, sort, maxPrice]);

  const featured = products.filter((p) => p.featured);
  const filtering = q || cat || sort || maxPrice;
  const activeFiltersCount = [sort, maxPrice].filter(Boolean).length;

  const clearAll = () => { setQ(""); setCat(null); setSort(""); setMaxPrice(""); };

  return (
    <div className="min-h-screen">
      <StoreHeader shop={shop} />

      <div className="mx-auto max-w-5xl px-4 pb-10">

        {/* ── À la une ──────────────────────────────────── */}
        {!filtering && featured.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-shop-heading text-lg font-bold">⭐ À la une</h2>
              <span className="text-xs text-shop-muted">{featured.length} article{featured.length > 1 ? "s" : ""}</span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {featured.map((p) => (
                <div key={p.id} className="w-[160px] shrink-0 snap-start sm:w-[190px]">
                  <ProductCard
                    product={p}
                    onAdd={(p.variants as Variant[]).length ? undefined : () => add({ productId: p.id, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] })}
                    href={<Link to="/b/$slug/p/$productId" params={{ slug, productId: p.id }} className="absolute inset-0" aria-label={p.name} />}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Catalogue ─────────────────────────────────── */}
        <section className="mt-6">
          {/* Header du catalogue */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-shop/70">Catalogue</p>
              <h2 className="mt-0.5 font-shop-heading text-xl font-extrabold sm:text-2xl">Nos produits</h2>
            </div>
            <span className="rounded-full bg-shop/10 px-3 py-1 text-xs font-semibold text-shop">
              {list.length} / {products.length}
            </span>
          </div>

          {/* Barre de recherche avec autocomplete */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-shop-muted transition-colors duration-200 group-focus-within:text-shop" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
                  onFocus={() => setFocused(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={(!focused && !q && animPlaceholder) ? animPlaceholder : "Rechercher un produit..."}
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-current/10 bg-shop-card pl-10 pr-9 text-sm shadow-sm transition-all duration-200 placeholder:text-shop-muted focus:border-shop/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-shop/10"
                />
                {q && (
                  <button onClick={() => { setQ(""); closeDropdown(); inputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-shop-muted transition-colors hover:text-shop-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Bouton filtres */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "relative flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium shadow-sm transition-all duration-200",
                  showFilters || activeFiltersCount > 0
                    ? "border-shop/40 bg-shop text-shop-foreground"
                    : "border-current/10 bg-shop-card text-shop-muted hover:border-current/20 hover:text-shop-foreground"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filtres</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-shop-foreground text-[10px] font-bold text-shop">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Dropdown suggestions */}
            {showDropdown && (
              <div ref={dropdownRef}
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-current/10 bg-background shadow-2xl">
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-shop-muted">
                  Suggestions
                </p>
                <ul>
                  {suggestions.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        to="/b/$slug/p/$productId"
                        params={{ slug, productId: p.id }}
                        onClick={() => { setQ(p.name); closeDropdown(); }}
                        onMouseEnter={() => setActiveIdx(i)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors duration-100",
                          i === activeIdx ? "bg-shop/8" : "hover:bg-shop-card"
                        )}
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-shop-card">
                          {p.images[0]
                            ? <img src={mediaUrl(p.images[0])!} alt="" className="h-full w-full object-cover" />
                            : <div className="grid h-full place-items-center text-xl">🛍️</div>
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.name.split(new RegExp(`(${q})`, "gi")).map((part, j) =>
                              part.toLowerCase() === q.toLowerCase()
                                ? <mark key={j} className="rounded bg-shop/20 px-0.5 text-shop-foreground not-italic">{part}</mark>
                                : part
                            )}
                          </p>
                          {p.description && <p className="mt-0.5 truncate text-xs text-shop-muted">{p.description}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-bold text-shop">
                          {formatPrice(Number(p.price), p.currency)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button onClick={closeDropdown}
                  className="w-full border-t border-current/5 px-4 py-2.5 text-left text-xs text-shop-muted transition-colors hover:text-shop-foreground">
                  Voir tous les résultats pour «&nbsp;{q}&nbsp;»
                </button>
              </div>
            )}
          </div>

          {/* Filtres dépliables */}
          {showFilters && (
            <div className="mt-3 rounded-xl border border-current/10 bg-shop-card p-3 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {/* Trier */}
                <div className="relative min-w-[150px] flex-1">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="h-10 w-full appearance-none rounded-lg border border-current/10 bg-background px-3 pr-8 text-sm outline-none transition-all focus:border-shop/40 focus:ring-2 focus:ring-shop/10"
                  >
                    <option value="">Trier : défaut</option>
                    <option value="asc">Prix croissant ↑</option>
                    <option value="desc">Prix décroissant ↓</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-shop-muted" />
                </div>
                {/* Prix max */}
                <div className="relative w-28 shrink-0">
                  <input
                    type="number" min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="Prix max"
                    className="h-10 w-full rounded-lg border border-current/10 bg-background px-3 text-sm outline-none transition-all placeholder:text-shop-muted focus:border-shop/40 focus:ring-2 focus:ring-shop/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {/* Effacer */}
                {(sort || maxPrice) && (
                  <button onClick={() => { setSort(""); setMaxPrice(""); }}
                    className="h-10 rounded-lg border border-current/10 px-3 text-xs text-shop-muted transition-colors hover:text-shop-foreground">
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Catégories */}
          {categories.length > 0 && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <Chip active={!cat} onClick={() => setCat(null)}>Tout</Chip>
              {categories.map((c) => (
                <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
              ))}
            </div>
          )}

          {/* Résultats */}
          {list.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-current/8 bg-shop-card px-6 py-14 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-shop/10 text-shop">
                <PackageSearch className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-shop-heading text-lg font-bold">
                {products.length === 0 ? "Boutique en préparation" : "Aucun résultat"}
              </h3>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-shop-muted">
                {products.length === 0
                  ? "La boutique prépare sa sélection. Revenez bientôt !"
                  : "Essayez un autre mot-clé ou modifiez vos filtres."}
              </p>
              {filtering && (
                <button onClick={clearAll}
                  className="mt-5 inline-flex h-10 items-center rounded-full bg-shop px-5 text-sm font-semibold text-shop-foreground shadow-md transition hover:brightness-95">
                  Effacer tous les filtres
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={(p.variants as Variant[]).length ? undefined : () => add({ productId: p.id, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] })}
                  href={<Link to="/b/$slug/p/$productId" params={{ slug, productId: p.id }} className="absolute inset-0" aria-label={p.name} />}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-xs font-medium transition-all duration-200 active:scale-95",
        active
          ? "bg-shop text-shop-foreground shadow-md ring-2 ring-shop/20 ring-offset-1"
          : "border border-current/10 bg-shop-card text-shop-muted hover:border-current/20 hover:text-shop-foreground shadow-sm"
      )}
    >
      {children}
    </button>
  );
}
