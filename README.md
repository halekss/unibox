# Unibox

Une seule boîte pour Outlook et Gmail, triée par une IA qui tourne **sur ta machine**.

Unibox synchronise tes boîtes mail, propose un dossier pour chaque mail de la Boîte de réception et repère ceux qui peuvent partir à la corbeille. Rien ne bouge dans tes boîtes sans ton accord : tu vérifies, tu ajustes, tu ranges. Le modèle (Qwen 2.5 14B via Ollama) tourne sur ta carte graphique : gratuit, et aucun mail ne quitte ton ordinateur.

## Ce que fait l'app

| Page | Rôle |
|---|---|
| **Boîte de réception** | Outlook et Gmail réunis, en 3 colonnes : dossiers, liste, lecture. Recherche, filtres par boîte, rangement du mail ouvert en un clic. |
| **À ranger** | Les propositions de l'IA, présentées en casiers (un par dossier). Nom modifiable, Refuser ou Ranger, raccourcis `Entrée` / `R` / `J` / `K`, bouton **Annuler** après chaque rangement. |
| **À supprimer** | Les mails jugés inutiles, par expéditeur, par raison ou un par un. Supprimer envoie à la corbeille de la boîte (récupérable), Garder les retire définitivement de la liste. |
| **Comptes et IA** | Boîtes connectées, connexion et déconnexion, état de Langflow avec la commande pour le relancer. |

Ranger dans l'app range aussi dans la vraie boîte : dossier Outlook, ou libellé Gmail (créé s'il n'existe pas). Chaque dossier de la barre latérale porte un badge **O** (Outlook) et/ou **G** (Gmail) selon la boîte où il existe ; les sous-dossiers (`Epitech/Stages`) se déplient sous leur parent.

## Architecture

```
Navigateur ──► proxy.ts (mot de passe, contrôle d'origine)
                  │
                  ▼
            Next.js 16 (app/)  ──►  PostgreSQL 17 (Docker, port 5434)
                  │
                  ├──► Microsoft Graph (Outlook)   ─┐ jetons OAuth chiffrés
                  ├──► Gmail API (REST, sans SDK)  ─┘ en AES-256-GCM
                  │
                  └──► Langflow (localhost:7860) ──► Ollama (localhost:11434, qwen2.5:14b)
```

- **`lib/`** : logique métier et tests. `microsoft.ts` et `gmail.ts` pour les deux fournisseurs, `mailbox.ts` qui aiguille entre eux, `classify.ts` pour le tri IA, `accounts.ts` et `crypto.ts` pour les jetons, `auth.ts` pour la protection.
- **`app/`** : pages, server actions (`actions.ts`), routes OAuth et `/api/*`.
- **`langflow/create_flow.py`** : crée le flow « Email Sorter » dans Langflow (le prompt de tri est dedans).
- **`db/schema.sql`** : tables `accounts`, `folders`, `emails`. Les décisions de l'IA sont des tags JSON sur chaque mail (`folder:…`, `new_folder_idea:…`, `delete_suggested:…`, `rejected:…`, `keep`).

## Installation

Prérequis : Node.js 22.18+ (les tests exécutent le TypeScript directement), Docker, [Ollama](https://ollama.com) avec `qwen2.5:14b`, et [Langflow](https://www.langflow.org) 1.12 installé dans un environnement Python.

1. **Dépendances et configuration**
   ```bash
   npm install
   cp .env.example .env
   ```
   Remplis `.env`. `TOKEN_ENC_KEY` se génère avec :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   et `APP_PASSWORD` avec n'importe quelle chaîne longue (sans lui, l'app refuse tout).

2. **Base de données** (le schéma est appliqué à la première création du volume)
   ```bash
   docker compose up -d
   ```

