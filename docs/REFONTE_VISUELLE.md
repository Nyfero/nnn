# Refonte visuelle Myprout : brief pour l'agent codeur

> Objectif : appliquer la nouvelle charte visuelle (direction « F · Aurora latérale ») au **core** et à **tous les modules**, et permettre à chaque utilisateur de **choisir sa couleur d'accent**.
> Aucune logique métier, aucun flux d'authentification, aucun code de chiffrement ne change. C'est un chantier de style, de layout et d'une petite préférence utilisateur.

Maquettes de référence (canvas de design, lecture seule) : https://claude.ai/artifact/AWYcJ8Pwq5NGe24H2npHNh
Cartes utiles : ligne **F** (mots de passe, accueil, fichiers, profil), **A6 / A7** (modals consultation et création), **G5** (carte « Apparence » interactive du profil). Les mesures essentielles sont reprises ci-dessous, la maquette n'est pas indispensable pour coder.

## 0. À lire avant de coder

Ce brief a été écrit à partir d'extraits du dépôt, pas d'un clone complet. Avant de modifier quoi que ce soit, **lis en entier** : `packages/ui/src/styles/theme.css`, `modal.css`, `components/{AppShell,Navbar,BaseModal,Toast,DustParticles}.vue`, `core/frontend/src/{App.vue,main.js,assets/auth.css,views/*,components/**}`, `modules/passwords/frontend/src/**`, `core/backend/prisma/schema.prisma`, `core/backend/src/routes/auth.ts` (en particulier `buildAuthResponse`) et `e2e/`. Si un fait de ce brief contredit le code, **le code a raison** : adapte-toi et signale l'écart dans ta PR.

Constats déjà vérifiés :
- Les tokens vivent dans `packages/ui/src/styles/theme.css` (`--mp-accent: #c25fff`, `--mp-accent-dark`, `--mp-highlight`, `--mp-danger`, `--mp-muted`, `--mp-card-bg`, `--mp-input-bg`) et sont importés par chaque app (`import '@myprout/ui/styles/theme.css'`).
- Classes partagées : `.themed-card`, `.themed-h1/h2`, `.themed-input`, `.themed-textarea`, `.themed-button`, `.button-primary/secondary/danger`, `.themed-label`, `.themed-separator`, `.form-*`, `.toggle-password`, `.copy-btn`.
- `AppShell` = colonne verticale (`Navbar` en haut + `<main>`), commun au core et aux modules ; `DustParticles` (canvas blanc) est rendu **par `AppShell`**. `core/frontend/src/App.vue` rend aussi `<DustParticles />` en plus d'`AppShell` : probable doublon à supprimer (vérifie).
- Core et modules sont servis sur **la même origine** via Caddy (`/`, `/passwords/`). Le `localStorage` est donc partagé. Les modules reçoivent l'utilisateur via `refreshSession()` dans leur `main.js`.
- Des couleurs sont codées en dur : `#c25fff`, `194, 95, 255` (ex. `LobbyView.vue` : `box-shadow`), `#8342cf`, `#f9f0a8`, `#ff4d4d`, `#e74c3c`, `#888`. Les templates d'e-mail du core codent aussi `#c25fff` : **ne pas y toucher** (le README du dossier demande de les copier sans modification, et un client mail ne lit pas les variables CSS).

## 1. Design cible

Fond **noir `#000`** et particules blanches animées : **inchangés** (garder `DustParticles` tel quel).

### 1.1 Tokens (à mettre dans `theme.css`, remplace l'ancien bloc `:root`)

