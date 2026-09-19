const { spawnSync } = require('child_process');
const path = require('path');

const [buildTarget = 'web', appEnv = 'nube'] = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '..');
const nextBin = require.resolve('next/dist/bin/next', { paths: [projectRoot] });

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    BUILD_TARGET: buildTarget,
    NEXT_PUBLIC_APP_ENV: appEnv,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=6144',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