3. **Comptes mail** (au moins un des deux)
   - **Outlook** : inscription d'application dans Azure, comptes Microsoft personnels, URI de redirection `http://localhost:3000/api/auth/callback`, permissions `offline_access User.Read Mail.ReadWrite`. Renseigne `MS_CLIENT_ID` et `MS_CLIENT_SECRET`.
   - **Gmail** : projet Google Cloud, Gmail API activée, écran de consentement en mode Test avec ton adresse comme testeur, client OAuth « Application Web » avec l'URI `http://localhost:3000/api/auth/google/callback`. Renseigne `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

4. **IA locale**
   ```bash
   ollama pull qwen2.5:14b
   LANGFLOW_OPEN_BROWSER=false ~/ProjetsWSL/langflow/.venv/bin/langflow run --host 127.0.0.1 --port 7860
   ~/ProjetsWSL/langflow/.venv/bin/python langflow/create_flow.py   # affiche l'id du flow
   ```
   Mets l'id affiché dans `LANGFLOW_FLOW_ID`, et une clé API Langflow dans `LANGFLOW_API_KEY`.

5. **Lancer l'app**
   ```bash
   npm run dev
   ```
   Ouvre http://localhost:3000 (identifiant libre, mot de passe = `APP_PASSWORD`), puis connecte tes boîtes depuis **Comptes et IA** et clique sur **Synchroniser**.

## Utilisation au quotidien

1. Lance Langflow (commande de l'étape 4) et `npm run dev`. Ils ne tournent pas en tâche de fond : ils s'arrêtent avec leur terminal.
2. **Synchroniser** dans la Boîte de réception pour récupérer les nouveaux mails (la synchro est incrémentale).
3. **À ranger** → **Analyser les 20 mails suivants** (environ 2 min), puis vérifie les casiers et range.
4. **À supprimer** → **Analyser** pour examiner les mails déjà rangés, puis fais le tri.

Si la barre latérale affiche « IA hors ligne », Langflow n'est pas lancé : la page **Comptes et IA** donne la commande.

## Accès depuis le téléphone (HTTPS privé)

L'app est servie par [Tailscale](https://tailscale.com) uniquement sur tes propres appareils, en HTTPS, sans rien exposer sur Internet :

```powershell
tailscale serve --bg 3000   # sur Windows, affiche https://<pc>.<tailnet>.ts.net
```

Le téléphone a besoin de l'app Tailscale connectée au même compte. La connexion des boîtes mail (OAuth) se fait depuis le PC, sur `localhost`. Un VPN actif sur le PC (NordVPN) peut empêcher le PC lui-même d'ouvrir l'adresse `ts.net`, sans gêner les autres appareils.

## Sécurité

- **Mot de passe** sur toutes les pages, routes et actions (`proxy.ts`, HTTP Basic, comparaison en temps constant). Sans `APP_PASSWORD`, tout est bloqué.
- **Anti-CSRF** : les requêtes d'écriture venant d'un autre site sont refusées ; les redirections internes n'acceptent que des chemins de l'app.
- **Jetons OAuth chiffrés** (AES-256-GCM) dans la base ; `.env` n'est jamais versionné.
- **Suppressions récupérables** : Unibox envoie à la corbeille de la boîte, jamais de suppression définitive. Déconnecter un compte efface seulement ses copies locales.
- HTTP Basic envoie le mot de passe à chaque requête : n'expose l'app qu'en HTTPS (Tailscale), jamais en `http://` hors de ta machine.

## Tests

```bash
npm test            # node --test lib/*.test.ts
npx tsc --noEmit    # typage
```

## Pistes d'amélioration

Nouveaux workflows Langflow, tous locaux :

1. **Résumé du jour** : un paragraphe chaque matin sur les nouveaux mails importants, en haut de la Boîte.
2. **Échéances et actions** : extraire dates et tâches des mails vers une page « À faire ».
3. **Brouillon de réponse** : proposer une réponse, créée en brouillon dans Outlook ou Gmail.
4. **Tri hybride** : règles par expéditeur connu d'abord, IA seulement pour les nouveaux cas.

Limites connues : un mail Gmail qui porte plusieurs libellés n'apparaît que dans un seul dossier ; l'analyse traite un lot à la fois (un seul processus, verrou en mémoire).
