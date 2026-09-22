import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Aide alimentaire MRC Rivière-du-Nord",
  description:
    "Politique de confidentialité, témoins et mesure d’audience du site Aide alimentaire MRC Rivière-du-Nord.",
  alternates: { canonical: "/politique-confidentialite" },
  robots: { index: true, follow: true },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-medium text-[#1D522C] hover:underline">
          ← Retour à l’accueil
        </Link>
        <header className="mt-6 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#1D522C]">
            Aide alimentaire MRC Rivière-du-Nord
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Politique de confidentialité
          </h1>
          <p className="mt-3 text-sm text-slate-500">Dernière mise à jour : 16 septembre 2026</p>
        </header>

        <div className="mt-8 space-y-8 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">1. Objet de la politique</h2>
            <p className="mt-3">Cette politique explique quelles informations peuvent être recueillies lorsque vous utilisez ce site, pourquoi elles sont utilisées et quels choix vous pouvez exercer.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Données recueillies</h2>
            <p className="mt-3">Le site peut recueillir des données statistiques lorsque vous acceptez les témoins de mesure d’audience, notamment :</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>les pages consultées et les interactions générales;</li>
              <li>le type d’appareil et des informations techniques générales;</li>
              <li>la provenance générale de la visite;</li>
              <li>les recherches effectuées dans la barre de recherche du site;</li>
              <li>le type de recherche et le résultat obtenu.</li>
            </ul>
            <p className="mt-3">Le site ne demande pas de créer un compte et ne vise pas à recueillir directement votre nom, votre adresse courriel ou votre numéro de téléphone par l’outil de recherche.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. Google Analytics 4 et Google Tag Manager</h2>
            <p className="mt-3">Avec votre consentement, Google Tag Manager charge les outils de mesure d’audience et Google Analytics 4 aide à comprendre l’utilisation du site. Ces outils peuvent utiliser des témoins et traiter des données techniques conformément aux politiques de Google.</p>
            <p className="mt-3">Lorsqu’une recherche est effectuée, l’événement <code>search</code> peut être transmis avec le paramètre <code>search_term</code>, ainsi qu’avec des informations générales sur le type et le résultat de la recherche. Ces données servent à améliorer le fonctionnement et le contenu du site.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Témoins et consentement</h2>
            <p className="mt-3">Le site utilise le témoin <code>comptoir_cookie_consent</code> pour mémoriser votre choix concernant les statistiques. Les outils statistiques ne sont activés que lorsque vous acceptez les témoins.</p>
            <p className="mt-3">Vous pouvez aussi supprimer les témoins dans les paramètres de votre navigateur. La suppression du témoin peut faire apparaître de nouveau la demande de consentement.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Utilisation et conservation</h2>
            <p className="mt-3">Les données statistiques sont utilisées pour mesurer la fréquentation, améliorer l’expérience, comprendre les besoins de recherche et optimiser la visibilité du site. Elles sont conservées selon les paramètres configurés dans Google Analytics et les politiques applicables des fournisseurs concernés.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. Vos choix et vos droits</h2>
            <p className="mt-3">Vous pouvez refuser les témoins statistiques, les supprimer de votre navigateur ou limiter leur utilisation au moyen des paramètres de votre navigateur. Pour toute question concernant la protection des renseignements personnels, veuillez contacter l’organisation responsable du site.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Modifications</h2>
            <p className="mt-3">Cette politique peut être mise à jour lorsque les outils, les pratiques de mesure ou les exigences applicables changent. La date de mise à jour affichée en haut de la page sera alors modifiée.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
