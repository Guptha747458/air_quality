import { routeHandler } from '../server/index.js';

export default async function handler(req, res) {
  req.url = req.url.startsWith('/api') ? req.url : `/api${req.url}`;
  return routeHandler(req, res);
}
