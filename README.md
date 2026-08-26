# APIForge

APIForge is a full-stack API testing and debugging platform inspired by tools like Postman, built from scratch as a learning and portfolio project.

## Project Scope
This project aims to provide a robust web interface where developers can design, execute, and analyze HTTP requests (GET, POST, PUT, DELETE, etc.), inspect responses, manage environments/variables, and save requests in collections.

## Current Technology Stack
*   **Frontend**: React + Vite + TypeScript
*   **Styling**: Tailwind CSS
*   **Backend**: Node.js + Express + TypeScript
*   **Database (Planned)**: Supabase PostgreSQL
*   **Authentication (Planned)**: Supabase Auth
*   **Version Control**: Git

## Development Status
*   **Phase 0 (Current)**: Project initialization. Initial layout is configured. Minimal React frontend is set up with Tailwind CSS. Basic Node.js + Express backend is running with a `/api/health` status check.
*   **Future Phases**: Request builder implementation, request execution engine, database integration, collection saving, and user authentication.

---

## How to Run

### Prerequisites
*   Node.js (v18+ recommended)
*   npm (or yarn / pnpm)

### Running the Frontend
1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local address (usually `http://localhost:5173`) in your browser.

### Running the Backend
1. Navigate to the `backend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express development server:
   ```bash
   npm run dev
   ```
4. Access the server endpoints (e.g. Health check: `http://localhost:3001/api/health`).
