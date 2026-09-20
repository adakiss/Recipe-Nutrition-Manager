---
name: Angular JIT under Vite
description: Runtime requirements for using Angular standalone components directly through Vite without the Angular linker.
---

When Angular runs through plain Vite instead of the Angular linker, lower legacy decorators during TypeScript transformation and load the JIT compiler before importing partially compiled Angular libraries.

**Why:** Static ESM dependencies are evaluated before module code, so a normal side-effect compiler import does not guarantee it initializes before Angular libraries.

**How to apply:** Keep compiler loading ahead of dynamic Angular imports and verify the live preview, because a production bundle can still contain browser-incompatible decorator output.