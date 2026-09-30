import { onRequestGet as __api_resolve_js_onRequestGet } from "C:\\Users\\GEEKOM A8\\Documents\\Crypto\\cmc-api-hackaton\\ambiguitydesk\\functions\\api\\resolve.js"

export const routes = [
    {
      routePath: "/api/resolve",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_resolve_js_onRequestGet],
    },
  ]