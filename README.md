This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Imágenes

Las capturas originales viven en `public/{about,alt,johnny,mmdiscos,salon}/*.png`, pero la web
nunca las sirve tal cual: `scripts/optimize-images.mjs` genera variantes WebP en `public/media/`
y un manifest con dimensiones y color dominante en `src/lib/media-manifest.json`.

| Variante | Tamaño | Uso |
| --- | --- | --- |
| `thumb` | 384 px de ancho | miniaturas de la grid de escritorio |
| `sm` | lado mayor 640 px | texturas en móvil |
| `md` | lado mayor 1280 px | hover, flicker del footer, columna del slider 3D |
| `lg` | lado mayor 1920 px | imagen en detalle del slider en pantallas retina |

`getOptimizedImageUrl(src, { width })` (`src/lib/optimizedImage.js`) devuelve la variante más
pequeña que cubre ese ancho; solo si una imagen aún no está en el manifest recurre a
`/_next/image`. Al añadir o cambiar una imagen:

```bash
npm run images
```

y commitea `public/media/` y `src/lib/media-manifest.json`. El script también corre solo antes de
cada `npm run build` y únicamente re-codifica lo que ha cambiado.

La precarga de la intro (qué se descarga antes de que los cuadrados viajen a la esquina) está en
`src/lib/preload.js`; los componentes con Three.js se cargan aparte desde `src/lib/lazyComponents.js`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
