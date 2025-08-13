# rag-cli

CLI-based RAG (Retrieval-Augmented Generation) system with document search capabilities.

## Features

- **Interactive Chat Interface**: Streaming AI responses powered by Google Gemini
- **Document Search**: AI can search through uploaded documents to provide informed answers
- **Vector Database**: Uses libSQL with native vector support for semantic search

## Usage

Quick start (npm, scoped package):

```bash
# Option 1: run the package directly (may run the default bin if supported)
npx @yeoularu/rag-cli

# Option 2: explicitly run the CLI command from the scoped package (recommended)
npx --package=@yeoularu/rag-cli rag
```

Using Bun:

```bash
# Explicitly run the CLI command from the scoped package
bunx @yeoularu/rag-cli rag
```

Specify a custom DB path (default: `~/.rag-cli/libsql.db`):

```bash
npx --package=@yeoularu/rag-cli rag --db ~/.rag-cli/mydata.db
```

Local development:

```bash
bun install
bun run dev
```

Format code:

```bash
bun run format
```

This project was created using `bun init`. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
