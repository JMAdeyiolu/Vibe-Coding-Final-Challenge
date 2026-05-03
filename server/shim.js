import http from 'node:http';
import { analyzeEmail } from "./tools/analyzeEmail.js";
import { saveAnalysis } from "./tools/saveAnalysis.js";
import { getAnalysisHistory } from "./tools/getAnalysisHistory.js";
import { deleteAnalysis } from "./tools/deleteAnalysis.js";
import { logger } from "./utils/logger.js";

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || !req.url.startsWith('/tool/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const tool = req.url.replace('/tool/', '');
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const params = body ? JSON.parse(body) : {};
      let result;

      logger.info('shim', `Executing tool: ${tool}`, params);

      // Map tool names to their corresponding functions
      switch (tool) {
        case 'analyze_email':
          result = await analyzeEmail(params.email_text);
          break;
        case 'save_analysis':
          result = await saveAnalysis(params.email_text, params.result);
          break;
        case 'get_history':
          result = await getAnalysisHistory(params);
          break;
        case 'delete_analysis':
          result = await deleteAnalysis(params.id);
          break;
        default:
          res.writeHead(400);
          res.end(`Unknown tool: ${tool}`);
          return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      logger.error('shim', `Error executing tool ${tool}`, err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message);
    }
  });
});

server.listen(PORT, () => {
  logger.divider();
  logger.info('shim', `HTTP Shim Server running at http://localhost:${PORT}`);
  logger.info('shim', `Ready to accept requests from the frontend`);
  logger.divider();
});
