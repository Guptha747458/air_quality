import { routeHandler } from '../server/index.js';

export default async function handler(req, res) {
  req.url = '/health';
  return routeHandler(req, res);
}
