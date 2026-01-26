# Plex Library Intersection - Web App

A web-based interface for comparing Plex libraries. Find movies and shows in friends' libraries that you don't have.

## Features

- **Plex OAuth Login** - Secure authentication via Plex
- **Library Comparison** - Compare your library against multiple friends' libraries
- **Visual Overlap** - Interactive Venn diagram showing shared content
- **Library Similarity** - Percentage-based similarity scores between libraries
- **Filtering & Sorting** - Filter by type, year, resolution, and more
- **Pagination** - Browse through large result sets easily
- **CSV Export** - Download filtered results as CSV
- **Dark/Light Mode** - Theme toggle with smooth transitions
- **Color-Coded Libraries** - Each library gets a distinct color for easy identification

## Prerequisites

- Node.js 18+ 
- A Plex account with access to shared libraries

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Configure `.env.local` with your Plex app credentials:
   ```
   NEXT_PUBLIC_PLEX_CLIENT_ID=your-unique-client-id
   ```

   You can generate a unique client ID or use any unique string.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign in** with your Plex account
2. **Select your library** (Step 1) - Choose the library you want to compare against
3. **Select friends' libraries** (Step 2) - Choose one or more libraries to compare
4. **Click Compare** - The app will fetch and analyze the libraries
5. **View Results**:
   - **Library Overlap** - Venn diagram visualization
   - **Library Similarity** - Similarity percentages with progress bars
   - **Summary** - Total missing and unique items
   - **Library Breakdown** - Per-library statistics
   - **Missing Items** - Paginated table of items you don't have

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - UI component library
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library

## Docker

### Build and Run Locally

```bash
# Build the image
docker build -t plex-library-intersection .

# Run the container
docker run -p 3000:3000 plex-library-intersection
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Using Pre-built Image

Pull from GitHub Container Registry:

```bash
docker pull ghcr.io/YOUR_USERNAME/plex-library-intersection:latest
docker run -p 3000:3000 ghcr.io/YOUR_USERNAME/plex-library-intersection:latest
```

### Subfolder Deployment (Reverse Proxy)

If deploying behind a reverse proxy at a subfolder (e.g., `https://example.com/plexintersection/`), you need to build with the `NEXT_PUBLIC_BASE_PATH` argument:

```bash
# Build with base path
docker build --build-arg NEXT_PUBLIC_BASE_PATH=/plexintersection -t plex-library-intersection .

# Run the container
docker run -p 3000:3000 plex-library-intersection
```

Your Nginx config should strip the prefix before proxying:

```nginx
location /plexintersection {
    rewrite ^/plexintersection(/.*)$ $1 break;
    proxy_pass http://localhost:3000;
}
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  plex-library-intersection:
    image: ghcr.io/YOUR_USERNAME/plex-library-intersection:latest
    # Or build locally with subfolder support:
    # build:
    #   context: .
    #   args:
    #     NEXT_PUBLIC_BASE_PATH: /plexintersection
    ports:
      - "3000:3000"
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Deployment

### Vercel / Netlify

Deploy to Vercel, Netlify, or any platform supporting Next.js:

```bash
npm run build
npm start
```

For Vercel:
```bash
vercel
```

### Self-Hosted (Docker)

The GitHub Actions workflow automatically builds and pushes Docker images to GitHub Container Registry on every commit to main/master.
