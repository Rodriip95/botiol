import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// El .env vive en la raíz del monorepo.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'] as const;

const EnvSchema = z.object({
  IOL_USER: z.string().min(1, 'Falta IOL_USER en .env'),
  IOL_PASS: z.string().min(1, 'Falta IOL_PASS en .env'),
  IOL_BASE_URL: z.url().default('https://api.invertironline.com'),
  // El backend nunca se expone fuera de localhost.
  HOST: z.enum(LOCAL_HOSTS).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida (revisá .env, ver .env.example):\n${issues}`);
  }
  return parsed.data;
}
