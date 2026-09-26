"""Creates (or updates, given a flow id) the "Email Sorter" flow in a running Langflow and prints its id.

Run with Langflow's own Python:
  ~/ProjetsWSL/langflow/.venv/bin/python langflow/create_flow.py
"""

import json
import urllib.request

from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph
from lfx_ollama.components.ollama import ChatOllamaComponent

LANGFLOW = "http://localhost:7860"

SYSTEM = """Tu ranges les emails d'un utilisateur. Le message contient la liste de ses dossiers (avec des exemples d'objets de mails déjà rangés), les idées de nouveaux dossiers déjà proposées, puis un email.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"folder": <chemin exact d'un dossier de la liste, ou null>, "confidence": "haute" | "moyenne" | "basse", "new_folder_idea": <nom court d'un nouveau dossier, ou null>}

Règles :
- Un dossier existant ne convient que si l'email concerne le même organisme, lieu ou sujet que les exemples de ce dossier. Un sujet voisin ne suffit pas : une école ou un accompagnement professionnel n'est pas une candidature à une offre d'emploi, un voyage n'a rien à voir avec un logement.
- En cas de doute : folder = null.
- Si folder est null, propose toujours new_folder_idea : le nom de l'organisme, du service ou de la démarche concernés (ex. le nom de l'école ou de l'organisme), ou une catégorie ("Newsletters", "Publicités", "Notes perso") pour les mails génériques. Si une idée déjà proposée convient, recopie son nom exactement.
- confidence : ta certitude sur le choix de folder."""


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
        name="Email Sorter", description="Prédit le dossier Outlook d'un email (Ollama local)."
    )


def post(path: str, body: dict, token: str, method: str = "POST") -> dict:
    req = urllib.request.Request(
        LANGFLOW + path,
        method=method,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    return json.load(urllib.request.urlopen(req))


if __name__ == "__main__":
    import sys

    token = json.load(urllib.request.urlopen(LANGFLOW + "/api/v1/auto_login"))["access_token"]
    if len(sys.argv) > 1:  # update an existing flow in place: create_flow.py <flow_id>
        print(post(f"/api/v1/flows/{sys.argv[1]}", {"data": build()["data"]}, token, "PATCH")["id"])
    else:
        print(post("/api/v1/flows/", build(), token)["id"])
