# Scaddle

An AI-powered OpenSCAD IDE with real-time 3D visualization. Write OpenSCAD code manually or generate it from natural language descriptions using Google's Gemini AI.

## Features

- **Code Editor**: Monaco Editor with OpenSCAD syntax highlighting and autocomplete
- **AI Code Generation**: Describe what you want in natural language, get OpenSCAD code via Gemini AI
- **3D Visualization**: Real-time rendering with Three.js and interactive orbit controls
- **STL Export**: Generate and download STL files for 3D printing
- **Browser-Based Compilation**: OpenSCAD runs entirely in-browser via WebAssembly
- **Project Management**: Create, switch between, and auto-save named projects (requires sign-in)
- **Chat History**: AI conversations persist locally (IndexedDB) and per-project in the database
- **Bring Your Own Key**: Optionally use your own Gemini API key, stored securely server-side
- **User Authentication**: Email/password auth via Better Auth

## Tech Stack

**Frontend (Angular 20)**
- Angular 20.2.1 with standalone components
- Tailwind CSS 4.1.12
- Monaco Editor 0.52.2
- Three.js 0.179.1
- tRPC Client 11.5.0
- OpenSCAD WASM (prebuilt)

**Backend (Bun)**
- tRPC Server 11.5.0
- Google GenAI (Gemini)
- Better Auth 1.3.7
- SQLite (dev) / PostgreSQL (production)

**Build Tools**
- pnpm 10.12.1 (workspaces)
- Turbo 2.5.6 (monorepo orchestration)

## Project Structure

```
scaddle/
├── apps/
│   ├── client/                 # Angular frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── editor/     # Monaco code editor component
│   │   │   │   ├── renderer/   # Three.js 3D viewer component
│   │   │   │   ├── chat/       # AI chat interface component
│   │   │   │   ├── services/   # tRPC, auth, project & chat services
│   │   │   │   └── workers/    # OpenSCAD WASM web worker
│   │   │   └── openscad-wasm/  # Prebuilt WASM files
│   │   └── package.json
│   └── server/                 # Bun backend
│       ├── index.ts            # Server entry point (Bun.serve + static files)
│       ├── router.ts           # tRPC router (AI, projects, settings)
│       ├── trpc.ts             # tRPC configuration
│       ├── auth.ts             # Better Auth setup
│       ├── db.ts               # Database adapter (SQLite/PostgreSQL)
│       ├── db-adapter.ts       # DbAdapter interface
│       ├── context.ts          # tRPC context (session resolution)
│       ├── public/             # Angular build output (gitignored)
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) (required for server)
- [pnpm](https://pnpm.io/) 10.12.1+
- [Google Gemini API key](https://ai.google.dev/)
- [PostgreSQL](https://www.postgresql.org/) (production only; dev uses SQLite automatically)

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd scaddle
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables. Create `apps/server/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   BETTER_AUTH_SECRET=your_random_secret_key_min_32_chars
   BETTER_AUTH_URL=http://localhost:3000

   # Production only (dev uses SQLite automatically):
   # NODE_ENV=production
   # DATABASE_URL=postgresql://user:password@localhost:5432/scaddle
   ```

4. Run database migrations for authentication:
   ```bash
   cd apps/server && pnpm db:migrate
   ```

## Development

Start both client and server in development mode:
```bash
pnpm dev
```

This runs two tasks in parallel via Turbo:
- **Client**: `ng build --watch` (rebuilds Angular into `apps/server/public/` on changes)
- **Server**: `bun --watch index.ts` (serves everything on port 3000)

Open http://localhost:3000

## Production Build

```bash
pnpm build
```

The Angular frontend builds into `apps/server/public/`. The Bun server serves both static files and the API from a single process.

## Usage

1. **Write Code**: Use the Monaco editor to write OpenSCAD code directly
2. **AI Generation**: Type a description in the chat (e.g., "Create a gear with 20 teeth") and the AI will generate OpenSCAD code
3. **Visualize**: Click "Render" to compile and view the 3D model
4. **Export**: Download the generated STL file for 3D printing

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Build client + start server (watch mode) |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests |
| `cd apps/server && pnpm db:migrate` | Run auth database migrations |
| `cd apps/server && pnpm db:generate` | Generate auth schema |

## Acknowledgements

A big thank you to the [OpenSCAD](https://openscad.org/) team and the contributors behind the [openscad/openscad-wasm](https://github.com/openscad/openscad-wasm) project. Without their WebAssembly port of OpenSCAD, in-browser compilation would not be possible.

## License

GPL-2.0
