import { onRequestPost as __api_admin_login_js_onRequestPost } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\api\\admin\\login.js"
import { onRequestPost as __api_admin_upload_js_onRequestPost } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\api\\admin\\upload.js"
import { onRequest as __api_admin_data_js_onRequest } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\api\\admin\\data.js"
import { onRequestGet as __api_image__key__js_onRequestGet } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\api\\image\\[key].js"
import { onRequestGet as __api_portfolio_js_onRequestGet } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\api\\portfolio.js"
import { onRequest as ___middleware_js_onRequest } from "C:\\Users\\EliteBook\\Desktop\\Nouveau dossier\\portfolio  prof\\functions\\_middleware.js"

export const routes = [
    {
      routePath: "/api/admin/login",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_login_js_onRequestPost],
    },
  {
      routePath: "/api/admin/upload",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_upload_js_onRequestPost],
    },
  {
      routePath: "/api/admin/data",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_data_js_onRequest],
    },
  {
      routePath: "/api/image/:key",
      mountPath: "/api/image",
      method: "GET",
      middlewares: [],
      modules: [__api_image__key__js_onRequestGet],
    },
  {
      routePath: "/api/portfolio",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_portfolio_js_onRequestGet],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]