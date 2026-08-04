import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { FollowButton } from "@/components/ponzo/FollowButton";
import { PostCard } from "@/components/ponzo/PostCard";
import { useAuth } from "@/lib/auth";
import { asPerson, fetchFollowCounts, fetchFollowing, fetchPostsByAuthor, fetchProfile } from "@/lib/ponzo-api";

export const Route = createFileRoute("/membre/$id")({
  head: () => ({
    meta: [
      { title: "Profil membre — PONZO" },
      { name: "description", content: "Découvre le profil, les services et les publications de ce membre PONZO." },
      { property: "og:title", content: "Profil membre — PONZO" },
      { property: "og:description", content: "Réseau professionnel PONZO : profils, services et projets." },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const { id } = Route.useParams();
  const profile = useQuery({ queryKey: ["profile", id], queryFn: () => fetchProfile(id) });
  const posts = useQuery({ queryKey: ["posts", id], queryFn: () => fetchPostsByAuthor(id) });
  const counts = useQuery({ queryKey: ["follow-counts", id], queryFn: () => fetchFollowCounts(id) });
  const { user } = useAuth();
  const following = useQuery({
    queryKey: ["following", user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user,
  });

  return (
    <AppShell title={profile.data?.full_name ?? "Profil"}>
      <div className="px-3 pt-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface p-4 shadow-soft">
          <Avatar person={asPerson(profile.data)} size={64} zoomable />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{profile.data?.full_name ?? "Membre PONZO"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile.data?.role ?? "Membre"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {counts.data?.followers ?? 0} abonnés · {counts.data?.following ?? 0} abonnements
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <FollowButton targetId={id} initialFollowing={(following.data ?? []).includes(id)} />
        </div>
        {profile.data?.bio && <p className="mt-3 rounded-2xl bg-surface p-4 text-sm shadow-soft">{profile.data.bio}</p>}
        <Link to="/messages" className="mt-3 block rounded-full bg-brand py-3 text-center text-sm font-bold text-primary-foreground">
          Envoyer un message
        </Link>
      </div>
      <div className="mt-4 sm:px-3">
        {posts.data?.map((p) => <PostCard key={p.id} post={p} />)}
        {posts.data?.length === 0 && (
          <p className="px-4 text-sm text-muted-foreground">Ce membre n'a pas encore publié.</p>
        )}
      </div>
    </AppShell>
  );
}
