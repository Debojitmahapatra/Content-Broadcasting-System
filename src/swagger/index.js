/**
 * Swagger spec loader.
 *
 * Reads openapi.yml (base spec with components/schemas) and merges the
 * per-tag path files (auth.yml, content.yml, approval.yml, broadcast.yml)
 * into a single OpenAPI 3.0 document.
 *
 * Structure:
 *   src/swagger/
 *     openapi.yml    – info, servers, tags, components (schemas + responses)
 *     auth.yml       – /api/auth/* paths
 *     content.yml    – /api/content/* paths
 *     approval.yml   – /api/approval/* paths
 *     broadcast.yml  – /api/broadcast/* + /health paths
 *     index.js       – this file (merger + exporter)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadYaml(filename) {
  const filePath = path.join(__dirname, filename);
  return yaml.load(readFileSync(filePath, 'utf8'));
}

// Load base spec and all path files
const base = loadYaml('openapi.yml');
const pathFiles = ['auth.yml', 'content.yml', 'approval.yml', 'broadcast.yml'];

// Merge all paths into the base spec
const mergedPaths = {};
for (const file of pathFiles) {
  const doc = loadYaml(file);
  if (doc.paths) {
    Object.assign(mergedPaths, doc.paths);
  }
}

base.paths = mergedPaths;

export default base;
