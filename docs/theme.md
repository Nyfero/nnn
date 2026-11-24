# Thème et charte visuelle

Charte « Aurora latérale » : fond noir `#000` animé de particules blanches (`DustParticles`), surfaces en verre, barre latérale de navigation, et **une seule couleur modifiable : l'accent**, choisie par chaque utilisateur.

Tout vit dans `packages/ui` (`@myprout/ui`). Le core et chaque module importent le même thème : aucun frontend ne définit ses propres couleurs.

## Règle d'or : jamais de couleur en dur

- Accent : uniquement `var(--mp-accent)` (fonds, bordures), `var(--mp-on-accent)` (texte posé sur un fond accent) et `var(--mp-accent-text)` (accent utilisé comme couleur de **texte ou d'icône sur fond noir**).
- Le reste : les jetons ci-dessous (`--mp-muted`, `--mp-danger`, `--mp-glass-bg`…). Pas de `#c25fff`, de dégradé, de halo ni de `text-shadow`.
- Exception : les modèles d'e-mail du core (`core/backend/src/services/email/template/`) gardent leurs couleurs en dur, car un client mail ne lit pas les variables CSS. L'accent de l'utilisateur ne s'applique pas aux e-mails.

## Jetons (`packages/ui/src/styles/theme.css`)

| Jeton | Valeur | Usage |
|---|---|---|
| `--mp-accent` | `#5a43c9` (défaut) | fond des boutons principaux, entrée active, pastilles |
| `--mp-on-accent` | calculé | texte sur fond accent (blanc ou quasi noir) |
| `--mp-accent-text` | calculé | accent lisible sur noir (liens, icônes de module, favoris) |
| `--mp-bg` / `--mp-text` | `#000` / `#f5f5f7` | fond, texte principal |
| `--mp-muted` / `--mp-faint` | `#a1a1aa` / `#8a8a93` | libellés / notes, placeholders (≥ 4.5:1 sur noir) |
| `--mp-danger` / `--mp-success` / `--mp-warning` | `#f87171` / `#4ade80` / `#fbbf24` | états |
| `--mp-glass-bg`, `--mp-glass-border(-strong)` | blanc 4.5 % / 10 % / 14 % | surfaces en verre |
| `--mp-field-bg`, `--mp-field-border` | blanc 5 % / 12 % | champs, boutons secondaires |
| `--mp-divider`, `--mp-scrim` | | séparateurs, fond des modales |
| `--mp-radius-panel/card/row/control/small` | 28 / 24 / 20 / 14 / 12 px | rayons |
| `--mp-font-body` / `--mp-font-head` | Inter / Space Grotesk | polices (Google Fonts, chargées dans chaque `index.html`) |

## Classes partagées

`.themed-card` (verre), `.themed-h1/h2`, `.themed-label`, `.themed-input`, `.themed-textarea`, `.themed-select`, `.themed-button` + `.button-primary|secondary|danger`, `.icon-button` (et `.toggle-password`, `.copy-btn`, `.modal-close` : boutons-icônes 40×40, **`aria-label` obligatoire**), `.themed-separator`, `.pill`, `.form-group`, `.form-wrapper` + `.input-actions`, `.form-value` (valeur en lecture), `.form-error`, `.char-counter`, `.sr-only`.

Composants : `AppShell` (fond + `Sidebar` + `<main>`), `Sidebar`, `BaseModal`, `Toast` (`show(message, durée, 'success'|'error'|'info')`), `DustParticles`.

- `BaseModal` et `Toast` sont téléportés dans `<body>` : un parent avec `backdrop-filter` (toute carte en verre) devient sinon la référence d'un `position: fixed`. Même chose pour tout panneau flottant d'un module (voir `UploadPanel` du module files).
- Focus clavier visible partout (`:focus-visible`), cibles tactiles ≥ 44 px.
- Sous 900 px, la barre latérale devient une barre horizontale en haut (icônes seules + libellé de l'entrée active).

## Couleur d'accent (`useAccent`)

`packages/ui/src/composables/useAccent.js`, exporté par `@myprout/ui` :

| Fonction | Rôle |
|---|---|
| `ACCENT_PRESETS` | 8 couleurs proposées (Violet par défaut, Turquoise, Bleu ciel, Citron vert, Ambre, Corail, Rose, Rouge) |
| `isValidAccent(hex)` | `/^#[0-9a-fA-F]{6}$/` |
| `onAccent(hex)` | `#04110f` ou `#ffffff`, le plus contrasté ; noir pur si aucun n'atteint 4.5:1 (gris moyens) |
| `accentText(hex)` | éclaircit l'accent vers le blanc jusqu'à 4.5:1 sur noir |
| `applyAccent(hex)` | pose les 3 variables sur `<html>` et écrit `localStorage['mp-accent']` ; `null`/invalide = défaut |
| `loadStoredAccent()` | lit `localStorage['mp-accent']` |

Persistance :

1. **Serveur** : colonne `users.theme_accent` (`VARCHAR(7)`, `null` = défaut), renvoyée dans `user` par login / refresh (`buildAuthResponse`), modifiée par `PUT /api/core/auth/preferences` `{ theme_accent: "#rrggbb" | null }` (authentifié, validé par regex, 400 sinon).
2. **Navigateur** : core et modules partagent l'origine, donc le même `localStorage`.
3. **Sans flash** : le plugin Vite `accentBootPlugin()` (`@myprout/ui/vite`) injecte en tête de `index.html` un script inline, généré à partir des mêmes fonctions, qui applique l'accent mémorisé avant le chargement du bundle.

Le core applique l'accent dans `authStore.setSession` ; la carte « Apparence » du profil l'enregistre au clic (mise à jour optimiste, retour arrière si l'API échoue).

## Brancher un nouveau module

1. `vite.config.js` : `import { accentBootPlugin } from '@myprout/ui/vite'` puis `plugins: [vue(), accentBootPlugin()]`.
2. `index.html` : copier les `<link>` Google Fonts (Inter, Space Grotesk, Material Icons) d'un module existant.
3. `main.js` : `import '@myprout/ui/styles/theme.css'`, puis après `refreshSession()` et **avant** `app.mount` : `applyAccent(data.user.theme_accent ?? null)`.
4. `App.vue` : tout le contenu dans `<AppShell :active="MODULE_ID" :is-admin :modules>` (ne pas remonter `DustParticles`, `AppShell` le fait).
5. Styles : uniquement les classes et jetons ci-dessus.

Tests : `npm test -w packages/ui` (contrastes des presets et des extrêmes, validation, script anti-flash).
