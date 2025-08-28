# Netlify Deployment Guide

## 🚀 Quick Deploy

### Option 1: Git-based Deployment (Recommended)

1. **Push to GitHub/GitLab**:
   ```bash
   git add .
   git commit -m "Ready for Netlify deployment"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your Git repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`

3. **Set Environment Variables**:
   Go to Site Settings → Environment Variables and add:
   ```
   VITE_SUPABASE_URL=https://vqufkqgrxrjmjrgpcscv.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdWZrcWdyeHJqbWpyZ3Bjc2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2ODA5ODEsImV4cCI6MjA3MDI1Njk4MX0.lb_jeVSkIYPmMpBOofEwjni8OpHazEhTNZzBOx0wwAI
   VITE_MOCK_AUTH=false
   ```

4. **Deploy**: Netlify will automatically build and deploy your site!

### Option 2: Manual Deploy

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Drag & Drop**:
   - Go to [Netlify](https://netlify.com)
   - Drag the `dist` folder to the deploy area

## 🔧 Configuration

### Netlify Settings
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18

### Environment Variables Required
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_MOCK_AUTH`: Set to `false` for production

## 🌐 Domain Configuration

### Custom Domain (Optional)
1. Go to Site Settings → Domain Management
2. Add your custom domain
3. Configure DNS records as instructed

### HTTPS
- Automatically enabled by Netlify
- Free SSL certificates included

## 🔄 Automatic Deployments

Once connected to Git:
- Every push to `main` branch triggers a new deployment
- Preview deployments for pull requests
- Rollback to previous versions easily

## 📊 Monitoring

### Netlify Analytics (Optional)
- Real-time visitor data
- Performance metrics
- Available as paid add-on

## 🐛 Troubleshooting

### Common Issues:
1. **Build fails**: Check Node.js version (should be 18+)
2. **404 on refresh**: Ensure `netlify.toml` redirects are configured
3. **Environment variables**: Make sure all VITE_ prefixed vars are set
4. **Supabase connection**: Verify URL and keys are correct

### Build Logs
- Check Netlify deploy logs for detailed error information
- Look for missing dependencies or environment variables

## 📝 Notes

- The app uses Supabase for authentication and database
- All environment variables must be prefixed with `VITE_` for Vite
- SPA routing is handled by the `netlify.toml` redirect rules
