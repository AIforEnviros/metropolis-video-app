# How to Run the Metropolis Video App on Your Mac

Follow these steps to get the app running on your computer. This should take about 5 minutes.

---

## Step 1: Install Node.js

Node.js is a free program that lets you run the app on your computer.

**Choose ONE of these options:**

### Option A: Using Homebrew (if you already have it)
1. Open **Terminal** (find it in Applications → Utilities)
2. Type this and press Enter:
   ```
   brew install node
   ```
3. Wait for it to finish installing

### Option B: Direct Download (easier if you don't have Homebrew)
1. Go to [nodejs.org](https://nodejs.org)
2. Click the big green button that says "Download Node.js (LTS)"
3. Open the downloaded file and follow the installation instructions
4. Click "Continue" and "Install" when asked

---

## Step 2: Download the App

1. Open **Terminal** (Applications → Utilities → Terminal)
2. Copy and paste this, then press Enter:
   ```
   git clone https://github.com/funkmastertom/metropolis-video-app.git
   ```
3. Then type this and press Enter:
   ```
   cd metropolis-video-app
   ```

---

## Step 3: Start the App

1. In Terminal, type this and press Enter:
   ```
   npx serve . --listen 3000
   ```
2. Wait a few seconds until you see a message about the server running
3. Open your web browser (Chrome or Safari)
4. Type this in the address bar and press Enter:
   ```
   localhost:3000
   ```

**That's it! The app should now be running.**

---

## To Use It Again Later

Whenever you want to run the app again:

1. Open Terminal
2. Type: `cd metropolis-video-app` and press Enter
3. Type: `npx serve . --listen 3000` and press Enter
4. Open your browser and go to `localhost:3000`

---

## To Get Updates

When new features are added:

1. Open Terminal
2. Type: `cd metropolis-video-app` and press Enter
3. Type: `git pull` and press Enter
4. Start the app normally (Step 3 above)

---

## Having Trouble?

- Make sure you have internet connection for the initial setup
- If you see "command not found", Node.js didn't install correctly - try Option B from Step 1
- If port 3000 is busy, try using port 8000 instead: `npx serve . --listen 8000` then visit `localhost:8000`
- **If git clone asks for a password:** The repository might be private or you may have authentication issues. Try this alternative:
  1. Go to https://github.com/funkmastertom/metropolis-video-app
  2. Click the green "Code" button
  3. Click "Download ZIP"
  4. Unzip the file and move the folder to your preferred location
  5. In Terminal, navigate to that folder: `cd path/to/metropolis-video-app`
  6. Continue with Step 3
