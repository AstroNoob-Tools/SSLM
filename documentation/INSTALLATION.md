# SSLM - SeaStar Library Manager
## Installation & Setup Guide

This manual describes the step-by-step procedure to install and run the SSLM application on a brand new Windows computer.

---

### 1. Prerequisites
Before installing the application, you need to set up the runtime environment and tools.

#### 1.1 Install Node.js
SSLM is built on Node.js. Follow these steps to install it:

1.  Open a web browser and visit the official Node.js website: [https://nodejs.org/](https://nodejs.org/)
2.  Download the **LTS (Long Term Support)** version (Recommended for most users).
    *   *Example: 20.x.x LTS*
3.  Run the downloaded installer (`.msi` file).
4.  Follow the installation wizard:
    *   Accept the license agreement.
    *   Keep the default installation path (usually `C:\Program Files\nodejs\`).
    *   **Crucial:** Ensure "Add to PATH" is selected in the feature list (it is usually selected by default).
    *   Click **Install**.
5.  Once finished, you can verify the installation:
    *   Open **Command Prompt** (Press `Win + R`, type `cmd`, and hit Enter).
    *   Type `node -v` and press Enter. You should see a version number (e.g., `v20.11.0`).
    *   Type `npm -v` and press Enter. You should see a version number for the package manager.

#### 1.2 Install Git (Recommended)
Git is used to download ("clone") the application source code from GitHub.

1.  Visit the official Git for Windows downloader: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2.  Download the **64-bit Git for Windows Setup**.
3.  Run the installer.
4.  You can accept the default settings for all steps by clicking "Next" through the wizard.
5.  Verification:
    *   Open a *new* Command Prompt window.
    *   Type `git --version` and press Enter. You should see `git version 2.x.x`.

---

### 2. Application Installation

> [!IMPORTANT]
> The SSLM repository (`https://github.com/AstroNoob-Tools/SSLM`) is **private**.
> You must request access by sending an email to **astronoob001@gmail.com** for acceptance before you can clone or download the repository.

You have two options to download the application: using Git (recommended) or downloading a ZIP file.

#### Option A: Using Git (Recommended)
This method makes it easier to update the application in the future.

1.  Open **Command Prompt**.
2.  Navigate to the folder where you want to keep your applications (e.g., your Documents folder).
    ```cmd
    cd Documents
    ```
3.  Clone the repository from GitHub:
    ```cmd
    git clone https://github.com/AstroNoob-Tools/SSLM.git
    ```
4.  Enter the newly created directory:
    ```cmd
    cd SSLM
    ```
    *(Note: If you already have a folder named SSLM, this command might vary. Check the folder created by the clone.)*

#### Option B: Download ZIP
1.  Go to the GitHub repository page: [https://github.com/AstroNoob-Tools/SSLM](https://github.com/AstroNoob-Tools/SSLM)
2.  Click the green **Code** button and select **Download ZIP**.
3.  Extract the ZIP file to a permanent location (e.g., `C:\Apps\SSLM` or `Documents\SSLM`).
    *   *Note: Do not run it directly from the ZIP file or a temporary folder.*
4.  Open Command Prompt and navigate to that folder.
    *   *Tip: You can open the folder in File Explorer, type `cmd` in the address bar at the top, and press Enter.*

---

### 3. Install Dependencies
The application relies on several external software libraries ("node modules") that must be installed locally before the app can run.

1.  Ensure your Command Prompt is open and you are inside the application folder (e.g., `SSLM`).
2.  Run the following command:
    ```cmd
    npm install
    ```
3.  Wait for the process to complete.
    *   You will see a progress bar.
    *   A new folder named `node_modules` will be created in the directory.
    *   *Note: You might see some "vulnerability" warnings. These are standard notifications and are generally safe to ignore for a local, offline application.*

---

### 4. Configuration (Optional)
The application works out-of-the-box, but you can check the settings if you wish.

1.  Navigate to the `config` folder inside the application directory.
2.  Open `settings.json` with a text editor (Notepad, VS Code, etc.).
3.  You can adjust settings such as:
    *   `port`: The web port (default is `3000`).
    *   `seestar.directoryName`: The expected name of the folder on the SeeStar device (default is `"MyWorks"`).

---

### 5. Running the Application

1.  Open **Command Prompt** and ensure you are in the application folder (`SSLM`).
2.  Start the server by typing:
    ```cmd
    npm start
    ```
3.  You should see a startup message indicating the server is running:
    ```
    ╔═══════════════════════════════════════════════════╗
    ║   SSLM - SeaStar Library Manager - Running       ║
    ╠═══════════════════════════════════════════════════╣
    ║  URL:  http://localhost:3000                     ║
    ...
    ```
4.  **Important:** Keep this Command Prompt window open. Closing it will stop the application.

---

### 6. Accessing the Application
1.  Open your web browser (Chrome, Edge, Firefox, etc.).
2.  In the address bar, type:
    ```
    http://localhost:3000
    ```
3.  You should see the SSLM Welcome Screen.

---

### 7. Troubleshooting

*   **"npm is not recognized as an internal or external command"**: 
    *   This usually means Node.js wasn't added to your system environment variables (PATH). 
    *   **Fix:** Restart your computer and try again. If it persists, reinstall Node.js and explicitly ensure the "Add to PATH" option is checked during installation.

*   **"EADDRINUSE: address already in use"**: 
    *   This means Port 3000 is already being used by another program. 
    *   **Fix:** Open `config/settings.json`, change `"port": 3000` to a different number (e.g., `3001`), save the file, and try `npm start` again. Then access it at `http://localhost:3001`.

*   **Firewall Warnings**: 
    *   Windows Firewall may ask if you want to allow Node.js to access the network. 
    *   **Fix:** Click **Allow Access** (ensure "Private networks" is checked) to allow the app to communicate with devices on your local network.
