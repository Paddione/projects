# Repository Setup Guide

This guide explains how to set up the repository after cloning, since large files (models, virtual environments, etc.) are excluded from version control.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/patrick-projects.git
cd patrick-projects

# Run the setup script
chmod +x setup.sh
./setup.sh
```

## Manual Setup

If you prefer to set up manually or the script doesn't work:

### 1. L2P Project Setup

```bash
cd l2p

# Install Node.js dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your credentials

# Set up database (if using Docker)
docker-compose up -d postgres

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### 2. Payment Project Setup

```bash
cd payment

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Configure Stripe keys and database URL

# Set up database
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development
npm run dev
```

### 3. VideoVault Project Setup

```bash
cd VideoVault

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development
npm run dev
```

### 4. VLLM Project Setup

This is the most complex setup due to AI/ML dependencies.

#### 4.1 Basic Setup

```bash
cd vllm

# Install Node.js dependencies
npm install
```

#### 4.2 AI Image Generation (Forge) Setup

```bash
cd ai-image-gen/forge

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
```

#### 4.3 Download AI Models

**Required Models for Stable Diffusion:**

1. **Base Model (6.5GB):**
   ```bash
   cd models/Stable-diffusion
   wget https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors
   ```

2. **Text Encoders:**
   ```bash
   cd ../text_encoder
   # CLIP L
   wget https://huggingface.co/openai/clip-vit-large-patch14/resolve/main/clip_l.safetensors
   
   # T5XXL (4.6GB)
   wget https://huggingface.co/DeepFloyd/t5-v1_1-xxl/resolve/main/t5xxl_fp8_e4m3fn.safetensors
   ```

3. **VAE Model:**
   ```bash
   cd ../VAE
   wget https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors
   ```

**Alternative:** Use the automated download script:
```bash
cd vllm
chmod +x download_image_models.sh
./download_image_models.sh
```

#### 4.4 Pinokio Setup (Optional)

If you need Pinokio:

```bash
cd vllm
# Download and install Pinokio
# Visit: https://pinokio.computer/
# Or use the setup script:
chmod +x setup_ai_image_stack.sh
./setup_ai_image_stack.sh
```

#### 4.5 RAG Setup

```bash
cd vllm/rag

# Start RAG services with Docker
docker-compose up -d

# Or use the script
chmod +x start_rag.sh
./start_rag.sh
```

### 5. Database Setup

All projects use PostgreSQL. You can either:

**Option A: Use Docker (Recommended)**
```bash
# Each project has docker-compose.yml
cd l2p
docker-compose up -d postgres
```

**Option B: Use Local PostgreSQL**
```bash
# Install PostgreSQL
sudo apt-get install postgresql  # Ubuntu/Debian
# or
brew install postgresql  # macOS

# Create databases
sudo -u postgres psql
CREATE DATABASE l2p;
CREATE DATABASE payment;
CREATE DATABASE videovault;
\q
```

## Environment Variables

Each project needs environment variables. Here are the key ones:

### L2P (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/l2p
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Payment (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

### VLLM (.env)
```env
# Add any API keys or configuration needed
```

## Verification

After setup, verify everything works:

```bash
# L2P
cd l2p && npm test

# Payment
cd payment && npm run test

# VideoVault
cd VideoVault && npm test

# VLLM
cd vllm && npm test
```

## Common Issues

### Issue: "Module not found"
**Solution:** Run `npm install` in the project directory

### Issue: "Database connection failed"
**Solution:** 
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify DATABASE_URL in .env
3. Ensure database exists

### Issue: "Python module not found"
**Solution:**
1. Activate virtual environment: `source venv/bin/activate`
2. Install requirements: `pip install -r requirements.txt`

### Issue: "CUDA not available" (for AI models)
**Solution:**
- Install NVIDIA drivers and CUDA toolkit
- Or use CPU-only version (slower):
  ```bash
  pip install torch torchvision torchaudio
  ```

### Issue: "Out of memory" when loading AI models
**Solution:**
- Use smaller models
- Increase system swap space
- Use model quantization (fp8, int8)

## Production Deployment

For production deployment:

1. **Use Docker Compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Set up Nginx reverse proxy** (configs in each project)

3. **Configure SSL certificates** (use Let's Encrypt)

4. **Set production environment variables**

5. **Enable monitoring and logging**

## Storage Requirements

- **Minimum:** ~10 GB (without AI models)
- **With AI models:** ~60 GB
- **Recommended:** 100 GB+ for development

## System Requirements

- **OS:** Linux (Ubuntu 20.04+), macOS, or WSL2
- **RAM:** 16 GB minimum, 32 GB recommended (for AI models)
- **GPU:** NVIDIA GPU with 8GB+ VRAM (for AI image generation)
- **Node.js:** v18 or higher
- **Python:** 3.10 or higher
- **Docker:** Latest version
- **PostgreSQL:** 14 or higher

## Getting Help

- Check project-specific README files in each directory
- Review `SIZE_REDUCTION_SUMMARY.md` for what was excluded
- See `PUBLISHING_GUIDE.md` for Git workflow

## Updating

To update your local repository:

```bash
git pull origin main

# Update dependencies
cd l2p && npm install
cd ../payment && npm install
cd ../VideoVault && npm install
cd ../vllm && npm install

# Update Python dependencies
cd vllm/ai-image-gen/forge
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

---

**Last Updated:** 2025-12-27
