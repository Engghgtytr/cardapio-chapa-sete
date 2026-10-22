// Prepara a foto escolhida no celular antes de enviar: corta em quadrado e
// reduz para 640x640 em WebP (de ~4 MB para ~50 KB). Assim o cardápio carrega
// rápido e o envio não estoura o limite do bucket (1 MB).
export const PHOTO_SIZE = 640;
const MAX_INPUT = 15 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function checkPhoto(file) {
  if (!file) return 'Escolha uma foto.';
  if (!TYPES.includes(file.type)) return 'Use uma foto JPG, PNG ou WebP.';
  if (file.size > MAX_INPUT) return 'A foto passa de 15 MB. Escolha uma menor.';
  return null;
}

export async function squarePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  // Navegador sem WebP no canvas (Safari antigo) devolve PNG: também é aceito.
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('Não foi possível preparar a foto. Tente outra.');
  return blob;
}
