# Design tokens : Inbox unifiée

Ce fichier est la source de vérité des couleurs de l'application. Toute couleur utilisée dans l'interface DOIT venir de ces tokens. Aucune valeur hexadécimale en dur dans les composants.

## Règles d'usage

1. **Neutres partout, couleur rare.** Le contenu des mails est le héros. La couleur ne sert qu'à porter un sens.
2. **Accent (bleu encre)** : uniquement pour les actions de l'utilisateur (bouton principal, sélection, liens, focus clavier). Un seul bouton accent par vue.
3. **IA (ambre)** : uniquement pour ce qui est *proposé par l'IA et pas encore validé* (catégorie suggérée, brouillon de réponse, action proposée). Rendu : fond `--ai-soft`, texte `--ai-text`, bordure `1px dashed var(--ai)`. Une fois validée par l'utilisateur, l'étiquette prend la couleur normale de sa catégorie.
4. **Succès (vert sauge)** : fait, rangé, envoyé, validé.
5. **Danger (rouge brique)** : suppression et actions irréversibles UNIQUEMENT. Jamais pour signaler l'urgence.
6. **Catégories** : fond pâle + texte foncé de la même teinte. Jamais de texte noir sur une étiquette colorée. Toutes les catégories ont la même luminosité, aucune ne doit ressortir plus que les autres.
7. **Comptes mail** : chaque compte a une couleur d'identification, affichée UNIQUEMENT sous forme de point de 8 px à côté de l'expéditeur. Jamais en fond de ligne.
8. Le texte ambre sur fond clair est peu lisible : utiliser `--ai-text`, jamais `--ai`, pour du texte.
9. Mode clair et mode sombre obligatoires, via les variables ci-dessous.

## 1. Variables CSS (globals.css)

```css
:root {
  /* Base */
  --bg: #F7F6F2;
  --surface: #FFFFFF;
  --surface-muted: #F0EEE9;   /* survol de ligne, zones secondaires */
  --border: #E6E4DE;
  --border-strong: #D6D3CB;
  --text: #1C1D1F;
  --text-secondary: #6B6D72;
  --text-muted: #8E9095;      /* métadonnées, placeholders */

  /* Accent : actions utilisateur */
  --accent: #2F5BD3;
  --accent-hover: #264BB0;
  --accent-soft: #E3EAF7;
  --on-accent: #FFFFFF;

  /* IA : proposé, non validé */
  --ai: #C98A1B;
  --ai-soft: #FBF1DD;
  --ai-text: #7A5210;

  /* Succès */
  --success: #3E8E63;
  --success-soft: #E2EFE6;
  --success-text: #2A5A3E;

  /* Danger : suppression uniquement */
  --danger: #B8432F;
  --danger-hover: #9C3726;
  --danger-soft: #FBE3DE;
  --danger-text: #86351F;
  --on-danger: #FFFFFF;

  /* Catégories : fond / texte */
  --cat-urgent-bg: #FBE6DF;      --cat-urgent-text: #86351F;
  --cat-a-traiter-bg: #E3EAF7;   --cat-a-traiter-text: #27406F;
  --cat-devis-bg: #EDE6F5;       --cat-devis-text: #4E3A70;
  --cat-factures-bg: #F3EBDD;    --cat-factures-text: #6A4E1E;
  --cat-pro-bg: #E1EEF0;         --cat-pro-text: #22535B;
  --cat-perso-bg: #E2EFE6;       --cat-perso-text: #2A5A3E;
  --cat-newsletter-bg: #ECEBE7;  --cat-newsletter-text: #4D4C48;
  --cat-autre-bg: #F0EEE9;       --cat-autre-text: #5E5F63;

  /* Comptes mail : points d'identification */
  --account-1: #4C7BD9;
  --account-2: #3E9E8F;
  --account-3: #C0714A;
  --account-4: #8A6FC4;
  --account-5: #B5577A;

  /* Focus */
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

.dark {
  --bg: #141517;
  --surface: #1C1E21;
  --surface-muted: #232529;
  --border: #2A2D31;
  --border-strong: #3A3E44;
  --text: #ECECEA;
  --text-secondary: #9A9CA1;
  --text-muted: #74777C;

  --accent: #6F93F0;
  --accent-hover: #86A5F3;
  --accent-soft: #1E2A45;
  --on-accent: #0E1526;

  --ai: #E0A94A;
  --ai-soft: #3A2E17;
  --ai-text: #F0C77A;

  --success: #5DB185;
  --success-soft: #1C3327;
  --success-text: #8FD3AE;

  --danger: #E0715D;
  --danger-hover: #E88A78;
  --danger-soft: #3D1F1A;
  --danger-text: #F2A596;
  --on-danger: #1A0D0A;

  --cat-urgent-bg: #3D221A;      --cat-urgent-text: #F3A993;
  --cat-a-traiter-bg: #1E2A45;   --cat-a-traiter-text: #A9C0F2;
  --cat-devis-bg: #2C2440;       --cat-devis-text: #C7B5EA;
  --cat-factures-bg: #332A1C;    --cat-factures-text: #E2C38E;
  --cat-pro-bg: #1A3236;         --cat-pro-text: #93CDD6;
  --cat-perso-bg: #1C3327;       --cat-perso-text: #9BD2B1;
  --cat-newsletter-bg: #26282B;  --cat-newsletter-text: #B7B8BB;
  --cat-autre-bg: #232529;       --cat-autre-text: #A3A5AA;

  --account-1: #7FA2EC;
  --account-2: #6CC2B4;
  --account-3: #E09771;
  --account-4: #B09AE0;
  --account-5: #D985A3;
}
```

