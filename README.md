# Scaddle

An AI-powered OpenSCAD IDE with real-time 3D visualization. Write OpenSCAD code manually or generate it from natural language descriptions using Google's Gemini AI.

## Features

- **Code Editor**: Monaco Editor with OpenSCAD syntax highlighting and autocomplete
- **AI Code Generation**: Describe what you want in natural language, get OpenSCAD code via Gemini 2.5 Flash
- **3D Visualization**: Real-time rendering with Three.js and interactive orbit controls
- **STL Export**: Generate and download STL files for 3D printing
- **Browser-Based Compilation**: OpenSCAD runs entirely in-browser via WebAssembly

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
- Google GenAI (Gemini 2.5 Flash)
- Better Auth 1.3.7
- PostgreSQL

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
│   │   │   │   ├── services/   # tRPC client service
│   │   │   │   └── workers/    # OpenSCAD WASM web worker
│   │   │   └── openscad-wasm/  # Prebuilt WASM files
│   │   └── package.json
│   └── server/                 # Bun backend
│       ├── index.ts            # Server entry point & tRPC router
│       ├── trpc.ts             # tRPC configuration
│       ├── auth.ts             # Better Auth setup
│       └── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh/) (required for server)
- [pnpm](https://pnpm.io/) 10.12.1+
- [PostgreSQL](https://www.postgresql.org/) database
- [Google Gemini API key](https://ai.google.dev/)

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
   DATABASE_URL=postgresql://user:password@localhost:5432/scaddle
   BETTER_AUTH_SECRET=your_random_secret_key_min_32_chars
   BETTER_AUTH_URL=http://localhost:3000
   ```

4. Run database migrations for authentication:
   ```bash
   cd apps/server && npx @better-auth/cli migrate
   ```

## Development

Start both client and server in development mode:
```bash
pnpm dev
```

- Client: http://localhost:4200
- Server: http://localhost:3000

Or run individually:
```bash
# Client only
cd apps/client && pnpm dev

# Server only
cd apps/server && pnpm dev
```

## Production Build

```bash
pnpm build
```

Build outputs:
- Client: `apps/client/dist/`
- Server: `apps/server/dist/`

## Usage

1. **Write Code**: Use the Monaco editor to write OpenSCAD code directly
2. **AI Generation**: Type a description in the chat (e.g., "Create a gear with 20 teeth") and the AI will generate OpenSCAD code
3. **Visualize**: Click "Render" to compile and view the 3D model
4. **Export**: Download the generated STL file for 3D printing

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests |

## License

GPL-3.0
