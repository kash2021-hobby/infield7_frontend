export async function cropLogo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Use a PNG or SVG logo"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not crop the logo");
    const size = Math.min(image.width, image.height);
    ctx.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 40, 40);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
