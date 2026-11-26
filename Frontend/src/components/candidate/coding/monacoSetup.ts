import { loader } from "@monaco-editor/react";

// Self-host Monaco assets from same-origin /monaco/vs (copied from node_modules/monaco-editor/min/vs)
// Zero requests ever hit a public CDN.
loader.config({
  paths: {
    vs: "/monaco/vs",
  },
});
