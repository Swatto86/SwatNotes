/**
 * WebdriverIO Configuration for Tauri E2E Testing
 *
 * Strategy: Start the Tauri app with WebView2 remote debugging enabled,
 * then connect msedgedriver to it via debuggerAddress.
 *
 * Prerequisites:
 * 1. Build the app: npm run tauri build
 * 2. Ensure msedgedriver.exe is in your PATH
 *
 * Run: npm run test:e2e
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');

// Remote debugging port for WebView2
const DEBUG_PORT = 9222;

// Determine the application binary path (Windows only)
function getAppBinaryPath() {
  // Note: Tauri builds to target/release/ with lowercase name
  const basePath = path.resolve(__dirname, 'target', 'release');
  return path.join(basePath, 'swatnotes.exe');
}

// Store processes globally
let edgeDriver = null;
let tauriApp = null;

exports.config = {
  // Connect directly to msedgedriver
  hostname: '127.0.0.1',
  port: 4444,

  // Test specs
  specs: ['./e2e/**/*.spec.ts'],
  exclude: [],

  // IMPORTANT: Run only one instance - WebView2 apps can only have one session
  maxInstances: 1,

  // Capabilities for WebView2 testing
  // Connect to already-running app via debuggerAddress
  capabilities: [{
    maxInstances: 1,
    browserName: 'webview2',
    'ms:edgeOptions': {
      // Connect to the already-running WebView2 via debug port
      debuggerAddress: `localhost:${DEBUG_PORT}`,
    },
  }],

  // Test framework
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Reporters
  reporters: ['spec'],

  // Logging
  logLevel: 'warn',

  // Timeouts
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 5,

  // Runner
  runner: 'local',

  /**
   * Start the Tauri app and msedgedriver before tests
   */
  onPrepare: async function () {
    console.log('');
    console.log('='.repeat(60));
    console.log('SwatNotes E2E Tests (WebView2 Debug Mode)');
    console.log('='.repeat(60));
    console.log('');

    const appPath = getAppBinaryPath();
    console.log('App binary:', appPath);
    console.log('Debug port:', DEBUG_PORT);
    console.log('');

    // Kill any existing processes on our ports
    if (process.platform === 'win32') {
      try {
        spawnSync('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :4444\') do taskkill /F /PID %a'], { shell: true, stdio: 'ignore' });
        spawnSync('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :9222\') do taskkill /F /PID %a'], { shell: true, stdio: 'ignore' });
      } catch (e) {
        // Ignore errors
      }
    }

    // Start the Tauri app with WebView2 remote debugging enabled
    console.log('Starting SwatNotes with remote debugging...');
    tauriApp = spawn(appPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Enable WebView2 remote debugging
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${DEBUG_PORT}`,
      },
    });

    tauriApp.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[SwatNotes]', msg);
    });

    tauriApp.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[SwatNotes]', msg);
    });

    tauriApp.on('error', (err) => {
      console.error('Failed to start SwatNotes:', err.message);
    });

    // Wait for the app to start and WebView2 to initialize
    console.log('Waiting for app to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Start msedgedriver
    console.log('Starting msedgedriver...');

    edgeDriver = spawn('msedgedriver.exe', ['--port=4444', '--verbose'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    edgeDriver.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[msedgedriver]', msg);
    });

    edgeDriver.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[msedgedriver]', msg);
    });

    edgeDriver.on('error', (err) => {
      console.error('Failed to start msedgedriver:', err.message);
    });

    // Wait for msedgedriver to be ready
    console.log('Waiting for msedgedriver to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Ready to run tests');
    console.log('');
  },

  /**
   * Stop everything after tests
   */
  onComplete: async function () {
    console.log('');
    console.log('Stopping processes...');

    if (edgeDriver) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(edgeDriver.pid)], { stdio: 'ignore' });
      edgeDriver = null;
    }

    if (tauriApp) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(tauriApp.pid)], { stdio: 'ignore' });
      tauriApp = null;
    }
  },

  /**
   * Hook before each test suite
   * Helps prevent blank window issues by ensuring page is ready
   */
  beforeSuite: async function (suite) {
    console.log('');
    console.log('='.repeat(40));
    console.log('SUITE:', suite.title);
    console.log('='.repeat(40));
    
    // Give the WebView a moment to stabilize between suites
    await new Promise(resolve => setTimeout(resolve, 500));
  },

  /**
   * Hook before each test
   */
  beforeTest: function (test) {
    console.log('');
    console.log('TEST:', test.title);
  },

  /**
   * Hook after each test
   */
  afterTest: async function (test, context, { passed, error }) {
    console.log(passed ? '  ✓ PASSED' : '  ✗ FAILED');
    
    // If a test failed, log more details
    if (!passed && error) {
      console.log('  Error:', error.message?.substring(0, 100));
    }
  },
};
