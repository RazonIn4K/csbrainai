import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

function parseEnvLine(line: string): [string, string] | null {
  if (!line || line.startsWith('#')) {
    return null;
  }
  const separatorIndex = line.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }
  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();
  if (!key) {
    return null;
  }
  return [key, value];
}

/**
 * Loads .env.local and .env into process.env if values are not already present.
 * Keeps dependencies minimal by avoiding dotenv for example scripts.
 */
export function hydrateEnv() {
  const envFiles = ['.env.local', '.env'];

  for (const fileName of envFiles) {
    const filePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .forEach((line) => {
        const parsed = parseEnvLine(line);
        if (!parsed) return;
        const [key, value] = parsed;
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
  }
}

export function resolveExamplePath(exampleName: string, ...segments: string[]) {
  return path.join(ROOT_DIR, 'examples', exampleName, ...segments);
}
