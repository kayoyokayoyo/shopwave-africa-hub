import { useState } from "react";
import { Minus, Plus, MessageCircle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { useCart, cartTotals } from "./cart";

type ShopInfo = { id: string; name: string; whatsapp: string; slug: string };

export function CartSheet({ shop, origin, className }: { shop: ShopInfo; origin: string; className?: string }) {
  const { items, setQty, clear, open, setOpen } = useCart();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const totals = cartTotals(items);
  const totalStr = Object.entries(totals).map(([c, v]) => formatPrice(v, c)).join(" + ");

  async function order() {
    const customer = name.trim().slice(0, 80);
    const addr = address.trim().slice(0, 200);
    const msgNotes = notes.trim().slice(0, 500);

    if (!customer) return toast.error("Veuillez indiquer votre nom");
    if (!addr) return toast.error("Veuillez indiquer votre adresse de livraison");
    
    setBusy(true);
    const currencies = Object.keys(totals);
    
    // Save the order (best-effort: WhatsApp must open even if saving fails)
    await supabase.from("orders").insert({
      shop_id: shop.id, 
      customer_name: `${customer} - ${addr}`,
      items: items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price, currency: i.currency, variant: i.variant ?? null })),
      total: currencies.length === 1 ? totals[currencies[0]] : 0,
      currency: currencies.length === 1 ? currencies[0] : "MIXTE",
    });

    const lines = items.map((i) => {
      return `📦 *${i.qty}x ${i.name}*${i.variant ? ` (${i.variant})` : ""}\n💰 ${formatPrice(i.price * i.qty, i.currency)}`;
    });
    
    let msg = `Bonjour *${shop.name}* 👋\n\nVoici ma commande :\n\n${lines.join("\n\n")}\n\n====================\n*TOTAL : ${totalStr}*\n====================\n\n👤 *Livraison*\n• Nom : ${customer}\n• Adresse : ${addr}`;
    if (msgNotes) {
      msg += `\n• Note : ${msgNotes}`;
    }
    
    window.open(`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    setBusy(false);
    clear();
    setOpen(false);
  }

  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      {count > 0 && (
        <div className={className ?? "fixed inset-x-0 bottom-0 z-30 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"}>
          <Button variant="shop" size="lg" className="mx-auto flex w-full max-w-md justify-between shadow-lift" onClick={() => setOpen(true)}>
            <span className="flex items-center gap-2"><ShoppingBag />Panier ({count})</span><span>{totalStr}</span>
          </Button>
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl sm:mx-auto sm:max-w-lg">
          <SheetHeader><SheetTitle className="font-display text-xl">Votre panier</SheetTitle></SheetHeader>
          {items.length === 0 ? <p className="py-8 text-center text-muted-foreground">Votre panier est vide.</p> : (
            <div className="mt-4 space-y-4">
              {items.map((i) => (
                <div key={i.key} className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">{i.image && <img src={mediaUrl(i.image)!} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.name}</p>{i.variant && <p className="text-xs text-muted-foreground">{i.variant}</p>}<p className="text-sm font-bold">{formatPrice(i.price * i.qty, i.currency)}</p></div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Moins" onClick={() => setQty(i.key, i.qty - 1)}><Minus /></Button>
                    <span className="w-6 text-center font-semibold">{i.qty}</span>
                    <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Plus" onClick={() => setQty(i.key, i.qty + 1)}><Plus /></Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{totalStr}</span></div>
              <div className="space-y-3 pt-2">
                <Input className="h-11" placeholder="Votre nom complet" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <Input className="h-11" placeholder="Adresse complète de livraison" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
                <Input className="h-11" placeholder="Instructions (facultatif)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button variant="whatsapp" size="lg" className="w-full" onClick={order} disabled={busy}><MessageCircle />Commander sur WhatsApp</Button>
              <p className="text-center text-xs text-muted-foreground">Vous serez redirigé vers WhatsApp avec votre commande pré-remplie.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
