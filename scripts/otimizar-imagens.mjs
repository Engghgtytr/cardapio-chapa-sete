// Converte as imagens de IA (PNG de 1 a 3 MB) em WebP leves, em dois tamanhos,
// para o navegador escolher pelo `srcset`. Rode com: npm run imagens
import fs from 'node:fs';
import sharp from 'sharp';

const SRC = 'imagens-ia';
const OUT = 'public/img';

// Cardápio: fotos do Higgsfield, quadradas e sem texto.
const MENU = [
  'burger-classico', 'burger-bacon', 'burger-salada', 'burger-onion', 'burger-frango',
  'burger-veggie', 'batata-frita', 'batata-cheddar-bacon', 'onion-rings', 'refrigerante',
  'limonada', 'milkshake', 'brownie', 'cookie',
];

// Página da loja: cartazes do ChatGPT (arquivo → nome do prato).
const POSTERS = {
  '01': 'burger-bacon', '02': 'burger-classico', '03': 'burger-veggie', '04': 'burger-frango',
  '05': 'burger-onion', '06': 'onion-rings', '07': 'batata-cheddar-bacon', '08': 'batata-frita',
  '09': 'milkshake', '10': 'limonada', '12': 'brownie', '14': 'cookie',
};

// "Como nasce um smash". O passo 1 é recortado para tirar o texto "BURGER" do topo;
// o passo 4 não veio do ChatGPT, então usa a foto do Higgsfield.
const STEPS = [
  { name: 'passo-1', file: `${SRC}/chatgpt/15.png`, crop: { left: 0.12, top: 0.26, size: 0.76 } },
  { name: 'passo-2', file: `${SRC}/chatgpt/11.png` },
  { name: 'passo-3', file: `${SRC}/chatgpt/13.png` },
  { name: 'passo-4', file: `${SRC}/passo-4-montagem.png` },
];

const webp = (img, width, out) => img.clone().resize({ width }).webp({ quality: 76 }).toFile(out);

async function cornerColor(file) {
  const { data } = await sharp(file).extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

async function main() {
  for (const dir of ['menu', 'loja', 'passos']) fs.mkdirSync(`${OUT}/${dir}`, { recursive: true });

  for (const name of MENU) {
    const img = sharp(`${SRC}/${name}.png`);
    await Promise.all([320, 640].map((w) => webp(img, w, `${OUT}/menu/${name}-${w}.webp`)));
  }

  // Os cartazes têm proporções diferentes (2:3, 4:5, 1:1). Todos viram 4:5, completando
  // a borda com a cor do próprio fundo, para não cortar o texto do cartaz.
  for (const [num, name] of Object.entries(POSTERS)) {
    const file = `${SRC}/chatgpt/${num}.png`;
    const background = await cornerColor(file);
    const img = sharp(file).resize({ width: 1000, height: 1250, fit: 'contain', background });
    const base = sharp(await img.png().toBuffer());
    await Promise.all([480, 800].map((w) => webp(base, w, `${OUT}/loja/${name}-${w}.webp`)));
  }

  for (const step of STEPS) {
    let img = sharp(step.file);
    if (step.crop) {
      const { width, height } = await img.metadata();
      const size = Math.round(width * step.crop.size);
      img = img.extract({
        left: Math.round(width * step.crop.left),
        top: Math.round(height * step.crop.top),
        width: size,
        height: Math.min(size, height - Math.round(height * step.crop.top)),
      });
      img = sharp(await img.png().toBuffer());
    }
    await Promise.all([800, 1400].map((w) => webp(img, w, `${OUT}/passos/${step.name}-${w}.webp`)));
  }

  const capa = sharp(`${SRC}/capa.png`);
  await Promise.all([1280, 2000].map((w) => webp(capa, w, `${OUT}/capa-${w}.webp`)));
  console.log('Imagens otimizadas em', OUT);
}

main();
