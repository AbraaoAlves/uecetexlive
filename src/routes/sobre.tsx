import { Link } from "@tanstack/react-router";
import { strings } from "@/lib/strings";

export function SobreRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl">{strings.sobre.title}</h1>
      <p className="mt-4 text-ink-muted">{strings.sobre.privacy}</p>
      <Link to="/" className="mt-8 inline-block text-accent underline">
        ← {strings.app.name}
      </Link>
    </main>
  );
}
