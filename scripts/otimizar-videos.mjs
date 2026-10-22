// Prepara os vídeos de IA (1920x1080, 6 s) para o site. Rode com: npm run videos
// - Fecha o loop: o último 1 s se funde com o começo, então o vídeo repete sem "pulo".
// - Recorta para o formato de cada lugar (horizontal, em pé no celular, 4:5 nos passos).
// - Tira o áudio, comprime em H.264 e põe o índice no começo do arquivo (começa a tocar antes).
// - Gera o pôster (primeiro quadro) em WebP, que aparece enquanto o vídeo carrega.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';

const SRC = 'imagens-ia/videos';
const OUT = 'public/video';
const FADE = 1; // segundos de fusão no fim do loop

// crop = [largura, altura, x, y] sobre o vídeo original de 1920x1080.
const JOBS = [
  // Corte fino no rodapé: tira a marca d'água do gerador, que ficava atrás do botão de pausa.
  { src: 'Sizzling_Smash_Burger_Push-in', out: 'hero-wide', crop: [1706, 960, 107, 0], width: 1280, crf: 26 },
  { src: 'Sizzling_Smash_Burger_Push-in', out: 'hero-tall', crop: [608, 1080, 656, 0], width: 540, crf: 27 },
  // A espátula fica à direita do quadro; o recorte acompanha e para antes da
  // marca d'água do gerador (canto inferior direito), para ela não aparecer cortada.
  { src: 'Smash_Burger_Griddle_Sizzle_Loop', out: 'passo-2', crop: [760, 950, 1040, 0], width: 576, crf: 27 },
  { src: 'Melting_Cheese_Patty_Griddle', out: 'passo-3', crop: [864, 1080, 528, 0], width: 576, crf: 27 },
  { src: 'Brioche_Smash_Burger_Drop_Slow', out: 'passo-4', crop: [864, 1080, 528, 0], width: 576, crf: 27 },
];

// Duração em segundos. Sem arquivo de saída o ffmpeg termina com erro, mas
// antes escreve as informações do vídeo no stderr.
function videoSeconds(file) {
  let text = '';
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    text = String(err.stderr);
  }
  const m = text.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`Não consegui ler a duração de ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) {
    const input = `${SRC}/${job.src}.mp4`;
    const total = videoSeconds(input);
    const crop = job.crop ? `crop=${job.crop.join(':')},` : '';
    // O trecho final (depois do 1º segundo) termina fundindo no 1º segundo:
    // o último quadro vira exatamente o quadro que vem antes do primeiro.
    const filter = [
      `[0:v]${crop}scale=${job.width}:-2:flags=lanczos,split[x][y]`,
      `[x]trim=start=${FADE},setpts=PTS-STARTPTS[body]`,
      `[y]trim=end=${FADE},setpts=PTS-STARTPTS[head]`,
      `[body][head]xfade=transition=fade:duration=${FADE}:offset=${(total - 2 * FADE).toFixed(3)},format=yuv420p[v]`,
    ].join(';');
    const mp4 = `${OUT}/${job.out}.mp4`;
    execFileSync(ffmpeg, [
      '-v', 'error', '-y', '-i', input, '-filter_complex', filter, '-map', '[v]', '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(job.crf), '-profile:v', 'high',
      '-movflags', '+faststart', mp4,
    ]);
    // Pôster = primeiro quadro do vídeo final, para não haver troca visível quando ele começa.
    const png = execFileSync(ffmpeg, ['-v', 'error', '-i', mp4, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-']);
    await sharp(png).webp({ quality: 72 }).toFile(`${OUT}/${job.out}.webp`);
    console.log(`${mp4}  ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
  }
}

main();
