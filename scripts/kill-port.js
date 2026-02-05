const { execSync } = require('child_process');

const port = process.argv[2] || 3080;

console.log(`Checking for process on port ${port}...`);

try {
  if (process.platform === 'win32') {
    // Windows: find and kill process
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    const lines = result.trim().split('\n');

    const pids = new Set();
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        pids.add(pid);
      }
    });

    pids.forEach(pid => {
      console.log(`Killing process ${pid}...`);
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch (e) {
        // Process might already be dead
      }
    });

    if (pids.size > 0) {
      console.log('Port cleared.');
      // Small delay to ensure port is released
      execSync('timeout /t 1 /nobreak', { stdio: 'ignore' });
    }
  } else {
    // Unix/Mac: use lsof and kill
    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
    const pids = result.trim().split('\n').filter(Boolean);

    pids.forEach(pid => {
      console.log(`Killing process ${pid}...`);
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      } catch (e) {
        // Process might already be dead
      }
    });

    if (pids.length > 0) {
      console.log('Port cleared.');
    }
  }
} catch (error) {
  // No process found on port - that's fine
  console.log(`No process found on port ${port}.`);
}

console.log('Ready to start dev server.');
