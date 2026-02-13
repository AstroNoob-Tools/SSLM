# SSLM - SeaStar Library Manager

A local web application for managing astrophotography files from SeeStar telescope devices.

**SSLM** (SeaStar Library Manager) helps you organize, analyze, and maintain your astrophotography library.

## Features

- Import files from SeeStar device (drive letter or network path)
- Work with existing local copies
- Interactive dashboard with collection statistics
- Real-time progress tracking for file operations
- Offline-first design (no internet required)
- Cross-platform Windows installer

## Requirements

- Node.js 18 or higher (for development)
- Windows OS (initial release)

## Installation (Development)

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or use development mode with auto-reload
npm run dev
```

## Usage

1. Start the application
2. Open your browser to `http://localhost:3000`
3. Choose import mode or local copy mode
4. Follow the on-screen wizard

## Project Structure

```
SSLM/
├── server.js           # Main Express server
├── config/             # Configuration files
├── src/                # Backend source code
│   ├── controllers/    # Route controllers
│   ├── services/       # Business logic
│   └── utils/          # Utility functions
├── public/             # Frontend static files
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript files
│   └── assets/        # Images, icons
└── views/             # HTML templates
```

## License

ISC
