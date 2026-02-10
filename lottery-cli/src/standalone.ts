// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createLogger } from './logger-utils.js';
import path from 'node:path';
import { run } from './cli.js';

import { spawn } from 'node:child_process';
import { currentDir, StandaloneConfig } from './config.js';

const config = new StandaloneConfig();
const logger = await createLogger(config.logDir);

const dockerComposeFile = path.resolve(currentDir, '..', 'standalone.yml');

const runCommand = (command: string, args: string[], cwd: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
      }
    });
    process.on('error', (err) => reject(err));
  });
};

const cleanup = async () => {
  logger.info('Stopping docker containers...');
  try {
    await runCommand('docker', ['compose', '-f', 'standalone.yml', 'down', '-v'], path.dirname(dockerComposeFile));
  } catch (e) {
    logger.error(`Error stopping docker containers: ${e}`);
  }
};

try {
  await cleanup();
  logger.info('Starting docker containers...');
  // Use --wait to wait for healthchecks to pass (node, indexer, proof-server)
  await runCommand('docker', ['compose', '-f', 'standalone.yml', 'up', '-d', '--pull', 'always'], path.dirname(dockerComposeFile));

  // Check for healthy services
  const waitForService = async (name: string, url: string, timeout = 600000) => {
    logger.info(`Waiting for ${name} at ${url} to be healthy...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 405) { // 405 is fine for GraphQL GET check
          logger.info(`${name} is healthy!`);
          return;
        }
      } catch {
        // ignore error
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(`${name} failed to become healthy within ${timeout}ms`);
  };

  // Wait for Docker container health (indexer uses file-based healthcheck)
  const waitForContainerHealth = async (containerName: string, timeout = 600000) => {
    logger.info(`Waiting for ${containerName} container to be healthy...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await new Promise<string>((resolve, reject) => {
          const proc = spawn('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerName], { shell: true });
          let output = '';
          proc.stdout?.on('data', (data) => output += data.toString());
          proc.on('close', (code) => code === 0 ? resolve(output.trim()) : reject());
          proc.on('error', reject);
        });
        if (result === 'healthy') {
          logger.info(`${containerName} is healthy!`);
          return;
        }
      } catch {
        // ignore error
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(`${containerName} failed to become healthy within ${timeout}ms`);
  };

  await Promise.all([
    waitForService('Proof Server', 'http://localhost:6300/version'),
    waitForService('Node', 'http://localhost:9944/health'),
    waitForService('Indexer API', 'http://localhost:8088/api/v3/graphql'),
    waitForContainerHealth('lottery-indexer'),
  ]);

  await run(config, logger, cleanup);
} catch (e) {
  logger.error(`Error starting standalone environment: ${e}`);
  await cleanup();
  process.exit(1);
}

