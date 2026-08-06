import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Système multilingue PONZO.
 * Pour ajouter une langue : ajoute une entrée dans LOCALES et son dictionnaire dans dictionaries.
 * Les clés manquantes retombent automatiquement sur le français.
 */
export const LOCALES = [
  { code: "fr", label: "Français", flag: "🇫🇷", rtl: false },
  { code: "en", label: "English", flag: "🇬🇧", rtl: false },
  { code: "es", label: "Español", flag: "🇪🇸", rtl: false },
  { code: "pt", label: "Português", flag: "🇵🇹", rtl: false },
  { code: "sw", label: "Kiswahili", flag: "🇹🇿", rtl: false },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: LocaleCode = "fr";
const STORAGE_KEY = "ponzo:lang";

const fr = {
  "nav.home": "Accueil",
  "nav.discover": "Découvrir",
  "nav.publish": "Publier",
  "nav.shop": "Boutique",
  "nav.profile": "Profil",
  "nav.search": "Rechercher",
  "nav.messages": "Messages",
  "nav.notifications": "Notifications",
  "nav.settings": "Paramètres",
  "nav.myProfile": "Mon profil",
  "common.loading": "Chargement de PONZO…",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.error": "Une erreur est survenue.",
  "msg.title": "Messages",
  "msg.conversation": "Conversation",
  "msg.conversations": "Conversations",
  "msg.searchConversation": "Rechercher une conversation",
  "msg.members": "Membres",
  "msg.write": "Écrire un message",
  "msg.start": "Démarre la conversation 👋",
  "msg.empty": "Aucune conversation pour l'instant. Choisis un membre ci-dessus.",
  "msg.typing": "En train d'écrire…",
  "msg.recording": "Enregistre un message vocal…",
  "msg.online": "En ligne",
  "msg.lastSeen": "Vu {time}",
  "msg.sent": "Envoyé",
  "msg.delivered": "Distribué",
  "msg.read": "Lu",
  "msg.attach": "Joindre un fichier",
  "msg.voice": "Message vocal",
  "msg.stopRecording": "Arrêter l'enregistrement",
  "msg.send": "Envoyer",
  "msg.sendFailed": "Envoi impossible.",
  "msg.fileFailed": "Envoi du fichier impossible.",
  "msg.micFailed": "Micro indisponible.",
  "msg.download": "Télécharger le fichier",
  "msg.attachment": "Pièce jointe",
  "msg.edit": "Modifier",
  "msg.editing": "Modification du message",
  "msg.edited": "modifié",
  "msg.deleteForMe": "Supprimer pour moi",
  "msg.deleteForAll": "Supprimer pour tout le monde",
  "msg.deleted": "Ce message a été supprimé",
  "msg.copy": "Copier",
  "msg.copied": "Copié",
  "msg.reply": "Répondre",
  "msg.forward": "Transférer",
  "msg.forwarded": "Transféré",
  "msg.react": "Réagir",
  "msg.sticker": "Stickers",
  "msg.gif": "GIF",
  "msg.searchInChat": "Rechercher dans la conversation",
  "msg.pin": "Épingler",
  "msg.unpin": "Désépingler",
  "msg.pinned": "Épinglées",
  "msg.archive": "Archiver",
  "msg.unarchive": "Désarchiver",
  "msg.archived": "Archivées",
  "msg.block": "Bloquer",
  "msg.unblock": "Débloquer",
  "msg.blockedNotice": "Tu as bloqué ce membre. Débloque-le pour écrire à nouveau.",
  "msg.report": "Signaler",
  "msg.reported": "Signalement envoyé",
  "msg.selected": "{count} sélectionné(s)",
  "msg.forwardTo": "Transférer à…",
  "msg.share": "Partager",
  "msg.close": "Fermer",
  "msg.noResults": "Aucun message trouvé",
  "msg.actions": "Options du message",
  "msg.actionFailed": "Action impossible.",
  "msg.select": "Sélectionner",
  "settings.title": "Paramètres",
  "settings.appearance": "Apparence et préférences",
  "settings.dark": "Mode sombre",
  "settings.notifInApp": "Notifications dans l'application",
  "settings.notifEmail": "Résumé par e-mail",
  "settings.allowPhoto": "Autoriser le téléchargement de mes photos",
  "settings.allowVideo": "Autoriser le téléchargement de mes vidéos",
  "settings.private": "Compte privé",
  "settings.language": "Langue",
  "settings.languageSection": "Langue de l'application",
  "settings.languageHint": "L'interface est traduite immédiatement, sans redémarrage.",
  "settings.languageSaved": "Langue mise à jour",
  "settings.privacy": "Confidentialité de la messagerie",
  "settings.showOnline": "Afficher mon statut « En ligne »",
  "settings.showLastSeen": "Afficher « Vu il y a… »",
  "settings.saved": "Préférence enregistrée",
  "settings.saveFailed": "Modification impossible pour le moment.",
  "time.now": "à l'instant",
  "time.min": "{n} min",
  "time.hour": "{n} h",
  "time.day": "{n} j",
} as const;

export type TranslationKey = keyof typeof fr;
type Dict = Partial<Record<TranslationKey, string>>;

const en: Dict = {
  "nav.home": "Home",
  "nav.discover": "Discover",
  "nav.publish": "Post",
  "nav.shop": "Shop",
  "nav.profile": "Profile",
  "nav.search": "Search",
  "nav.messages": "Messages",
  "nav.notifications": "Notifications",
  "nav.settings": "Settings",
  "nav.myProfile": "My profile",
  "common.loading": "Loading PONZO…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.error": "Something went wrong.",
  "msg.title": "Messages",
  "msg.conversation": "Conversation",
  "msg.conversations": "Conversations",
  "msg.searchConversation": "Search a conversation",
  "msg.members": "Members",
  "msg.write": "Write a message",
  "msg.start": "Start the conversation 👋",
  "msg.empty": "No conversation yet. Pick a member above.",
  "msg.typing": "Typing…",
  "msg.recording": "Recording a voice message…",
  "msg.online": "Online",
  "msg.lastSeen": "Last seen {time}",
  "msg.sent": "Sent",
  "msg.delivered": "Delivered",
  "msg.read": "Read",
  "msg.attach": "Attach a file",
  "msg.voice": "Voice message",
  "msg.stopRecording": "Stop recording",
  "msg.send": "Send",
  "msg.sendFailed": "Could not send.",
  "msg.fileFailed": "Could not send the file.",
  "msg.micFailed": "Microphone unavailable.",
  "msg.download": "Download file",
  "msg.attachment": "Attachment",
  "msg.edit": "Edit",
  "msg.editing": "Editing the message",
  "msg.edited": "edited",
  "msg.deleteForMe": "Delete for me",
  "msg.deleteForAll": "Delete for everyone",
  "msg.deleted": "This message was deleted",
  "msg.copy": "Copy",
  "msg.copied": "Copied",
  "msg.reply": "Reply",
  "msg.forward": "Forward",
  "msg.forwarded": "Forwarded",
  "msg.react": "React",
  "msg.sticker": "Stickers",
  "msg.gif": "GIF",
  "msg.searchInChat": "Search in this conversation",
  "msg.pin": "Pin",
  "msg.unpin": "Unpin",
  "msg.pinned": "Pinned",
  "msg.archive": "Archive",
  "msg.unarchive": "Unarchive",
  "msg.archived": "Archived",
  "msg.block": "Block",
  "msg.unblock": "Unblock",
  "msg.blockedNotice": "You blocked this member. Unblock to write again.",
  "msg.report": "Report",
  "msg.reported": "Report sent",
  "msg.selected": "{count} selected",
  "msg.forwardTo": "Forward to…",
  "msg.share": "Share",
  "msg.close": "Close",
  "msg.noResults": "No message found",
  "msg.actions": "Message options",
  "msg.actionFailed": "Action failed.",
  "msg.select": "Select",
  "settings.title": "Settings",
  "settings.appearance": "Appearance and preferences",
  "settings.dark": "Dark mode",
  "settings.notifInApp": "In-app notifications",
  "settings.notifEmail": "Email digest",
  "settings.allowPhoto": "Allow downloads of my photos",
  "settings.allowVideo": "Allow downloads of my videos",
  "settings.private": "Private account",
  "settings.language": "Language",
  "settings.languageSection": "App language",
  "settings.languageHint": "The interface is translated instantly, no restart needed.",
  "settings.languageSaved": "Language updated",
  "settings.privacy": "Messaging privacy",
  "settings.showOnline": "Show my “Online” status",
  "settings.showLastSeen": "Show “Last seen”",
  "settings.saved": "Preference saved",
  "settings.saveFailed": "Could not update right now.",
  "time.now": "just now",
  "time.min": "{n} min",
  "time.hour": "{n} h",
  "time.day": "{n} d",
};

const es: Dict = {
  "nav.home": "Inicio",
  "nav.discover": "Descubrir",
  "nav.publish": "Publicar",
  "nav.shop": "Tienda",
  "nav.profile": "Perfil",
  "nav.search": "Buscar",
  "nav.messages": "Mensajes",
  "nav.notifications": "Notificaciones",
  "nav.settings": "Ajustes",
  "nav.myProfile": "Mi perfil",
  "common.loading": "Cargando PONZO…",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.error": "Ha ocurrido un error.",
  "msg.title": "Mensajes",
  "msg.conversation": "Conversación",
  "msg.conversations": "Conversaciones",
  "msg.searchConversation": "Buscar una conversación",
  "msg.members": "Miembros",
  "msg.write": "Escribe un mensaje",
  "msg.start": "Empieza la conversación 👋",
  "msg.empty": "Aún no hay conversaciones. Elige un miembro arriba.",
  "msg.typing": "Escribiendo…",
  "msg.recording": "Grabando un mensaje de voz…",
  "msg.online": "En línea",
  "msg.lastSeen": "Visto {time}",
  "msg.sent": "Enviado",
  "msg.delivered": "Entregado",
  "msg.read": "Leído",
  "msg.attach": "Adjuntar un archivo",
  "msg.voice": "Mensaje de voz",
  "msg.stopRecording": "Detener la grabación",
  "msg.send": "Enviar",
  "msg.sendFailed": "No se pudo enviar.",
  "msg.fileFailed": "No se pudo enviar el archivo.",
  "msg.micFailed": "Micrófono no disponible.",
  "msg.download": "Descargar el archivo",
  "msg.attachment": "Adjunto",
  "settings.title": "Ajustes",
  "settings.appearance": "Apariencia y preferencias",
  "settings.dark": "Modo oscuro",
  "settings.notifInApp": "Notificaciones en la app",
  "settings.notifEmail": "Resumen por correo",
  "settings.allowPhoto": "Permitir descargar mis fotos",
  "settings.allowVideo": "Permitir descargar mis vídeos",
  "settings.private": "Cuenta privada",
  "settings.language": "Idioma",
  "settings.languageSection": "Idioma de la aplicación",
  "settings.languageHint": "La interfaz se traduce al instante, sin reiniciar.",
  "settings.languageSaved": "Idioma actualizado",
  "settings.privacy": "Privacidad de la mensajería",
  "settings.showOnline": "Mostrar mi estado «En línea»",
  "settings.showLastSeen": "Mostrar «Visto hace…»",
  "settings.saved": "Preferencia guardada",
  "settings.saveFailed": "No se pudo actualizar ahora.",
  "time.now": "ahora mismo",
  "time.min": "{n} min",
  "time.hour": "{n} h",
  "time.day": "{n} d",
};

const pt: Dict = {
  "nav.home": "Início",
  "nav.discover": "Descobrir",
  "nav.publish": "Publicar",
  "nav.shop": "Loja",
  "nav.profile": "Perfil",
  "nav.search": "Pesquisar",
  "nav.messages": "Mensagens",
  "nav.notifications": "Notificações",
  "nav.settings": "Definições",
  "nav.myProfile": "O meu perfil",
  "common.loading": "A carregar o PONZO…",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.error": "Ocorreu um erro.",
  "msg.title": "Mensagens",
  "msg.conversation": "Conversa",
  "msg.conversations": "Conversas",
  "msg.searchConversation": "Pesquisar uma conversa",
  "msg.members": "Membros",
  "msg.write": "Escrever uma mensagem",
  "msg.start": "Começa a conversa 👋",
  "msg.empty": "Ainda não há conversas. Escolhe um membro acima.",
  "msg.typing": "A escrever…",
  "msg.recording": "A gravar uma mensagem de voz…",
  "msg.online": "Online",
  "msg.lastSeen": "Visto {time}",
  "msg.sent": "Enviada",
  "msg.delivered": "Entregue",
  "msg.read": "Lida",
  "msg.attach": "Anexar um ficheiro",
  "msg.voice": "Mensagem de voz",
  "msg.stopRecording": "Parar a gravação",
  "msg.send": "Enviar",
  "msg.sendFailed": "Não foi possível enviar.",
  "msg.fileFailed": "Não foi possível enviar o ficheiro.",
  "msg.micFailed": "Microfone indisponível.",
  "msg.download": "Transferir o ficheiro",
  "msg.attachment": "Anexo",
  "settings.title": "Definições",
  "settings.appearance": "Aparência e preferências",
  "settings.dark": "Modo escuro",
  "settings.notifInApp": "Notificações na aplicação",
  "settings.notifEmail": "Resumo por e-mail",
  "settings.allowPhoto": "Permitir transferir as minhas fotos",
  "settings.allowVideo": "Permitir transferir os meus vídeos",
  "settings.private": "Conta privada",
  "settings.language": "Idioma",
  "settings.languageSection": "Idioma da aplicação",
  "settings.languageHint": "A interface é traduzida de imediato, sem reiniciar.",
  "settings.languageSaved": "Idioma atualizado",
  "settings.privacy": "Privacidade das mensagens",
  "settings.showOnline": "Mostrar o meu estado «Online»",
  "settings.showLastSeen": "Mostrar «Visto há…»",
  "settings.saved": "Preferência guardada",
  "settings.saveFailed": "Não foi possível atualizar agora.",
  "time.now": "agora mesmo",
  "time.min": "{n} min",
  "time.hour": "{n} h",
  "time.day": "{n} d",
};

const sw: Dict = {
  "nav.home": "Mwanzo",
  "nav.discover": "Gundua",
  "nav.publish": "Chapisha",
  "nav.shop": "Duka",
  "nav.profile": "Wasifu",
  "nav.search": "Tafuta",
  "nav.messages": "Ujumbe",
  "nav.notifications": "Arifa",
  "nav.settings": "Mipangilio",
  "nav.myProfile": "Wasifu wangu",
  "common.loading": "Inapakia PONZO…",
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.error": "Hitilafu imetokea.",
  "msg.title": "Ujumbe",
  "msg.conversation": "Mazungumzo",
  "msg.conversations": "Mazungumzo",
  "msg.searchConversation": "Tafuta mazungumzo",
  "msg.members": "Wanachama",
  "msg.write": "Andika ujumbe",
  "msg.start": "Anza mazungumzo 👋",
  "msg.empty": "Hakuna mazungumzo bado. Chagua mwanachama hapo juu.",
  "msg.typing": "Anaandika…",
  "msg.recording": "Anarekodi ujumbe wa sauti…",
  "msg.online": "Yupo mtandaoni",
  "msg.lastSeen": "Alionekana {time}",
  "msg.sent": "Umetumwa",
  "msg.delivered": "Umefika",
  "msg.read": "Umesomwa",
  "msg.attach": "Ambatisha faili",
  "msg.voice": "Ujumbe wa sauti",
  "msg.stopRecording": "Simamisha kurekodi",
  "msg.send": "Tuma",
  "msg.sendFailed": "Imeshindikana kutuma.",
  "msg.fileFailed": "Imeshindikana kutuma faili.",
  "msg.micFailed": "Maikrofoni haipatikani.",
  "msg.download": "Pakua faili",
  "msg.attachment": "Kiambatisho",
  "settings.title": "Mipangilio",
  "settings.appearance": "Muonekano na mapendeleo",
  "settings.dark": "Hali ya giza",
  "settings.notifInApp": "Arifa ndani ya programu",
  "settings.notifEmail": "Muhtasari kwa barua pepe",
  "settings.allowPhoto": "Ruhusu kupakua picha zangu",
  "settings.allowVideo": "Ruhusu kupakua video zangu",
  "settings.private": "Akaunti binafsi",
  "settings.language": "Lugha",
  "settings.languageSection": "Lugha ya programu",
  "settings.languageHint": "Kiolesura hutafsiriwa mara moja, bila kuanzisha upya.",
  "settings.languageSaved": "Lugha imesasishwa",
  "settings.privacy": "Faragha ya ujumbe",
  "settings.showOnline": "Onyesha hali yangu ya «Mtandaoni»",
  "settings.showLastSeen": "Onyesha «Alionekana…»",
  "settings.saved": "Mapendeleo yamehifadhiwa",
  "settings.saveFailed": "Imeshindikana kusasisha sasa.",
  "time.now": "sasa hivi",
  "time.min": "dakika {n}",
  "time.hour": "saa {n}",
  "time.day": "siku {n}",
};

const ar: Dict = {
  "nav.home": "الرئيسية",
  "nav.discover": "استكشاف",
  "nav.publish": "نشر",
  "nav.shop": "المتجر",
  "nav.profile": "الملف الشخصي",
  "nav.search": "بحث",
  "nav.messages": "الرسائل",
  "nav.notifications": "الإشعارات",
  "nav.settings": "الإعدادات",
  "nav.myProfile": "ملفي الشخصي",
  "common.loading": "جارٍ تحميل PONZO…",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.error": "حدث خطأ ما.",
  "msg.title": "الرسائل",
  "msg.conversation": "محادثة",
  "msg.conversations": "المحادثات",
  "msg.searchConversation": "ابحث عن محادثة",
  "msg.members": "الأعضاء",
  "msg.write": "اكتب رسالة",
  "msg.start": "ابدأ المحادثة 👋",
  "msg.empty": "لا توجد محادثات بعد. اختر عضوًا من الأعلى.",
  "msg.typing": "يكتب الآن…",
  "msg.recording": "يسجّل رسالة صوتية…",
  "msg.online": "متصل",
  "msg.lastSeen": "آخر ظهور {time}",
  "msg.sent": "أُرسلت",
  "msg.delivered": "وصلت",
  "msg.read": "تمت القراءة",
  "msg.attach": "إرفاق ملف",
  "msg.voice": "رسالة صوتية",
  "msg.stopRecording": "إيقاف التسجيل",
  "msg.send": "إرسال",
  "msg.sendFailed": "تعذّر الإرسال.",
  "msg.fileFailed": "تعذّر إرسال الملف.",
  "msg.micFailed": "الميكروفون غير متاح.",
  "msg.download": "تنزيل الملف",
  "msg.attachment": "مرفق",
  "settings.title": "الإعدادات",
  "settings.appearance": "المظهر والتفضيلات",
  "settings.dark": "الوضع الداكن",
  "settings.notifInApp": "إشعارات داخل التطبيق",
  "settings.notifEmail": "ملخص عبر البريد",
  "settings.allowPhoto": "السماح بتنزيل صوري",
  "settings.allowVideo": "السماح بتنزيل مقاطعي",
  "settings.private": "حساب خاص",
  "settings.language": "اللغة",
  "settings.languageSection": "لغة التطبيق",
  "settings.languageHint": "تتم ترجمة الواجهة فورًا بدون إعادة التشغيل.",
  "settings.languageSaved": "تم تحديث اللغة",
  "settings.privacy": "خصوصية الرسائل",
  "settings.showOnline": "إظهار حالتي «متصل»",
  "settings.showLastSeen": "إظهار «آخر ظهور»",
  "settings.saved": "تم حفظ التفضيل",
  "settings.saveFailed": "تعذّر التحديث الآن.",
  "time.now": "الآن",
  "time.min": "{n} د",
  "time.hour": "{n} س",
  "time.day": "{n} ي",
};

const dictionaries: Record<LocaleCode, Dict> = { fr, en, es, pt, sw, ar };

export function isLocale(value: string | null | undefined): value is LocaleCode {
  return !!value && LOCALES.some((l) => l.code === value);
}

export function translate(locale: LocaleCode, key: TranslationKey, vars?: Record<string, string | number>) {
  const raw = dictionaries[locale]?.[key] ?? fr[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), raw);
}

