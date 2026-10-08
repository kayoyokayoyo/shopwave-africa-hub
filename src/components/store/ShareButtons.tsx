import { Facebook, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const btn = "flex h-10 items-center gap-1.5 rounded-full border border-current/15 px-3 text-xs font-semibold";
  return (
    <div className="flex flex-wrap gap-2">
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer"><Facebook className="h-4 w-4" />Facebook</a>
      <button className={btn} onClick={() => { navigator.clipboard.writeText(url); toast.success("Lien copié"); }}><Link2 className="h-4 w-4" />Copier le lien</button>
    </div>
  );
}
