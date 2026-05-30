# Dockerfiles & Deployment

Docker configurations for deploying applications to staging, preview, and production environments using PostgreSQL.

> **For local development**, see the docker-compose files in individual application directories.

## 📦 Files

**Dockerfiles:**

- `PragmaticPapers.Dockerfile` - Pragmatic Papers (Next.js + Payload CMS)

**Environment Template:**

- `.env.example` - Environment variables for all applications

## 🚀 Quick Deploy to Coolify

### 1. Generate Secrets

```bash
openssl rand -base64 32  # For PAYLOAD_SECRET
```

### 2. Create Service in Coolify

- **Type:** Dockerfile
- **Dockerfile:**
  - Pragmatic Papers: `dockerfiles/PragmaticPapers.Dockerfile`
- **Base directory:** `/`

### 3. Set Environment Variables

See `.env.example` for all available options. Required configuration:

**For Staging:**

```env
BUILD_ENV=staging
PAYLOAD_SECRET=<generated_secret>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
```

**For Preview (with automatic database naming):**

```env
BUILD_ENV=preview
PAYLOAD_SECRET=<generated_secret>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>
USE_LOCAL_STORAGE=true
# COOLIFY_FQDN is automatically set by Coolify (e.g., pr-330.pragmaticpapers.com)
# Database name will be automatically suffixed with PR number
```

**For Production:**

```env
BUILD_ENV=production
PAYLOAD_SECRET=<generated_secret>
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
DATABASE_URI=postgresql://postgres:<password>@postgres:5432/<dbname>

# For Pragmatic Papers with S3 storage:
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
```

### 4. Configure Domain

- **Application:** Port `3000` → `your-domain.com`

### 5. Deploy

Click **Deploy** in Coolify. The application will:

- ✓ Connect to PostgreSQL database
- ✓ Run migrations automatically during build
- ✓ Start serving on port 3000

## ⚙️ Architecture

```
┌─────────────────┐
│  Application    │
│     :3000       │
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │
│  (External DB)  │
└─────────────────┘
```

Use managed PostgreSQL service (AWS RDS, Supabase, Neon, etc.) for all deployments.

## 🔍 Common Issues

**Build failures:**

- Ensure all required environment variables are set in Coolify
- Required: `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, and `DATABASE_URI`
- Verify PostgreSQL database is accessible during build (migrations run at build time)

**Database connection errors:**

- Verify `DATABASE_URI` connection string format: `postgresql://user:password@host:port/database`
- Ensure PostgreSQL service is accessible from your deployment
- Check database credentials and permissions

## 🔒 Production Notes

### For All Deployments:

1. Use managed PostgreSQL (AWS RDS, Supabase, Neon, etc.)
2. Generate strong secrets: `openssl rand -base64 32`
3. Configure CDN for static assets (Pragmatic Papers with S3)
4. Set up automated database backups
5. Enable monitoring and alerting

## 📝 Data Persistence

### PostgreSQL Database:

- Use managed PostgreSQL service for all environments
- Configure automated backups through your provider
- Data persistence handled by database service
- Migrations run automatically during Docker build

### Media Storage (Pragmatic Papers):

- **Staging/Preview**: Local storage with persistent volumes
- **Production**: S3-compatible storage (recommended)

## 🗄️ Database Configuration

Pragmatic Papers uses PostgreSQL exclusively for Docker deployments.

### PostgreSQL Configuration

```env
DATABASE_URI=postgresql://postgres:password@postgres:5432/pragmatic_papers
```

**Benefits:**

- ✅ Production-ready for all environments
- ✅ Robust and scalable
- ✅ Better for high concurrency
- ✅ Advanced querying capabilities
- ✅ Reliable data persistence
- ✅ Industry-standard database

**How it works:**

1. Requires external PostgreSQL database service
2. Database connection via `DATABASE_URI`
3. Migrations run automatically during build
4. Data persisted by PostgreSQL service

**Recommended Managed Services:**

- **AWS RDS** - Enterprise-grade, highly available
- **Supabase** - PostgreSQL with built-in APIs and auth
- **Neon** - Serverless PostgreSQL with branching
- **DigitalOcean Managed Databases** - Simple and affordable
- **Railway** - Developer-friendly platform
- Or run your own PostgreSQL instance

### Automatic Database Naming for Preview Deployments (Coolify)

When deploying with Coolify, preview deployments automatically get unique database names based on the `COOLIFY_FQDN` environment variable.

**How it works:**

When `BUILD_ENV=preview` and Coolify sets `COOLIFY_FQDN` (e.g., `pr-330.pragmaticpapers.com`), the Dockerfile will:

1. Extract the prefix (`pr-330`)
2. Sanitize it for database naming (`pr_330`)
3. Append it to your database name

**Example:**

```env
# Your base configuration
BUILD_ENV=preview
DATABASE_URI=postgresql://postgres:password@db.example.com:5432/pragmatic_papers

# Coolify sets this automatically for PR #330
COOLIFY_FQDN=pr-330.pragmaticpapers.com

# Result: Database name becomes "pragmatic_papers_pr_330"
# Full URI: postgresql://postgres:password@db.example.com:5432/pragmatic_papers_pr_330
```

**Benefits:**

- ✅ Automatic unique database per preview deployment
- ✅ No manual configuration needed
- ✅ Works seamlessly with database copy feature
- ✅ Clean isolation between preview environments
- ✅ Easy to identify which database belongs to which PR
- ✅ Only activates for `BUILD_ENV=preview` (staging/production unaffected)