## 2. Tailwind v4 (à ajouter sous les variables, dans le même fichier)

```css
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-text: var(--text);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --color-on-accent: var(--on-accent);
  --color-ai: var(--ai);
  --color-ai-soft: var(--ai-soft);
  --color-ai-text: var(--ai-text);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-text: var(--success-text);
  --color-danger: var(--danger);
  --color-danger-hover: var(--danger-hover);
  --color-danger-soft: var(--danger-soft);
  --color-danger-text: var(--danger-text);
  --color-on-danger: var(--on-danger);
}
```

Exemples : `bg-surface`, `text-text-secondary`, `bg-accent hover:bg-accent-hover text-on-accent`, `bg-ai-soft text-ai-text border border-dashed border-ai`.

(Tailwind v3 : déclarer les mêmes clés dans `theme.extend.colors` avec `'var(--accent)'` etc.)

## 3. Catégories (lib/categories.ts)

Les clés DOIVENT correspondre exactement aux valeurs renvoyées par le flow Langflow. Si le flow renvoie une valeur inconnue, utiliser `a_verifier`.

```ts
export const CATEGORIES = {
  urgent:     { label: 'Urgent',      bg: 'var(--cat-urgent-bg)',      text: 'var(--cat-urgent-text)',      icon: 'alert-circle' },
  a_traiter:  { label: 'À traiter',   bg: 'var(--cat-a-traiter-bg)',   text: 'var(--cat-a-traiter-text)',   icon: 'circle-check' },
  devis:      { label: 'Devis',       bg: 'var(--cat-devis-bg)',       text: 'var(--cat-devis-text)',       icon: 'file-text' },
  factures:   { label: 'Factures',    bg: 'var(--cat-factures-bg)',    text: 'var(--cat-factures-text)',    icon: 'receipt' },
  pro:        { label: 'Pro',         bg: 'var(--cat-pro-bg)',         text: 'var(--cat-pro-text)',         icon: 'briefcase' },
  perso:      { label: 'Perso',       bg: 'var(--cat-perso-bg)',       text: 'var(--cat-perso-text)',       icon: 'user' },
  newsletter: { label: 'Newsletters', bg: 'var(--cat-newsletter-bg)',  text: 'var(--cat-newsletter-text)',  icon: 'news' },
  autre:      { label: 'Autre',       bg: 'var(--cat-autre-bg)',       text: 'var(--cat-autre-text)',       icon: 'dots' },
  a_verifier: { label: 'À vérifier',  bg: 'var(--ai-soft)',            text: 'var(--ai-text)',              icon: 'help-circle' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export function getCategory(key: string | null | undefined) {
  return CATEGORIES[(key ?? '') as CategoryKey] ?? CATEGORIES.a_verifier;
}

/** Couleur d'identification d'un compte, attribuée de façon stable par ordre de connexion. */
export const ACCOUNT_COLORS = [
  'var(--account-1)', 'var(--account-2)', 'var(--account-3)', 'var(--account-4)', 'var(--account-5)',
] as const;

export function getAccountColor(index: number) {
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
}
```

Composant `CategoryBadge` attendu :
- Catégorie validée : `background: bg; color: text`, pilule, 12 px, poids 500.
- Catégorie suggérée par l'IA (non validée) : même libellé mais rendu IA (`--ai-soft`, `--ai-text`, bordure pointillée `--ai`), avec une action pour valider ou changer.

## 4. États des actions

| Élément | Repos | Survol | Appui / sélection |
|---|---|---|---|
| Bouton principal | `accent` / `on-accent` | `accent-hover` | scale 0.97 |
| Bouton secondaire | `surface` + bordure `border-strong` | `surface-muted` | scale 0.97 |
| Bouton supprimer | texte `danger-text`, fond transparent | fond `danger-soft` | confirmation : fond `danger` / `on-danger` |
| Ligne de mail | `surface` | `surface-muted` | sélectionnée : `accent-soft` + barre gauche `accent` |
| Mail non lu | texte `text` poids 500 + point `accent` | idem | idem |
| Mail lu | texte `text-secondary` poids 400 | idem | idem |
