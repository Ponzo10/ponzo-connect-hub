export type Person = {
  id: string;
  name: string;
  handle: string;
  role: string;
  verified?: boolean;
  tone: "green" | "gold" | "teal" | "sand";
};

export const me: Person = {
  id: "me",
  name: "Amina Diallo",
  handle: "@amina",
  role: "Designer produit • Dakar",
  verified: true,
  tone: "green",
};

export const people: Person[] = [
  { id: "p1", name: "Sarah K.", handle: "@sarahk", role: "Architecte", tone: "gold" },
  { id: "p2", name: "Steve M.", handle: "@stevem", role: "Développeur", tone: "teal" },
  { id: "p3", name: "Grâce B.", handle: "@graceb", role: "Photographe", verified: true, tone: "sand" },
  { id: "p4", name: "Michael D.", handle: "@michaeld", role: "Entrepreneur", tone: "green" },
  { id: "p5", name: "Fatou N.", handle: "@fatoun", role: "Juriste", tone: "gold" },
];

export type Post = {
  id: string;
  author: Person;
  time: string;
  text: string;
  tag?: "Je cherche" | "Je propose" | "Mon projet";
  media?: "image" | "video";
  reactions: number;
  comments: number;
  shares: number;
};

export const posts: Post[] = [
  {
    id: "post-1",
    author: { ...me, name: "PONZO", handle: "@ponzo", role: "Officiel", verified: true, tone: "green" },
    time: "1 h",
    text: "PONZO est plus qu'une application, c'est une communauté. Connecte-toi. Crée. Construis. 🚀",
    media: "image",
    reactions: 1243,
    comments: 128,
    shares: 89,
  },
  {
    id: "post-2",
    author: people[1]!,
    time: "3 h",
    text: "Je cherche un développeur mobile pour une mission de 3 semaines sur une app de livraison. Budget défini, démarrage lundi.",
    tag: "Je cherche",
    reactions: 312,
    comments: 47,
    shares: 12,
  },
  {
    id: "post-3",
    author: people[2]!,
    time: "5 h",
    text: "Nouvelle série photo tournée à Abidjan. Studio disponible pour vos portraits pro et shootings produits.",
    tag: "Je propose",
    media: "video",
    reactions: 894,
    comments: 63,
    shares: 41,
  },
  {
    id: "post-4",
    author: people[3]!,
    time: "8 h",
    text: "Mon projet : une plateforme de micro-financement pour les commerçantes de quartier. On recherche 2 cofondateurs.",
    tag: "Mon projet",
    reactions: 528,
    comments: 96,
    shares: 33,
  },
];

export const stories = people.map((p, i) => ({ ...p, time: `${(i + 1) * 2} h` }));

export type Reel = {
  id: string;
  author: Person;
  caption: string;
  music: string;
  likes: string;
  comments: string;
  shares: string;
};

export const reels: Reel[] = [
  {
    id: "r1",
    author: people[2]!,
    caption: "Coulisses d'un shooting produit à Abidjan 📸 #création #ponzo",
    music: "Afrobeat Studio — Kofi",
    likes: "12,4 K",
    comments: "834",
    shares: "210",
  },
  {
    id: "r2",
    author: people[3]!,
    caption: "3 conseils pour lancer ton business avec 100 000 F 💡",
    music: "Son original — Michael D.",
    likes: "8,9 K",
    comments: "512",
    shares: "402",
  },
  {
    id: "r3",
    author: people[0]!,
    caption: "Visite du chantier : une maison bioclimatique à Thiès 🏗️",
    music: "Ambiance — Sarah K.",
    likes: "5,1 K",
    comments: "298",
    shares: "76",
  },
];

export type Product = {
  id: string;
  title: string;
  price: string;
  seller: string;
  category: string;
  rating: number;
  tone: Person["tone"];
};

export const products: Product[] = [
  { id: "m1", title: "Casque audio pro", price: "45 000 F", seller: "Sono Dakar", category: "Électronique", rating: 4.8, tone: "green" },
  { id: "m2", title: "Sac en cuir artisanal", price: "28 500 F", seller: "Atelier Fatou", category: "Mode", rating: 4.9, tone: "gold" },
  { id: "m3", title: "Bureau bois massif", price: "120 000 F", seller: "Bois & Co", category: "Maison", rating: 4.6, tone: "sand" },
  { id: "m4", title: "Pack photo entreprise", price: "75 000 F", seller: "Grâce Studio", category: "Services", rating: 5, tone: "teal" },
  { id: "m5", title: "Vélo urbain révisé", price: "90 000 F", seller: "CycleUp", category: "Sport", rating: 4.4, tone: "green" },
  { id: "m6", title: "Formation React", price: "35 000 F", seller: "Steve M.", category: "Formation", rating: 4.7, tone: "teal" },
];

export type Chat = {
  id: string;
  person: Person;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
};

export const chats: Chat[] = [
  { id: "c1", person: people[0]!, preview: "Je t'envoie les plans ce soir 👌", time: "09:42", unread: 2, online: true },
  { id: "c2", person: people[1]!, preview: "Message vocal • 0:34", time: "08:15", online: true },
  { id: "c3", person: people[2]!, preview: "Photo", time: "Hier", unread: 1 },
  { id: "c4", person: people[3]!, preview: "Merci pour la mise en relation !", time: "Hier" },
  { id: "c5", person: people[4]!, preview: "Le contrat est prêt à signer.", time: "Lun" },
];

export type Notif = {
  id: string;
  kind: "follow" | "like" | "comment" | "share" | "mention" | "system";
  person?: Person;
  text: string;
  time: string;
  unread?: boolean;
};

export const notifications: Notif[] = [
  { id: "n1", kind: "follow", person: people[0]!, text: "a commencé à vous suivre", time: "2 min", unread: true },
  { id: "n2", kind: "like", person: people[1]!, text: "et 42 autres ont réagi à votre publication", time: "18 min", unread: true },
  { id: "n3", kind: "comment", person: people[2]!, text: "a commenté : « Superbe travail 🔥 »", time: "1 h", unread: true },
  { id: "n4", kind: "mention", person: people[3]!, text: "vous a mentionnée dans un projet", time: "3 h" },
  { id: "n5", kind: "share", person: people[4]!, text: "a partagé votre annonce Marketplace", time: "5 h" },
  { id: "n6", kind: "system", text: "Votre compte est maintenant vérifié ✅", time: "Hier" },
];

export const hashtags = ["#ponzo", "#jecherche", "#jepropose", "#monprojet", "#opportunite", "#collaboration", "#marketplace", "#dakar"];
