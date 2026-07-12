"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// next.config.ts
var next_config_exports = {};
__export(next_config_exports, {
  default: () => next_config_default
});
module.exports = __toCommonJS(next_config_exports);
var import_next_pwa = __toESM(require("@ducanh2912/next-pwa"));
var import_path = __toESM(require("path"));
var isDesktop = process.env.BUILD_TARGET === "desktop";
var withPWA = (0, import_next_pwa.default)({
  dest: "public",
  disable: true,
  // Temporalmente apagado para evitar el OOM de 16GB en la nube
  register: true,
  skipWaiting: true
});
var nextConfig = {
  output: isDesktop ? "standalone" : void 0,
  // Standalone requerido solo para empaquetado Electron
  outputFileTracingRoot: import_path.default.join(__dirname, "./"),
  // @ts-ignore
  turbopack: {},
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizePackageImports: ["lucide-react", "firebase", "firebase/firestore", "@stripe/stripe-js", "recharts"]
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules", "C:\\pagefile.sys", "C:\\hiberfil.sys", "C:\\swapfile.sys"]
    };
    return config;
  }
};
var next_config_default = withPWA(nextConfig);
