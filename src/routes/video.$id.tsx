import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthGate } from "@/components/ponzo/AppShell";
import { VideosExperience } from "./videos";

export const Route = createFileRoute("/video/$id")({
  head: () => ({
    meta: [
      { title: "Lecture vidéo — PONZO" },
      {
        name: "description",
        content: "Regarde la vidéo en plein écran avec le son, puis continue à défiler les vidéos PONZO.",
      },
      { property: "og:title", content: "Lecture vidéo — PONZO" },
      { property: "og:description", content: "Lecteur plein écran, son activé et défilement vertical continu." },
    ],
  }),
  component: VideoDetailPage,
});

function VideoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  return (
    <AuthGate>
      <VideosExperience
        startId={id}
        soundOn
        onBack={() => {
          if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
          else void navigate({ to: "/" });
        }}
      />
    </AuthGate>
  );
}
