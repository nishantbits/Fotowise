# Contributing to Fotowise

First off, thank you for considering contributing to Fotowise! It's people like you that make Fotowise such a great tool.

## 1. Where do I go from here?

If you've noticed a bug or have a request, make sure to check the [Issues](https://github.com/yourusername/fotowise/issues) to see if someone else in the community has already created a ticket. If not, go ahead and [make one](https://github.com/yourusername/fotowise/issues/new/choose)!

## 2. Fork & create a branch

If this is something you think you can fix, then fork Fotowise and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):
```bash
git checkout -b 325-add-image-crop-support
```

## 3. Local Development Setup

Fotowise consists of a Node.js Express Backend and a React Vite PWA Frontend.

### Prerequisites
* Node.js v20+
* SQLite3
* FFmpeg (must be installed on the host system)

### Run the App
```bash
# 1. Start the Server
cd server
npm install
npm run dev # Runs on localhost:3000

# 2. Start the Client
cd client
npm install
npm run dev # Runs on localhost:5173
```

## 4. Code Style Rules

Fotowise enforces strict linting and architecture patterns to ensure long-term stability:

- **TypeScript Only:** We strictly use TypeScript for all files. `any` types should be actively avoided.
- **Tailwind CSS:** All styling must be handled via Tailwind utility classes. No inline styles unless dynamically calculated.
- **Framer Motion:** Use Framer Motion for animations.
- **Async/Await:** Prefer `async/await` over raw Promises.
- **Error Handling:** Always wrap API calls with try/catch blocks and trigger the `useToastStore`.

## 5. Submitting your PR

Once your feature or bug fix is complete:
1. Ensure the app builds without TS errors (`npm run build` in both client and server).
2. Push your branch to your fork.
3. Open a Pull Request from your fork to the main Fotowise repository.
4. Fill out the PR template describing your changes.

Again, thank you for contributing!
