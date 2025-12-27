# Contributing & Placement Guidelines

This repository is a mono-repo with explicit placement rules to keep the codebase predictable.

## Quick Rules

1. **Frontend**
   - UI components live in `frontend/src/components`, route pages in `frontend/src/pages`.
   - Tests belong inside `__tests__` folders (e.g., `frontend/src/components/__tests__/Timer.test.tsx`).
   - Shared hooks/services/stores live in their dedicated folders under `frontend/src`.

2. **Backend**
   - Express routes go in `backend/src/routes` and should delegate to services in `backend/src/services`.
   - Database access stays within `backend/src/repositories`.
   - Tests reside in `backend/src/__tests__` (unit) or nested folders such as `backend/src/__tests__/integration`.

3. **Shared Packages**
   - Each directory under `shared/` must contain its own `package.json` and build output.
   - Reusable helpers (error handling, test config, etc.) should be published here rather than duplicated in app packages.

4. **Docs**
   - Project-wide documentation sits in `docs/`. Start with `PROJECT_STRUCTURE.md` for navigation and keep related diagrams/files alongside it.

## Verification Script

Run the structure checks before committing:

```bash
npm run lint
```

This invokes `scripts/verify-structure.mjs`, which validates:
- Required directories exist (`frontend/src/components`, `backend/src/routes`, etc.).
- Test files (`*.test.ts(x)`) only appear inside `__tests__` folders.
- Shared packages under `shared/` contain a `package.json`.
- Documentation artifacts such as `docs/PROJECT_STRUCTURE.md` and `docs/architecture-diagram.svg` are present.

The script will list violations and exit with a non-zero status so CI can flag misplaced files early.

## Helpful References

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Frontend README](../frontend/README.md)
- [Backend README](../backend/README.md)
