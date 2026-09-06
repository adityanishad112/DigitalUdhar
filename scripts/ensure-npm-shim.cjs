const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  const binDir = path.join(__dirname, '..', 'node_modules', '.bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const npmCmdPath = path.join(binDir, 'npm.cmd');
  const npxCmdPath = path.join(binDir, 'npx.cmd');

  const npmShim = `@ECHO OFF\r\nSETLOCAL\r\n"%ProgramFiles%\\nodejs\\node.exe" "%ProgramFiles%\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" %*\r\n`;
  const npxShim = `@ECHO OFF\r\nSETLOCAL\r\n"%ProgramFiles%\\nodejs\\node.exe" "%ProgramFiles%\\nodejs\\node_modules\\npm\\bin\\npx-cli.js" %*\r\n`;

  try {
    fs.writeFileSync(npmCmdPath, npmShim, 'utf8');
    fs.writeFileSync(npxCmdPath, npxShim, 'utf8');
  } catch (err) {
    // Ignore error if permission is restricted
  }
}
