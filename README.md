# InstaManager Backend

NestJS backend API for Instagram content management and scheduling.

## Features

- 🔐 JWT Authentication with role-based access control
- 👥 User management (Admin/User roles)
- 📸 Instagram account management
- 📝 Content creation and management with media support
- ⏰ Advanced scheduling system with time slots
- 🤖 AI-powered content and schedule generation using Google Vertex AI
- 📲 Instagram API integration for posting
- 🗄️ PostgreSQL database with TypeORM
- 🐳 Docker support for containerization

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport.js
- **AI Integration**: Google Vertex AI (Gemini)
- **Instagram API**: Instagram Basic Display API
- **Validation**: class-validator
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Google Cloud account (for AI features)
- Instagram Developer account (for Instagram integration)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env` and configure:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=password
   DB_DATABASE=instamanager

   # JWT
   JWT_SECRET=your-super-secret-jwt-key

   # Application
   NODE_ENV=development
   PORT=3001
   FRONTEND_URL=http://localhost:3000

   # Google Cloud (AI)
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
   GOOGLE_CLOUD_PROJECT=your-project-id

   # Instagram API
   INSTAGRAM_CLIENT_ID=your-client-id
   INSTAGRAM_CLIENT_SECRET=your-client-secret
   INSTAGRAM_REDIRECT_URI=http://localhost:3001/auth/instagram/callback
   ```

3. **Database Setup**:
   ```bash
   # Start PostgreSQL with Docker
   docker-compose up -d postgres
   
   # Run migrations (automatic with synchronize: true in development)
   npm run start:dev
   ```

### Development

```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod

# Run tests
npm run test
npm run test:e2e
```