```css
:root {
  /* Accent : seule valeur modifiable par l'utilisateur */
  --mp-accent: #5a43c9;          /* défaut = violet de la maquette F */
  --mp-on-accent: #ffffff;       /* texte sur fond accent, calculé en JS (voir §2) */
  --mp-accent-text: #a89cf0;     /* accent utilisé comme COULEUR DE TEXTE sur fond noir, calculé en JS */

  --mp-bg: #000;
  --mp-text: #f5f5f7;
  --mp-muted: #a1a1aa;           /* texte secondaire, libellés */
  --mp-faint: #8a8a93;           /* notes, placeholders (reste ≥ 4.5:1 sur noir) */
  --mp-danger: #f87171;
  --mp-success: #4ade80;

  --mp-glass-bg: rgba(255, 255, 255, 0.045);
  --mp-glass-border: rgba(255, 255, 255, 0.10);
  --mp-glass-border-strong: rgba(255, 255, 255, 0.14);
  --mp-field-bg: rgba(255, 255, 255, 0.05);
  --mp-field-border: rgba(255, 255, 255, 0.12);
  --mp-divider: rgba(255, 255, 255, 0.08);
  --mp-scrim: rgba(0, 0, 0, 0.62);

  --mp-radius-panel: 28px;   /* sidebar, modals */
  --mp-radius-card: 24px;    /* cartes */
  --mp-radius-row: 20px;     /* lignes de liste */
  --mp-radius-control: 14px; /* boutons, champs */
  --mp-radius-small: 12px;   /* boutons-icônes */

  --mp-font-body: 'Inter', system-ui, sans-serif;
  --mp-font-head: 'Space Grotesk', 'Inter', sans-serif;
}
```

Polices : Inter (400/500/600) et Space Grotesk (500/600/700), chargées depuis Google Fonts dans le `index.html` de chaque app (ou auto-hébergées si le projet préfère ne pas dépendre d'un CDN, au choix de l'agent, à signaler). Remplace `Poppins`.

### 1.2 Composants (règles de style)

| Élément | Règle |
|---|---|
| Carte `.themed-card` | fond `--mp-glass-bg`, bordure `1px solid --mp-glass-border`, rayon 24, `backdrop-filter: blur(16px)`. **Plus de bordure blanche de 2px.** |
| Titres `.themed-h1/h2` | Space Grotesk 600, h1 36px / h2 20px, `letter-spacing: -0.02em`, **plus de `text-shadow`** |
| Libellé `.themed-label` | 13px, 500, `--mp-muted` |
| Champ `.themed-input/.themed-textarea` | hauteur 44 (textarea auto), rayon 14, fond `--mp-field-bg`, bordure `--mp-field-border`, texte blanc. Focus : bordure `--mp-accent` + `outline: 2px solid var(--mp-accent); outline-offset: 2px` |
| `.button-primary` | **fond uni `--mp-accent`**, texte `--mp-on-accent`, rayon 14, hauteur 44, 600, **pas de dégradé, pas d'ombre lumineuse**. Hover : `filter: brightness(1.08)` (l'ancien `1.3` est trop brillant). Disabled : opacité .4 |
| `.button-secondary` | fond `--mp-field-bg`, bordure `--mp-field-border`, texte `#e4e4e7`, hover : bordure plus claire |
| `.button-danger` | texte `--mp-danger`, fond `rgba(248,113,113,.12)`, bordure `rgba(248,113,113,.3)` |
| Boutons-icônes (œil, copier, fermer) | 40×40, rayon 12, fond `rgba(255,255,255,.04)`, bordure `--mp-field-border`, `aria-label` obligatoire |
| Séparateur | `1px solid --mp-divider` |
| Cartes du lobby | rayon 24, hover : bordure `--mp-glass-border-strong` + `translateY(-4px)` ; **remplacer le `box-shadow` violet codé en dur** par `0 12px 32px rgba(0,0,0,.5)` |
| Icônes de module | couleur `--mp-accent-text` |
| Toast | même verre que les cartes, rayon 16, liseré gauche **interdit** (garder une icône de statut) |

Cibles tactiles ≥ 44px, texte ≥ 4.5:1 sur son fond, focus clavier visible partout.

### 1.3 Navigation : barre latérale (remplace la `Navbar` du haut)

