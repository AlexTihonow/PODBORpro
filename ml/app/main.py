"""Сервис моделей. Пока только /health — остальные адреса появятся на неделе 3 (М-2).

Договор — ml/api/openapi.yaml. Владелец — инженер по машинному обучению.
"""

from fastapi import FastAPI

app = FastAPI(title="PODBORpro ML")


@app.get("/health")
def health() -> dict:
    # Модель ещё не загружается, поэтому model и dim пока пустые.
    return {"status": "ok", "model": None, "dim": None}