type I18nValue = {
  locale: LocaleCode;
  rtl: boolean;
  setLocale: (next: LocaleCode) => Promise<void>;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  formatTimeAgo: (iso: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) setLocaleState(stored);
    else {
      const nav = window.navigator.language?.slice(0, 2);
      if (isLocale(nav)) setLocaleState(nav);
    }
  }, []);

  useEffect(() => {
    const remote = (profile as { language?: string } | null)?.language;
    if (isLocale(remote)) {
      setLocaleState(remote);
      window.localStorage.setItem(STORAGE_KEY, remote);
    }
  }, [profile]);

  const rtl = LOCALES.find((l) => l.code === locale)?.rtl ?? false;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [locale, rtl]);

  const setLocale = useCallback(
    async (next: LocaleCode) => {
      setLocaleState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      if (user) await supabase.from("profiles").update({ language: next }).eq("id", user.id);
    },
    [user],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      rtl,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatTimeAgo: (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.round(diff / 60000);
        if (m < 1) return translate(locale, "time.now");
        if (m < 60) return translate(locale, "time.min", { n: m });
        const h = Math.round(m / 60);
        if (h < 24) return translate(locale, "time.hour", { n: h });
        const d = Math.round(h / 24);
        if (d < 7) return translate(locale, "time.day", { n: d });
        return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
      },
    }),
    [locale, rtl, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé dans I18nProvider");
  return ctx;
}
