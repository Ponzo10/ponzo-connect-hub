import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Newspaper, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  NEWS_CATEGORIES,
  createNewsArticle,
  deleteNewsArticle,
  fetchNews,
  newsDateTime,
} from "@/lib/news-api";

const CATEGORIES = NEWS_CATEGORIES.filter((c) => c !== "Tout");

/** Publication et gestion des actualités depuis l'espace administrateur. */
export function NewsComposer() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [source, setSource] = useState("PONZO");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState<string>("Monde");
  const [important, setImportant] = useState(false);

  const list = useQuery({ queryKey: ["admin-news"], queryFn: () => fetchNews({ limit: 30 }) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-news"] });
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  };

  const publish = useMutation({
    mutationFn: () =>
      createNewsArticle({
        title,
        summary,
        content,
        image_url: imageUrl,
        source,
        source_url: sourceUrl,
        category,
        is_important: important,
      }),
    onSuccess: () => {
      setTitle("");
      setSummary("");
      setContent("");
      setImageUrl("");
      setSourceUrl("");
      setImportant(false);
      invalidate();
      toast.success("Actualité publiée");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Publication de l'actualité impossible."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNewsArticle(id),
    onSuccess: () => {
      invalidate();
      toast.success("Actualité supprimée");
    },
    onError: () => toast.error("Suppression impossible."),
  });

  const field = "w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none";

  return (
    <div className="space-y-2">
      <div className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Newspaper className="h-4 w-4 text-primary" /> Publier une actualité
        </p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className={field} />
        <textarea
          value={summary}
          rows={2}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Résumé court"
          className={`${field} resize-none`}
        />
        <textarea
          value={content}
          rows={5}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu complet de l'article"
          className={`${field} resize-none`}
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Lien de l'image (facultatif)"
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" className={field} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Lien de la source (facultatif)"
          className={field}
        />
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          Actualité importante (affichée dans le fil et notifiée à tous)
        </label>
        <button
          onClick={() => publish.mutate()}
          disabled={!title.trim() || publish.isPending}
          className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          {publish.isPending ? "Publication…" : "Publier l'actualité"}
        </button>
      </div>

      <ul className="space-y-1">
        {(list.data ?? []).map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {a.category} · {a.source} · {newsDateTime(a.published_at).date} à {newsDateTime(a.published_at).time}
              </p>
            </div>
            <button
              onClick={() => remove.mutate(a.id)}
              aria-label="Supprimer l'actualité"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {list.isSuccess && (list.data ?? []).length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">Aucune actualité publiée.</li>
        )}
      </ul>
    </div>
  );
}
