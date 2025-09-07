# Docker (Bun) — quick guide

This project uses Bun. The repository includes two Dockerfiles:

- `Dockerfile` — production image (installs only production deps).
- `Dockerfile.dev` — development image (installs all deps and runs hot reload).

Build production image:

```bash
# from project root
docker build -t line-perplexity:prod -f Dockerfile .
```

Run production container (exposes port 3000):

```bash
docker run -e LINE_CHANNEL_ACCESS=... -e LINE_CHANNEL_SECRET=... -p 3000:3000 line-perplexity:prod
```

Build and run dev container (mount current dir for live reload):

```bash
docker build -t line-perplexity:dev -f Dockerfile.dev .
docker run --rm -it -p 3000:3000 -v "$(pwd)":/app -e LINE_CHANNEL_ACCESS=... -e LINE_CHANNEL_SECRET=... line-perplexity:dev
```

Notes:
- Provide `PERPLEXITY_COOKIES` if you want pro access. Without it the client uses auto mode.
- Bun automatically loads `.env` inside containers if provided.
