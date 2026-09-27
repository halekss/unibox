"""Creates (or updates, given a flow id) the "Email Triage" flow in a running Langflow and prints its id.
Unlike Email Sorter (which folder?), it answers "what does this email ask of me?" and drafts replies.

Run with Langflow's own Python, from this folder:
  cd langflow && ~/ProjetsWSL/langflow/.venv/bin/python create_triage_flow.py [flow_id]
"""

import json
import sys
import urllib.request

from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph
from lfx_ollama.components.ollama import ChatOllamaComponent

from create_flow import LANGFLOW, post

# Category keys must match CATEGORIES in lib/triage.ts.
SYSTEM = """Tu tries les emails d'un utilisateur selon ce qu'ils attendent de lui. Le message contient un email.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"category": "repondre" | "faire" | "argent" | "lire" | "archiver", "summary": <phrase courte>, "amount": <montant ou null>, "draft": <réponse ou null>}

Catégories :
- repondre : une vraie personne attend une réponse écrite de l'utilisateur (question, demande, proposition, invitation).
- faire : l'email demande une action autre qu'une réponse (formulaire, rendez-vous à prendre, document à fournir, démarche, échéance).
- argent : facture, paiement, devis, remboursement, relevé, prélèvement, commande payée.
- lire : information utile à connaître, sans action ni réponse attendue.
- archiver : publicité, newsletter, notification automatique, code de connexion, confirmation sans valeur durable.

Règles :
- summary : 12 mots maximum, en français, dit ce qu'est l'email ou ce qu'il demande. Pas le nom de l'expéditeur. Ex. "Facture fournisseur du mois d'août", "Demande un créneau pour une visio".
- amount : le montant principal avec sa devise tel qu'écrit dans l'email (ex. "4 800 €"), seulement pour argent ou un devis ; sinon null.
- draft : seulement si category = repondre. Réponse complète, prête à envoyer, dans la langue et le ton de l'email, sans signature. N'invente aucun fait (date, prix, engagement) : écris [à compléter] à la place. Sinon null.
- En cas de doute entre deux catégories, choisis celle qui demande le plus à l'utilisateur (repondre > faire > argent > lire > archiver)."""


def build() -> dict:
    chat_input = ChatInput()
    model = ChatOllamaComponent()
    model.set(
        input_value=chat_input.message_response,
        base_url="http://localhost:11434",
        model_name="qwen2.5:14b",
        temperature=0,
        num_ctx=8192,
        system_message=SYSTEM,
    )
    chat_output = ChatOutput()
    chat_output.set(input_value=model.text_response)
    return Graph(start=chat_input, end=chat_output).dump(
        name="Email Triage", description="Catégorie d'action, résumé, montant et brouillon de réponse (Ollama local)."
    )


if __name__ == "__main__":
    token = json.load(urllib.request.urlopen(LANGFLOW + "/api/v1/auto_login"))["access_token"]
    if len(sys.argv) > 1:
        print(post(f"/api/v1/flows/{sys.argv[1]}", {"data": build()["data"]}, token, "PATCH")["id"])
    else:
        print(post("/api/v1/flows/", build(), token)["id"])
