from sentence_transformers import SentenceTransformer

MODELS = [
    "intfloat/multilingual-e5-base",
    "sentence-transformers/LaBSE",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
]

for name in MODELS:
    print("Скачиваю:", name)
    model = SentenceTransformer(name, device="cpu")
    vec = model.encode(["тестовая фраза"], normalize_embeddings=True)
    print("  готово, размер вектора:", vec.shape[1])