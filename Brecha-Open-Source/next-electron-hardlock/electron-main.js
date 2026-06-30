const { app, BrowserWindow } = require('electron');
const path = require('path');
const { machineIdSync } = require('node-machine-id');

let mainWindow;

async function validateLicense() {
  const hwid = machineIdSync(true);
  console.log(`[License Validator] HWID: ${hwid}`);
  
  // Example: Check HWID against your backend API
  // const res = await fetch(`https://your-api.com/verify?hwid=${hwid}`);
  // return res.ok;
  
  return true; // Assume valid for boilerplate
}

app.whenReady().then(async () => {
  const isValid = await validateLicense();
  
  if (!isValid) {
    console.error("Invalid License! Exiting.");
    app.quit();
    return;
  }

  // Start internal Next.js server
  const serverPath = path.join(__dirname, 'server.js');
  require(serverPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false }
  });

  // Connect to internal server (assumes port 3000 for boilerplate)
  mainWindow.loadURL('http://localhost:3000');
});
