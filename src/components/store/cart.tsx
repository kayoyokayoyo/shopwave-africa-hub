import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = { key: string; productId: string; name: string; price: number; currency: string; qty: number; variant?: string; image?: string };

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
};
const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const storageKey = `mn-cart-${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { /* ignore */ }
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify(items)); }, [items, loaded, storageKey]);

  const add: Ctx["add"] = (i, qty = 1) => {
    const key = `${i.productId}|${i.variant ?? ""}`;
    setItems((cur) => {
      const ex = cur.find((c) => c.key === key);
      if (ex) return cur.map((c) => (c.key === key ? { ...c, qty: Math.min(99, c.qty + qty) } : c));
      return [...cur, { ...i, key, qty }];
    });
  };
  const setQty = (key: string, qty: number) => setItems((cur) => (qty <= 0 ? cur.filter((c) => c.key !== key) : cur.map((c) => (c.key === key ? { ...c, qty: Math.min(99, qty) } : c))));
  return <CartCtx.Provider value={{ items, add, setQty, clear: () => setItems([]), open, setOpen }}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}

export function cartTotals(items: CartItem[]) {
  const t: Record<string, number> = {};
  for (const i of items) t[i.currency] = (t[i.currency] ?? 0) + i.price * i.qty;
  return t;
}
