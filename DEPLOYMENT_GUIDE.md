# 🚀 Fotowise - Complete Deployment Guide

This guide will walk you through setting up and running **Fotowise** from scratch on both **Windows** and **Linux**. We will use Docker to ensure the installation is as simple and error-free as possible.

> [!NOTE]
> **Why Docker?** 
> Fotowise uses complex native extensions (like AI models, image processing, and database drivers). Docker packages all these requirements into a single, isolated "container" so you don't have to install any messy dependencies on your actual computer.

---

## 🛑 Step 1: Prerequisites (What you need installed)

Before starting, you need two basic tools installed on your computer.

### Windows Users
1. **Git**: Download and install from [git-scm.com](https://git-scm.com/downloads).
2. **Docker Desktop**: 
   - Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   - Install it and follow the prompts. Ensure **WSL 2 backend** is checked during installation (this makes Docker run faster).
   - Once installed, open the Docker Desktop application and leave it running in the background.

### Linux Users (Ubuntu/Debian)
Open your terminal and run these commands to install Git and Docker:
```bash
# Install Git
sudo apt update && sudo apt install git -y

# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the Docker group (so you don't need 'sudo' every time)
sudo usermod -aG docker $USER
```
*(Linux Users: After running the last command, **log out and log back in** or restart your computer for the permission changes to take effect).*

---

## 🛠️ Step 2: Download the Project

Now, download the Fotowise code to your computer.

1. Open your terminal (Linux) or **PowerShell** / **Git Bash** (Windows).
2. Navigate to where you want to save the project. For example, your Desktop:
   ```bash
   cd ~/Desktop
   ```
3. Copy the project code using Git:
   ```bash
   git clone <YOUR-GITHUB-REPO-URL> Fotowise
   # (Note: If you already have the folder, you can skip this step!)
   ```
4. Enter the newly created folder:
   ```bash
   cd Fotowise
   ```

---

## 🏗️ Step 3: Start the Application

Whether you are on Windows or Linux, the command to start the application is exactly the same!

Make sure you are inside the `Fotowise` directory, then run:

```bash
docker compose up -d --build
```

**What exactly does this do?**
- `--build`: Tells Docker to build the image exactly for your system. It will download the Python AI CLIP models, the Node.js servers, and set up all the heavy lifting. **(This will take 3-5 minutes the very first time you run it).**
- `-d`: Stands for "detached". It means the server will run silently in the background, freeing up your terminal for other commands.

---

## 🌐 Step 4: Access Your App!

Once the terminal gives you control back and the containers say `Started`, you are ready to go!

1. Open your favorite web browser (Chrome, Edge, Safari, etc.).
2. Go to: **[http://localhost:3000](http://localhost:3000)**

You will see the Fotowise interface. You can immediately start uploading photos!

---

## 📂 Where Are My Photos Saved?

When you start Docker, it automatically creates two folders inside your `Fotowise` project directory automatically:
- `data/`: This holds your `fotowise.db` SQLite database file. (All your tags, albums, and metadata).
- `library/`: This holds the physical files of the photos and thumbnails you upload.

> [!IMPORTANT]  
> **Keep these safe!** As long as you do not delete the `data/` or `library/` folders from your computer, your uploads and albums are completely permanent, even if you delete the Docker containers or restart your computer.

---

## ⚙️ Step 5: Managing the Application

Here are the only commands you will ever need to manage Fotowise day-to-day. Make sure you are inside the `Fotowise` folder when running them.

### To View Live Logs (See what the app is doing)
If you want to see the behind-the-scenes processing (like AI tagging your photos):
```bash
docker compose logs -f fotowise
```
*(Press `Ctrl + C` on your keyboard to exit the log view).*

### To Stop the Application
When you are done and want to turn the server off to save computer memory:
```bash
docker compose down
```

### To Restart or Update
If you made changes to the code or pulled a new layout update, you just run the start command with the build flag again:
```bash
docker compose up -d --build
```

---

## ❓ Troubleshooting

- **Error: "address already in यूज" or "port 3000 is occupied"**
  This means another program (maybe another server) is using port 3000. You need to close the other application, or edit the `docker-compose.yml` file and change `"3000:3000"` to `"8080:3000"`, then access the app at `http://localhost:8080`.

- **Windows Only: Docker command not found**
  Make sure Docker Desktop is currently running in your system tray (bottom right corner of your screen). It must remain open.

- **AI Face Detection is slow the first time**
  When you upload the very first photo, Fotowise might take an extra minute to download the facial recognition models silently in the background. Subsequent photos will be blazing fast!
