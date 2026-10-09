// Registers the module-resolution hooks used by the frontend unit tests.
// Loaded via `node --import ./tests/helpers/register.mjs --test ...` (see the
// "test" script in package.json). No test-only dependencies: this only uses
// Node's built-in TypeScript type-stripping and node:test.
import { register } from "node:module";

register("./ts-alias-hooks.mjs", import.meta.url);