`AppShell` passe de « colonne » à « ligne » : **sidebar à gauche + contenu**. Le code de la `Navbar` est remplacé par un composant `Sidebar` (garde l'API : `items`, `active`, évènement `navigate(item, event)`, pour que le core continue d'intercepter la navigation avec son routeur).

Sidebar :
- Panneau flottant : marge 16 autour de l'appli, largeur 252, `align-self: stretch`, fond verre (`--mp-glass-bg`, bordure `--mp-glass-border`, rayon 28, `backdrop-filter: blur(18px)`).
- En haut : le nom « Myprout » (Space Grotesk 600, 21px) précédé d'un petit point `--mp-accent` (10px), **sans halo**.
- Groupe « Modules » : Accueil, puis les modules accessibles. Groupe « Compte » (en bas) : Administration (si admin), Profil. Titres de groupe en 12px, 600, majuscules, `letter-spacing: .08em`, `--mp-faint`.
- Entrée : hauteur 46, rayon 14, icône 19px + libellé 15px/500, couleur `#a1a1aa`. **Active : fond `--mp-accent`, texte `--mp-on-accent`, sans ombre.**
- Bas de la sidebar : la version (`2.0.0`, 13px, `--mp-faint`).
- **Responsive** (< 900px) : la sidebar devient une barre horizontale en haut (icônes seules, libellé de l'entrée active), comme l'ancienne `Navbar`. Pas de menu burger.
- Contenu : `<main>` avec padding `22px 28px 32px`, scroll interne. Le `html, body { overflow: hidden }` actuel reste.
- La sidebar est masquée sur `/login` (comme la `Navbar` aujourd'hui).

### 1.4 Écrans (mêmes contenus qu'aujourd'hui, nouvelle mise en forme)

- **Connexion** : carte verre centrée de 420px, rayon 28, nom « Myprout » + titre « Connexion », champs avec libellés visibles au-dessus (E-mail, Mot de passe + œil), lien « Mot de passe oublié ? » aligné à droite sous le champ, bouton « Se connecter » pleine largeur, lien « Créer un compte » centré, version en bas à droite.
- **Accueil (lobby)** : titre « Bonjour {prénom} », grille de cartes de modules (min 260px), carte : icône dans une pastille 56px + nom + flèche.
- **Profil** : trois cartes (Votre profil, Gestion du compte, Sécurité) + **une quatrième carte pleine largeur « Apparence »** (voir §2.4). Bouton « Supprimer le compte » en style danger.
- **Admin** (pas de maquette) : applique les tokens et composants ci-dessus sans changer la structure. Onglets (Inscriptions, Utilisateurs, accès aux modules, Modules) en pastilles : actif = fond `rgba(255,255,255,.1)` texte blanc, inactif = `--mp-muted`. Listes/tableaux : lignes en verre, séparateurs `--mp-divider`.
- **Module Mots de passe** : titre « Mes mots de passe » + pastille du compteur, recherche (icône loupe à l'intérieur, 280px) et bouton « Ajouter » (icône +) alignés à droite. Liste groupée par lettre (titre de groupe Space Grotesk 13px, `letter-spacing: .12em`, `--mp-muted`), lignes de 68px en verre (rayon 20) : pastille-initiale 42px, titre 16px/600, identifiant + `••••••••` en 13px, note en italique `--mp-faint`, boutons favori / afficher / copier. Index alphabétique à droite (12px, 600).
- **Modals** (`BaseModal`) : verre plus opaque (`rgba(22,22,30,.74)`, `blur(24px)`, bordure `--mp-glass-border-strong`, rayon 28, ombre `0 40px 100px rgba(0,0,0,.7)`), largeur max 480, padding 30, scrim `--mp-scrim`. En-tête : titre (26px) + bouton fermer ; pied : actions alignées à droite (Annuler en secondaire, Enregistrer en primaire). Modal de consultation : champs en lecture (fond `--mp-field-bg`) avec boutons afficher/copier, pied « Modifier ».
- **Autres modules** (Fichiers, Serveurs de jeu, etc., si présents dans le dépôt ou ajoutés plus tard) : aucune maquette. Ils doivent seulement utiliser `AppShell`, `theme.css` et les classes partagées, sans couleur propre.

## 2. Choix de la couleur par l'utilisateur

### 2.1 Principe
Toute la charte repose sur **une seule variable**, `--mp-accent`. Les composants n'ont **aucune** couleur d'accent en dur : uniquement `var(--mp-accent)`, `var(--mp-on-accent)` et `var(--mp-accent-text)`.

### 2.2 Calculs (dans `packages/ui`, nouveau `src/composables/useAccent.js`, exporté par `index.js`)
- `ACCENT_PRESETS` : Violet `#5a43c9` (défaut), Turquoise `#5eead4`, Bleu ciel `#7dd3fc`, Citron vert `#bef264`, Ambre `#fcd34d`, Corail `#fb923c`, Rose `#f9a8d4`, Rouge `#dc2626`. Plus une couleur libre via `<input type="color">`.
- `isValidAccent(hex)` : `/^#[0-9a-fA-F]{6}$/`.
- `onAccent(hex)` : luminance relative WCAG ; si `> 0.3` → `#04110f`, sinon `#ffffff`.
- `accentText(hex)` : si le contraste de `hex` sur noir est `< 4.5`, éclaircir (mélange progressif vers le blanc) jusqu'à atteindre 4.5. Sinon `hex`. Sert aux titres/liens/icônes colorés **sur fond noir**.
- `applyAccent(hex)` : si valide, pose `--mp-accent`, `--mp-on-accent`, `--mp-accent-text` sur `document.documentElement` et écrit `localStorage['mp-accent']`. Sinon, retombe sur le défaut.
- `loadStoredAccent()` : lit `localStorage['mp-accent']`.

### 2.3 Éviter le flash au chargement
Dans le `index.html` de **chaque** frontend (core + chaque module), un petit script inline **avant** le bundle lit `localStorage['mp-accent']` et pose `--mp-accent` immédiatement (valeur validée par la même regex ; `--mp-on-accent` et `--mp-accent-text` suivent dès que `applyAccent` s'exécute, ou sont calculés dans le script inline). Comme core et modules partagent l'origine, le choix est cohérent partout.

### 2.4 Persistance côté serveur (pour retrouver son choix sur tous ses appareils)
- **Prisma (core)** : ajouter `theme_accent String? @db.VarChar(7)` au modèle `users`. Générer et **commiter** la migration (`./scripts/migrate-init.sh`, voir `docs/deploiement.md` : la prod applique `prisma migrate deploy`).
- **API** : renvoyer `theme_accent` dans l'objet utilisateur retourné par `buildAuthResponse` (donc login, refresh, et ce que reçoivent les modules). Ajouter une route authentifiée (`authMiddleware`) du type `PUT /api/core/auth/preferences` (ou la convention existante : vérifie les préfixes et le style des autres routes), corps `{ theme_accent: "#rrggbb" | null }`, **validation stricte par regex côté serveur**, `null` = revenir au défaut. Réponse : `{ theme_accent }`.
- **Core frontend** : `authStore.setSession` appelle `applyAccent(user.theme_accent)` ; l'UI d'Apparence appelle la route, puis `applyAccent` (mise à jour optimiste, retour arrière en cas d'erreur).
- **Modules** : dans chaque `main.js`, après `refreshSession()` et **avant** `app.mount`, appeler `applyAccent(data.user.theme_accent)`.
- **Hors scope** : l'accent n'est pas appliqué aux e-mails.

### 2.5 UI : carte « Apparence » (page Profil du core)
Carte pleine largeur sous les trois autres. Titre « Apparence » + une ligne d'aide : « Couleur d'accentuation de l'interface. Le fond noir et les particules ne changent pas. » Une rangée de pastilles rondes de 48px (une par preset, bordure `rgba(255,255,255,.25)`, **pastille sélectionnée : anneau `0 0 0 3px #000, 0 0 0 5px #fff`**, `aria-pressed`, `aria-label` = nom de la couleur), un séparateur, puis « Personnalisée » avec un `<input type="color">` rond de 48px. En dessous, un aperçu (bouton principal, pastille « entrée active », texte coloré) qui reflète le choix en direct. Appliquer au clic (sauvegarde immédiate, pas de bouton « Enregistrer »).

## 3. Plan de travail conseillé (un commit par étape)

1. `packages/ui` : tokens (`theme.css`), classes partagées restylées, `useAccent.js`, `Sidebar.vue`, `AppShell.vue` (layout ligne + responsive), `BaseModal` / `modal.css`, `Toast`. Polices dans les `index.html`.
2. Recherche et remplacement des couleurs en dur dans **tous** les frontends (`#c25fff`, `194, 95, 255`, `#8342cf`, `#f9f0a8`, `Poppins`, bordures blanches 2px, `text-shadow`), sauf templates d'e-mail. Supprimer le doublon éventuel de `DustParticles` dans `core/frontend/src/App.vue`.
3. Core frontend : login, lobby, profil (+ carte Apparence), admin.
4. Backend core : migration `theme_accent`, `buildAuthResponse`, route de préférences, validation.
5. Branchement de `applyAccent` : script inline anti-flash (core + modules), `authStore`, `main.js` de chaque module.
6. Module Mots de passe : liste, groupes, index alphabétique, modals consultation / création / modification.
7. Tests, doc, nettoyage.

## 4. Critères d'acceptation

- Aucune occurrence restante de `#c25fff`, `#8342cf`, `rgba(194, 95, 255…)`, `Poppins` dans `packages/` et les frontends (les templates d'e-mail sont exclus).
- Changer l'accent dans Profil met à jour **immédiatement** le core ; recharger la page ou ouvrir `/passwords/` garde la couleur, **sans flash** de l'ancienne ; se connecter depuis un autre navigateur la retrouve.
- Un accent invalide envoyé à l'API renvoie 400 ; `null` rétablit le violet par défaut.
- Sur les 8 presets et sur du blanc / noir pur choisis via la couleur libre : le texte des boutons et de l'entrée active reste lisible (≥ 4.5:1), et le texte accentué sur fond noir aussi.
- Boutons principaux : aucun halo, aucun dégradé ; hover discret.
- Navigation par sidebar sur desktop, barre horizontale sous 900px, identique pour le core et le module.
- Navigation clavier complète, focus visible, boutons-icônes avec `aria-label`.
- `npm run test:e2e` passe. Mets à jour les sélecteurs cassés par le restyle, sans affaiblir les assertions. Ajoute un test e2e : changer l'accent, recharger, vérifier la persistance et la lecture dans le module.
- `npm test -w packages/sdk` passe (le chiffrement n'est pas touché).
- Documente la charte dans `docs/` (nouvelle page `docs/theme.md` : tokens, `useAccent`, règle « jamais de couleur en dur », comment un nouveau module doit s'y brancher) et ajoute un lien depuis `docs/architecture.md`.

## 5. Contraintes

- Ne touche pas au chiffrement, à l'auth, aux routes existantes (hors ajout de `theme_accent`), à `docker-compose.yml`, ni aux templates d'e-mail.
- Pas de nouvelle dépendance sans nécessité (pas de bibliothèque de composants ni de sélecteur de couleur : l'`<input type="color">` natif suffit).
- Signale dans la PR : les écarts avec ce brief, les écrans sans maquette (admin, autres modules) et les choix faits (polices auto-hébergées ou CDN, nom exact de la route de préférences).
