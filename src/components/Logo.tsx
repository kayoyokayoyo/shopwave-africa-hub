import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-warm text-primary-foreground">M</span>
      Market<span className="text-primary">Net</span>
    </Link>
  );
}
