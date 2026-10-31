# 部署 / Deployment

`npm run build` 生成纯静态站点 `dist/`，可以放到任何静态托管（Nginx、Cloudflare Pages、Vercel、GitHub Pages）。

## 子路径

```bash
ATLAS_BASE=/words/ npm run build
```

## Nginx 示例

```nginx
location ^~ /words/ {
    alias /var/www/word-atlas/;
    try_files $uri $uri/ /words/index.html;
    expires 7d;
}
```

## Cloudflare Pages

`public/atlas` 超过免费版的 20,000 文件上限。把该目录放到 R2，构建时设置 `VITE_ATLAS_BASE`，见 [DEPLOY_R2.md](./DEPLOY_R2.md)。这和子路径用的 `ATLAS_BASE` 不是同一个变量。

## GitHub Pages

仓库带有 `.github/workflows/pages.yml`。在仓库 Settings → Pages 选择 “GitHub Actions”，然后手动运行 “Deploy to GitHub Pages”。

## 体积

插画与音频合计约数百 MB。建议在 CDN 后部署，或按需只发布 `thumb/` 和部分音频。
