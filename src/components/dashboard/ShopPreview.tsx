import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { ShopDraft } from "./ShopFields";
import type { Product } from "@/hooks/useMyShop";
import { StoreHeader, ProductCard } from "@/components/store/StoreParts";
import { shopStyle } from "@/lib/marketnet";
import { cn } from "@/lib/utils";

const SAMPLE = [
  { name: "Pagne wax premium", price: 25, currency: "USD", images: [], status: "active", featured: true },
  { name: "Sac en cuir artisanal", price: 40, currency: "USD", images: [], status: "active", featured: false },
  { name: "Sandales tressées", price: 15, currency: "USD", images: [], status: "active", featured: false },
  { name: "Bijoux perlés", price: 8, currency: "USD", images: [], status: "out_of_stock", featured: false },
] as const;

export function ShopPreview({ draft, products }: { draft: ShopDraft; products?: Product[] }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const items = products?.filter((p) => p.status !== "hidden").slice(0, 6);
  const list = items && items.length ? items : SAMPLE;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Aperçu en direct</p>
        <div className="flex rounded-xl bg-muted p-1">
          {(["mobile", "desktop"] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold", device === d && "bg-card shadow-sm")}>
              {d === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}{d === "mobile" ? "Mobile" : "Ordinateur"}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("mx-auto overflow-hidden rounded-[2rem] border-8 border-foreground/90 shadow-lift transition-all", device === "mobile" ? "max-w-[340px]" : "max-w-full rounded-xl border-4")}>
        <div className={cn(`theme-${draft.theme}`, "storefront h-[560px] overflow-y-auto")} style={shopStyle(draft.primary_color)}>
          <StoreHeader shop={{ ...draft, name: draft.name || "Ma boutique" }} />
          <div className={cn("mx-auto grid max-w-5xl gap-3 p-4", device === "mobile" ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4")}>
            {list.map((p, i) => <ProductCard key={i} product={p as Product} onAdd={() => {}} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
