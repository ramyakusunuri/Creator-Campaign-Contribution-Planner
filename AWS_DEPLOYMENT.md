# Deploying on AWS

Your Next.js 14 full-stack app (with App Router, SSR, and API routes) can be deployed to AWS using any of the three options below. **AWS Amplify Hosting (Method 1)** is strongly recommended because it natively supports Next.js 14 App Router with zero server management.

---

## Method 1: AWS Amplify Hosting (Recommended — Quickest & Easiest)

AWS Amplify Hosting is AWS's managed platform designed specifically for full-stack Next.js applications with automatic CI/CD directly from GitHub.

### Step 1: Open AWS Amplify Console
1. Log into your [AWS Management Console](https://console.aws.amazon.com/).
2. In the search bar at the top, search for **AWS Amplify** and open it.
3. Select **Deploy an app** (or **Host web app**).

### Step 2: Connect GitHub Repository
1. Select **GitHub** as your Git provider and click **Next**.
2. Authorize AWS Amplify to access your GitHub account if prompted.
3. Select your repository: `Creator-Campaign-Contribution-Planner`.
4. Select your target deployment branch: `deploy-ready` (or `main`).
5. Click **Next**.

### Step 3: Configure Build Settings
AWS Amplify will automatically detect **Next.js - SSR**.
1. Verify the App name (e.g., `creator-campaign-contribution-planner`).
2. Expand **Advanced settings** -> **Environment variables**.
3. Add your environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: *(Your Supabase project URL, if configured)*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: *(Your Supabase anonymous key)*
   - `YOUTUBE_API_KEY`: *(Optional, for live YouTube creator discovery)*
   - `IG_USER_ID`: *(Optional, for live Instagram creator discovery)*
   - `IG_ACCESS_TOKEN`: *(Optional, for live Instagram creator discovery)*
   *(Note: The site also runs in full demo/presentation mode if Supabase or API keys are omitted).*
4. Click **Next**.

### Step 4: Review and Deploy
1. Click **Save and deploy**.
2. Amplify will automatically provision the build environment, run `npm ci` and `npm run build`, and deploy your site globally across AWS CloudFront CDN.
3. When the build completes, Amplify will provide your live URL (e.g., `https://main.d1234abcd.amplifyapp.com`).
4. Any future `git push` to your branch will automatically trigger a new deployment.

---

## Method 2: AWS App Runner (Containerized / Docker)

If you prefer deploying with Docker:

1. Add `output: 'standalone'` to `next.config.mjs`:
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'standalone',
     typescript: { ignoreBuildErrors: true },
     eslint: { ignoreDuringBuilds: true },
   };
   export default nextConfig;
   ```
2. Build and push your Docker image to **AWS ECR (Elastic Container Registry)**.
3. Go to **AWS App Runner** in the AWS Console, click **Create service**, choose your ECR image, set port `3000`, and deploy.

---

## Method 3: AWS EC2 (Virtual Machine with PM2 & Nginx)

If you want a dedicated Linux VM (eligible for AWS Free Tier on `t3.micro` or `t2.micro`):

1. **Launch an EC2 Instance**:
   - OS: Ubuntu 24.04 LTS
   - Instance Type: `t3.micro` or `t3.small`
   - Security Group: Allow Inbound traffic on Port `22` (SSH), Port `80` (HTTP), and Port `443` (HTTPS).
2. **SSH into the instance**:
   ```bash
   ssh -i your-key.pem ubuntu@<your-ec2-public-ip>
   ```
3. **Install Node.js 20 & Git**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git nginx
   sudo npm install -g pm2
   ```
4. **Clone & Build the App**:
   ```bash
   git clone https://github.com/your-username/Creator-Campaign-Contribution-Planner.git
   cd Creator-Campaign-Contribution-Planner
   npm install
   npm run build
   ```
5. **Start with PM2**:
   ```bash
   pm2 start npm --name "planner-app" -- start
   pm2 startup
   pm2 save
   ```
6. **Configure Nginx as a reverse proxy** to forward port `80` to `localhost:3000`.