**Note:** For staging and production deployments, set `BUILD_ENV` to `staging` or `production`, and the original `DATABASE_URI` will be used as-is regardless of `COOLIFY_FQDN`.

### Database Copy for Preview Deployments

You can create isolated database copies for preview deployments to prevent schema mismatches between staging and preview environments. This feature is particularly useful when:

- Running migrations in preview environments that might conflict with staging
- Testing database migrations before applying to staging
- Creating isolated preview environments for feature branches

**Configuration:**

```env
# Enable database copy (set to 'true' to activate)
COPY_SOURCE_DATABASE=true

# Source database to copy from (typically your staging database)
SOURCE_DATABASE_URI=postgresql://postgres:password@staging-host:5432/pragmatic_papers_staging

# Target database (your preview database)
DATABASE_URI=postgresql://postgres:password@preview-host:5432/pragmatic_papers_preview_123

# Force copy even if target exists (optional, default: false)
# WARNING: This will DROP and recreate the target database
FORCE_DATABASE_COPY=false
```

**How it works:**

1. During Docker build, before running migrations (`ci` step)
2. Script checks if `COPY_SOURCE_DATABASE=true`
3. If source and target are on same PostgreSQL server:
   - Uses efficient `CREATE DATABASE WITH TEMPLATE` command
4. If source and target are on different servers:
   - Uses `pg_dump` and `pg_restore` for cross-server copy
5. After copy completes, migrations run on the isolated copy
6. Target database is left untouched if it already exists (unless `FORCE_DATABASE_COPY=true`)

**Example Use Cases:**

1. **Preview deployments in Coolify (with automatic naming):**

   ```env
   BUILD_ENV=preview
   # Coolify automatically sets COOLIFY_FQDN=pr-330.pragmaticpapers.com
   # Database name will become "pragmatic_papers_pr_330" automatically
   COPY_SOURCE_DATABASE=true
   SOURCE_DATABASE_URI=postgresql://user:pass@db.example.com:5432/pragmatic_papers_staging
   DATABASE_URI=postgresql://user:pass@db.example.com:5432/pragmatic_papers
   # Result: Copies staging_db to pragmatic_papers_pr_330
   ```

2. **Preview deployments (manual database name):**

   ```env
   COPY_SOURCE_DATABASE=true
   SOURCE_DATABASE_URI=postgresql://user:pass@staging-db:5432/staging_db
   DATABASE_URI=postgresql://user:pass@preview-db:5432/preview_pr_42
   ```

3. **Rebuilding preview with fresh data:**
   ```env
   COPY_SOURCE_DATABASE=true
   SOURCE_DATABASE_URI=postgresql://user:pass@staging-db:5432/staging_db
   DATABASE_URI=postgresql://user:pass@preview-db:5432/preview_pr_42
   FORCE_DATABASE_COPY=true  # Force recreate
   ```

**Requirements:**

- Both source and target databases must be PostgreSQL
- Database user must have permissions to create databases and copy data
- For cross-server copies: network connectivity between servers required
- Database must be accessible during Docker build time

**Complete Coolify Preview Workflow:**

When using both automatic database naming and database copying together:

```env
# Configuration for Coolify preview deployments
BUILD_ENV=preview
COPY_SOURCE_DATABASE=true
SOURCE_DATABASE_URI=postgresql://user:pass@db.example.com:5432/pragmatic_papers_staging
DATABASE_URI=postgresql://user:pass@db.example.com:5432/pragmatic_papers

# Coolify automatically sets: COOLIFY_FQDN=pr-330.pragmaticpapers.com
```

**What happens:**

1. `BUILD_ENV=preview` enables automatic database naming
2. Coolify sets `COOLIFY_FQDN=pr-330.pragmaticpapers.com`
3. Dockerfile modifies `DATABASE_URI` to use database name `pragmatic_papers_pr_330`
4. Database copy script creates `pragmatic_papers_pr_330` from `pragmatic_papers_staging`
5. Migrations run on the new isolated database
6. Application builds and connects to `pragmatic_papers_pr_330`

**Result:** Each PR gets its own isolated database copy, automatically named and seeded with fresh data from staging!

**For Staging/Production:**
Simply set `BUILD_ENV=staging` or `BUILD_ENV=production`, and the automatic naming will be skipped, using your `DATABASE_URI` exactly as configured.

## 💾 Storage Configuration (Pragmatic Papers)

Pragmatic Papers supports two storage modes for uploaded media files:

### Local Storage (Staging/Preview)

```env
USE_LOCAL_STORAGE=true
```

**Benefits:**

- No S3 credentials needed
- Simpler setup for staging/preview environments
- Files persist via Docker volumes

**Requirements:**

- Configure persistent volume mount in Coolify for `/app/apps/pragmatic-papers/public/media/`
- Regular backups of the media volume recommended

### S3 Storage (Production)

```env
USE_LOCAL_STORAGE=false
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://s3.amazonaws.com
```

**Benefits:**

- Files stored in S3-compatible storage (AWS S3, Supabase Storage, Cloudflare R2, etc.)
- Better scalability and CDN integration
- Automatic redundancy and backups
- Recommended for production deployments

## 🆘 Need Help?

- Check environment variable examples: `.env.*.example`
- Review Coolify logs for build/runtime errors
- Verify health checks in Coolify dashboard
