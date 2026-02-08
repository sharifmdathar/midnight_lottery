
import { DockerComposeEnvironment } from 'testcontainers';
import path from 'node:path';

try {
    const env = new DockerComposeEnvironment('.', 'standalone.yml');
    if (typeof env.withStartupTimeout === 'function') {
        console.log('withStartupTimeout is available');
    } else {
        console.error('withStartupTimeout is NOT available');
        process.exit(1);
    }
} catch (e) {
    console.error(e);
    process.exit(1);
}
