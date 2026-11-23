import { routeHandler } from '../server/index.js';

export default async function handler(req, res) {
  return routeHandler(req, res);
}
